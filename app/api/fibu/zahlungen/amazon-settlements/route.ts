export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { getDb } from '../../../../lib/db/mongodb'
import { berechneAmazonBuchung } from '../../../../lib/fibu/buchungslogik'

/**
 * GET /api/fibu/zahlungen/amazon-settlements
 * Lädt Amazon Settlement Positionen aus JTL und speichert in MongoDB
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const refresh = searchParams.get('refresh') === 'true'

    // Standard: Letzter Monat
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`[Amazon] Fetching settlements from ${startDate} to ${endDate}`)

    const db = await getDb()
    const collection = db.collection('fibu_amazon_settlements')

    // Wenn refresh=false, versuche zuerst aus MongoDB zu laden
    if (!refresh) {
      const startDateTime = new Date(startDate + 'T00:00:00Z')
      const endDateTime = new Date(endDate + 'T23:59:59Z')
      
      const cached = await collection
        .find({
          datumDate: {
            $gte: startDateTime,
            $lte: endDateTime
          }
        })
        .sort({ datumDate: -1 })
        .toArray()

      if (cached.length > 0) {
        console.log(`[Amazon] Returning ${cached.length} cached settlements from MongoDB`)
        
        const stats = {
          anzahl: cached.length,
          gesamtBetrag: cached.reduce((sum, t) => sum + (t.betrag || 0), 0),
          erloese: cached.filter(t => t.kategorie === 'erloes').reduce((sum, t) => sum + t.betrag, 0),
          gebuehren: cached.filter(t => t.kategorie === 'gebuehr').reduce((sum, t) => sum + t.betrag, 0),
        }

        return NextResponse.json({
          ok: true,
          from: startDate,
          to: endDate,
          cached: true,
          stats,
          settlements: cached.map(t => ({
            _id: t._id?.toString(),
            transactionId: t.transactionId,
            datum: t.datum,
            betrag: t.betrag,
            waehrung: t.waehrung,
            transactionType: t.transactionType,
            amountType: t.amountType,
            orderId: t.orderId,
            kategorie: t.kategorie,
            istZugeordnet: t.istZugeordnet || false,
            zugeordneteRechnung: t.zugeordneteRechnung || null,
          }))
        })
      }
    }

    // Hole Daten aus JTL
    console.log('[Amazon] Fetching fresh data from JTL...')
    const pool = await getMssqlPool()
    
    const result = await pool.request()
      .input('startDate', new Date(startDate + 'T00:00:00Z'))
      .input('endDate', new Date(endDate + 'T23:59:59Z'))
      .query(`
        SELECT 
          sp.kMessageId,
          sp.SettlementID,
          sp.TransactionType,
          sp.OrderID,
          sp.MerchantOrderID,
          sp.AmountType,
          sp.AmountDescription,
          sp.Amount,
          sp.PostedDateTime,
          sp.SKU,
          sp.QuantityPurchased,
          s.DepositDate,
          sp.MarketplaceName
        FROM dbo.pf_amazon_settlementpos sp
        JOIN dbo.pf_amazon_settlement s ON sp.SettlementID = s.SettlementID
        WHERE sp.PostedDateTime >= @startDate
          AND sp.PostedDateTime <= @endDate
          AND sp.Amount <> 0
        ORDER BY sp.PostedDateTime DESC
      `)

    console.log(`[Amazon] Received ${result.recordset.length} settlement positions from JTL`)

    // Formatiere für MongoDB
    const formattedTransactions = result.recordset.map((pos: any) => {
      const kategorie = kategorisierePosition(pos)
      
      return {
        transactionId: `AMZ-${pos.kMessageId}`,
        datum: pos.PostedDateTime?.toISOString() || null,
        datumDate: pos.PostedDateTime || null,
        betrag: parseFloat(pos.Amount || 0),
        waehrung: 'EUR',
        
        settlementId: pos.SettlementID?.toString(),
        orderId: pos.OrderID,
        merchantOrderId: pos.MerchantOrderID,
        
        transactionType: pos.TransactionType,
        amountType: pos.AmountType,
        amountDescription: pos.AmountDescription,
        
        depositDate: pos.DepositDate,
        marketplace: pos.MarketplaceName,
        sku: pos.SKU,
        quantity: pos.QuantityPurchased,
        
        kategorie,
        quelle: 'Amazon',
        ursprungsdaten: pos,
      }
    })

    // Upsert in MongoDB
    const bulkOps = formattedTransactions.map(t => ({
      updateOne: {
        filter: { transactionId: t.transactionId },
        update: {
          $set: {
            // Amazon-Daten
            datum: t.datum,
            datumDate: t.datumDate,
            betrag: t.betrag,
            waehrung: t.waehrung,
            settlementId: t.settlementId,
            orderId: t.orderId,
            merchantOrderId: t.merchantOrderId,
            transactionType: t.transactionType,
            amountType: t.amountType,
            amountDescription: t.amountDescription,
            depositDate: t.depositDate,
            marketplace: t.marketplace,
            sku: t.sku,
            quantity: t.quantity,
            kategorie: t.kategorie,
            quelle: t.quelle,
            ursprungsdaten: t.ursprungsdaten,
            updated_at: new Date()
          },
          $setOnInsert: {
            // User-Daten
            transactionId: t.transactionId,
            istZugeordnet: false,
            zugeordneteRechnung: null,
            zugeordnetesKonto: null,
            zuordnungsArt: null,
            imported_at: new Date()
          }
        },
        upsert: true
      }
    }))

    if (bulkOps.length > 0) {
      const writeResult = await collection.bulkWrite(bulkOps)
      console.log(`[Amazon] MongoDB: ${writeResult.upsertedCount} inserted, ${writeResult.modifiedCount} updated`)
    }

    // Lade aktualisierte Daten
    const startDateTime = new Date(startDate + 'T00:00:00Z')
    const endDateTime = new Date(endDate + 'T23:59:59Z')
    
    const updatedTransactions = await collection
      .find({
        datumDate: {
          $gte: startDateTime,
          $lte: endDateTime
        }
      })
      .sort({ datumDate: -1 })
      .toArray()

    const stats = {
      anzahl: updatedTransactions.length,
      gesamtBetrag: updatedTransactions.reduce((sum, t) => sum + (t.betrag || 0), 0),
      erloese: updatedTransactions.filter(t => t.kategorie === 'erloes').reduce((sum, t) => sum + t.betrag, 0),
      gebuehren: updatedTransactions.filter(t => t.kategorie === 'gebuehr').reduce((sum, t) => sum + t.betrag, 0),
    }

    return NextResponse.json({
      ok: true,
      from: startDate,
      to: endDate,
      cached: false,
      stats,
      settlements: updatedTransactions.map(t => ({
        _id: t._id?.toString(),
        transactionId: t.transactionId,
        datum: t.datum,
        betrag: t.betrag,
        waehrung: t.waehrung,
        transactionType: t.transactionType,
        amountType: t.amountType,
        orderId: t.orderId,
        kategorie: t.kategorie,
        istZugeordnet: t.istZugeordnet || false,
        zugeordneteRechnung: t.zugeordneteRechnung || null,
      }))
    })

  } catch (error) {
    console.error('[Amazon] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Kategorisiert Amazon Settlement Position
 */
function kategorisierePosition(pos: any): string {
  const tt = pos.TransactionType?.toLowerCase() || ''
  const at = pos.AmountType?.toLowerCase() || ''
  const ad = pos.AmountDescription?.toLowerCase() || ''
  
  // Erlöse
  if (tt.includes('order') && at.includes('item') && ad.includes('principal')) return 'erloes'
  if (tt.includes('order') && at.includes('shipping')) return 'erloes'
  
  // Gebühren
  if (at.includes('fee') || at.includes('commission')) return 'gebuehr'
  if (ad.includes('commission') || ad.includes('fee')) return 'gebuehr'
  
  // Rückerstattungen
  if (tt.includes('refund')) return 'rueckerstattung'
  
  // Transfer
  if (tt.includes('transfer')) return 'transfer'
  
  // Sonstiges
  return 'sonstiges'
}
