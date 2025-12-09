export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOttoClient } from '@/lib/otto-client'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * GET /api/fibu/zahlungen/otto
 * Lädt Otto Receipts (Rechnungen) und speichert sie in MongoDB
 * 
 * Query Parameter:
 * - from: Start-Datum (YYYY-MM-DD)
 * - to: End-Datum (YYYY-MM-DD)
 * - types: Optional, comma-separated 'PURCHASE,REFUND' (default: beide)
 * - refresh: Optional, wenn true werden Daten neu von Otto geholt
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const types = searchParams.get('types')
    const refresh = searchParams.get('refresh') === 'true'

    // Standard: Letzter Monat
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const receiptTypes = types ? types.split(',') : ['PURCHASE', 'REFUND']

    console.log(`[Otto] Fetching receipts from ${startDate} to ${endDate}, types: ${receiptTypes.join(',')}`)

    const db = await getDb()
    const collection = db.collection('fibu_otto_transactions')

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
        console.log(`[Otto] Returning ${cached.length} cached receipts from MongoDB`)
        
        // Berechne Statistiken
        const stats = {
          anzahl: cached.length,
          gesamtBetrag: cached.reduce((sum, t) => sum + (t.betrag || 0), 0),
          kaufbelege: cached.filter(t => t.typ === 'PURCHASE').length,
          erstattungen: cached.filter(t => t.typ === 'REFUND').length,
          echteRechnungen: cached.filter(t => t.istEchteRechnung === true).length,
        }

        return NextResponse.json({
          ok: true,
          from: startDate,
          to: endDate,
          cached: true,
          stats,
          transactions: cached.map(t => ({
            _id: t._id?.toString(),
            transactionId: t.transactionId,
            datum: t.datum,
            bestelldatum: t.bestelldatum,
            orderId: t.orderId,
            betrag: t.betrag,
            waehrung: t.waehrung,
            nettoBetrag: t.nettoBetrag,
            typ: t.typ,
            istEchteRechnung: t.istEchteRechnung,
            istZugeordnet: t.istZugeordnet || false,
            zugeordneteRechnung: t.zugeordneteRechnung || null,
            zugeordnetesKonto: t.zugeordnetesKonto || null,
            zuordnungsArt: t.zuordnungsArt || null,
          }))
        })
      }
    }

    // Hole Daten von Otto API
    console.log('[Otto] Fetching fresh data from Otto API...')
    const otto = getOttoClient()
    
    const receipts = await otto.getReceipts({
      from: startDate,
      to: endDate,
      receiptTypes,
    })
    
    console.log(`[Otto] Received ${receipts.length} receipts from API`)

    // Formatiere und speichere in MongoDB
    const formattedTransactions = receipts.map(r => otto.formatForFibu(r))

    console.log(`[Otto] Saving ${formattedTransactions.length} receipts to MongoDB...`)

    // Upsert in MongoDB (bewahre User-Daten)
    const bulkOps = formattedTransactions.map(t => ({
      updateOne: {
        filter: { transactionId: t.transactionId },
        update: {
          $set: {
            // Otto-Original-Daten
            datum: t.datum,
            datumDate: t.datumDate,
            bestelldatum: t.bestelldatum,
            orderId: t.orderId,
            betrag: t.betrag,
            waehrung: t.waehrung,
            nettoBetrag: t.nettoBetrag,
            typ: t.typ,
            istEchteRechnung: t.istEchteRechnung,
            quelle: t.quelle,
            ursprungsdaten: t.ursprungsdaten,
            updated_at: new Date()
          },
          $setOnInsert: {
            // User-Daten (nur beim ersten Insert)
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
      const result = await collection.bulkWrite(bulkOps)
      console.log(`[Otto] MongoDB: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`)
    }

    // Lade aktualisierte Daten aus MongoDB
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

    // Berechne Statistiken
    const stats = {
      anzahl: updatedTransactions.length,
      gesamtBetrag: updatedTransactions.reduce((sum, t) => sum + (t.betrag || 0), 0),
      kaufbelege: updatedTransactions.filter(t => t.typ === 'PURCHASE').length,
      erstattungen: updatedTransactions.filter(t => t.typ === 'REFUND').length,
      echteRechnungen: updatedTransactions.filter(t => t.istEchteRechnung === true).length,
    }

    return NextResponse.json({
      ok: true,
      from: startDate,
      to: endDate,
      cached: false,
      stats,
      transactions: updatedTransactions.map(t => ({
        _id: t._id?.toString(),
        transactionId: t.transactionId,
        datum: t.datum,
        bestelldatum: t.bestelldatum,
        orderId: t.orderId,
        betrag: t.betrag,
        waehrung: t.waehrung,
        nettoBetrag: t.nettoBetrag,
        typ: t.typ,
        istEchteRechnung: t.istEchteRechnung,
        istZugeordnet: t.istZugeordnet || false,
        zugeordneteRechnung: t.zugeordneteRechnung || null,
        zugeordnetesKonto: t.zugeordnetesKonto || null,
        zuordnungsArt: t.zuordnungsArt || null,
      }))
    })

  } catch (error) {
    console.error('[Otto] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fibu/zahlungen/otto
 * Auto-Matching mit JTL Rechnungen
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from, to, autoMatch = true } = body

    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: 'from und to Parameter sind erforderlich' },
        { status: 400 }
      )
    }

    const db = await getDb()
    const ottoCollection = db.collection('fibu_otto_transactions')
    const rechnungenCollection = db.collection('fibu_rechnungen_vk')

    const dateFilter = {
      datumDate: {
        $gte: new Date(from + 'T00:00:00Z'),
        $lte: new Date(to + 'T23:59:59Z')
      }
    }

    const transactions = await ottoCollection.find(dateFilter).toArray()
    console.log(`[Otto Sync] Found ${transactions.length} transactions`)

    let matched = 0
    let unmatched = 0

    if (autoMatch) {
      for (const transaction of transactions) {
        let matchedRechnung = null

        // 1. Versuche über Order ID (SalesOrderId)
        if (transaction.orderId) {
          matchedRechnung = await rechnungenCollection.findOne({
            $or: [
              { cBestellNr: transaction.orderId },
              { cRechnungsNr: { $regex: transaction.orderId, $options: 'i' } }
            ]
          })
        }

        // 2. Versuche über Betrag + Datum (±3 Tage)
        if (!matchedRechnung && transaction.betrag > 0) {
          const transactionDate = new Date(transaction.datum)
          const dateFrom = new Date(transactionDate)
          dateFrom.setDate(dateFrom.getDate() - 3)
          const dateTo = new Date(transactionDate)
          dateTo.setDate(dateTo.getDate() + 3)

          matchedRechnung = await rechnungenCollection.findOne({
            fBrutto: { $gte: transaction.betrag - 0.01, $lte: transaction.betrag + 0.01 },
            dRechnungsdatum: { $gte: dateFrom, $lte: dateTo }
          })
        }

        // Update mit Matching-Info
        if (matchedRechnung) {
          await ottoCollection.updateOne(
            { _id: transaction._id },
            {
              $set: {
                zugeordneteRechnung: matchedRechnung.cRechnungsNr,
                zugeordnetesKonto: matchedRechnung.kKunde?.toString() || null,
                istZugeordnet: true,
                zuordnungsArt: 'auto',
                updated_at: new Date()
              }
            }
          )
          matched++
        } else {
          unmatched++
        }
      }
    }

    console.log(`[Otto Sync] Matched: ${matched}, Unmatched: ${unmatched}`)

    return NextResponse.json({
      ok: true,
      from,
      to,
      total: transactions.length,
      matched,
      unmatched,
      matchRate: transactions.length > 0 ? ((matched / transactions.length) * 100).toFixed(1) + '%' : '0%'
    })

  } catch (error) {
    console.error('[Otto Sync] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
