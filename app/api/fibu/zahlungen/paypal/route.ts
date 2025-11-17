export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayPalClient } from '../../../../../lib/paypal-client'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * GET /api/fibu/zahlungen/paypal
 * Lädt PayPal Transaktionen für einen Zeitraum und speichert sie in MongoDB
 * 
 * Query Parameter:
 * - from: Start-Datum (YYYY-MM-DD)
 * - to: End-Datum (YYYY-MM-DD)
 * - refresh: Optional, wenn true werden Daten neu von PayPal API geholt
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const refresh = searchParams.get('refresh') === 'true'

    // Standard: Letzte 30 Tage (PayPal erlaubt max 31 Tage Range)
    const now = new Date()
    const endDate = to || now.toISOString().split('T')[0]
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startDate = from || defaultStart.toISOString().split('T')[0]
    
    // Validiere: Max 31 Tage Range
    const start = new Date(startDate)
    const end = new Date(endDate)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff > 31) {
      return NextResponse.json(
        {
          ok: false,
          error: 'PayPal Transaction Search API erlaubt maximal 31 Tage Zeitraum',
          maxDays: 31,
          requested: daysDiff
        },
        { status: 400 }
      )
    }

    console.log(`[PayPal] Fetching transactions from ${startDate} to ${endDate}`)

    const db = await getDb()
    const collection = db.collection('fibu_paypal_transactions')

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
        console.log(`[PayPal] Returning ${cached.length} cached transactions from MongoDB`)
        
        // Berechne Statistiken
        const stats = {
          anzahl: cached.length,
          gesamtBetrag: cached.reduce((sum, t) => sum + (t.betrag || 0), 0),
          gesamtGebuehren: cached.reduce((sum, t) => sum + (t.gebuehr || 0), 0),
          nettoGesamt: cached.reduce((sum, t) => sum + (t.nettoBetrag || 0), 0),
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
            betrag: t.betrag,
            waehrung: t.waehrung,
            gebuehr: t.gebuehr,
            nettoBetrag: t.nettoBetrag,
            status: t.status,
            ereignis: t.ereignis,
            betreff: t.betreff,
            rechnungsNr: t.rechnungsNr,
            kundenEmail: t.kundenEmail,
            kundenName: t.kundenName,
            istZugeordnet: t.istZugeordnet || false,
            zugeordneteRechnung: t.zugeordneteRechnung || null,
            zugeordnetesKonto: t.zugeordnetesKonto || null,
            zuordnungsArt: t.zuordnungsArt || null,
          }))
        })
      }
    }

    // Hole Daten von PayPal API
    console.log('[PayPal] Fetching fresh data from PayPal API...')
    const paypal = getPayPalClient()
    
    const transactions = await paypal.getAllTransactions(startDate, endDate)
    console.log(`[PayPal] Received ${transactions.length} transactions from API`)

    // Formatiere und speichere in MongoDB
    const formattedTransactions = transactions
      .filter(t => paypal.isSuccessfulTransaction(t)) // Nur erfolgreiche Transaktionen
      .map(t => paypal.formatForFibu(t))

    console.log(`[PayPal] Saving ${formattedTransactions.length} successful transactions to MongoDB...`)

    // Upsert in MongoDB (basierend auf transactionId)
    const bulkOps = formattedTransactions.map(t => ({
      updateOne: {
        filter: { transactionId: t.transactionId },
        update: {
          $set: {
            ...t,
            updated_at: new Date()
          },
          $setOnInsert: {
            imported_at: new Date()
          }
        },
        upsert: true
      }
    }))

    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps)
      console.log(`[PayPal] MongoDB bulk write: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`)
    }

    // Berechne Statistiken
    const stats = {
      anzahl: formattedTransactions.length,
      gesamtBetrag: formattedTransactions.reduce((sum, t) => sum + t.betrag, 0),
      gesamtGebuehren: formattedTransactions.reduce((sum, t) => sum + t.gebuehr, 0),
      nettoGesamt: formattedTransactions.reduce((sum, t) => sum + t.nettoBetrag, 0),
    }

    return NextResponse.json({
      ok: true,
      from: startDate,
      to: endDate,
      cached: false,
      stats,
      transactions: formattedTransactions.map(t => ({
        transactionId: t.transactionId,
        datum: t.datum,
        betrag: t.betrag,
        waehrung: t.waehrung,
        gebuehr: t.gebuehr,
        nettoBetrag: t.nettoBetrag,
        status: t.status,
        ereignis: t.ereignis,
        betreff: t.betreff,
        rechnungsNr: t.rechnungsNr,
        kundenEmail: t.kundenEmail,
        kundenName: t.kundenName,
      }))
    })

  } catch (error) {
    console.error('[PayPal] Error:', error)
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
 * POST /api/fibu/zahlungen/paypal/sync
 * Synchronisiert PayPal Transaktionen mit JTL Rechnungen
 * 
 * Versucht PayPal Transaktionen automatisch JTL Rechnungen zuzuordnen über:
 * - Invoice ID (falls in PayPal hinterlegt)
 * - Rechnungsnummer aus Betreff/Notiz
 * - Betrag + Datum Matching
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from, to, autoMatch = true } = body

    // Hole PayPal Transaktionen
    const db = await getDb()
    const paypalCollection = db.collection('fibu_paypal_transactions')
    const rechnungenCollection = db.collection('fibu_rechnungen_vk')

    const dateFilter = {
      datum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59Z')
      }
    }

    const paypalTransactions = await paypalCollection.find(dateFilter).toArray()
    console.log(`[PayPal Sync] Found ${paypalTransactions.length} PayPal transactions`)

    let matched = 0
    let unmatched = 0

    if (autoMatch) {
      for (const transaction of paypalTransactions) {
        let matchedRechnung = null

        // 1. Versuche über Invoice ID
        if (transaction.rechnungsNr) {
          matchedRechnung = await rechnungenCollection.findOne({
            cRechnungsNr: transaction.rechnungsNr
          })
        }

        // 2. Versuche über Betreff (extrahiere Rechnungsnummer)
        if (!matchedRechnung && transaction.betreff) {
          const rnMatch = transaction.betreff.match(/(?:RE|RG|INV|#)\s*(\d{6,})/i)
          if (rnMatch) {
            const possibleRN = rnMatch[1]
            matchedRechnung = await rechnungenCollection.findOne({
              cRechnungsNr: { $regex: possibleRN, $options: 'i' }
            })
          }
        }

        // 3. Versuche über Betrag + Datum (±3 Tage)
        if (!matchedRechnung) {
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

        // Update PayPal Transaktion mit Zuordnung
        if (matchedRechnung) {
          await paypalCollection.updateOne(
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

    console.log(`[PayPal Sync] Matched: ${matched}, Unmatched: ${unmatched}`)

    return NextResponse.json({
      ok: true,
      from,
      to,
      total: paypalTransactions.length,
      matched,
      unmatched,
      matchRate: paypalTransactions.length > 0 ? (matched / paypalTransactions.length * 100).toFixed(1) + '%' : '0%'
    })

  } catch (error) {
    console.error('[PayPal Sync] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
