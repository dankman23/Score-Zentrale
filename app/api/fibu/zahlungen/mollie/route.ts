export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMollieClient } from '../../../../../lib/mollie-client'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * GET /api/fibu/zahlungen/mollie
 * Lädt Mollie Payments und speichert sie in MongoDB
 * 
 * Query Parameter:
 * - from: Start-Datum (YYYY-MM-DD)
 * - to: End-Datum (YYYY-MM-DD)
 * - refresh: Optional, wenn true werden Daten neu von Mollie geholt
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

    console.log(`[Mollie] Fetching payments from ${startDate} to ${endDate}`)

    const db = await getDb()
    const collection = db.collection('fibu_mollie_transactions')

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
        console.log(`[Mollie] Returning ${cached.length} cached payments from MongoDB`)
        
        // Berechne Statistiken
        const stats = {
          anzahl: cached.length,
          gesamtBetrag: cached.reduce((sum, t) => sum + (t.betrag || 0), 0),
          bezahlt: cached.filter(t => t.status === 'paid').length,
          offen: cached.filter(t => t.status === 'open').length,
          fehlgeschlagen: cached.filter(t => t.status === 'failed').length,
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
            status: t.status,
            methode: t.methode,
            beschreibung: t.beschreibung,
            kundenName: t.kundenName,
            kundenEmail: t.kundenEmail,
            rechnungsNr: t.rechnungsNr,
            istZugeordnet: t.istZugeordnet || false,
            zugeordneteRechnung: t.zugeordneteRechnung || null,
            zugeordnetesKonto: t.zugeordnetesKonto || null,
            zuordnungsArt: t.zuordnungsArt || null,
          }))
        })
      }
    }

    // Hole Daten von Mollie API
    console.log('[Mollie] Fetching fresh data from Mollie API...')
    const mollie = getMollieClient()
    
    const payments = await mollie.getPayments({ from: startDate })
    console.log(`[Mollie] Received ${payments.length} payments from API`)

    // Filter nach Enddatum
    const filteredPayments = payments.filter(p => {
      const paymentDate = new Date(p.createdAt)
      const end = new Date(endDate + 'T23:59:59Z')
      return paymentDate <= end
    })

    // Formatiere und speichere in MongoDB
    const formattedTransactions = filteredPayments.map(p => mollie.formatForFibu(p))

    console.log(`[Mollie] Saving ${formattedTransactions.length} payments to MongoDB...`)

    // WICHTIG: Zugeordnete Zahlungen (istZugeordnet=true) dürfen NICHT überschrieben werden!
    const transactionIds = formattedTransactions.map(t => t.transactionId)
    const zugeordnete = await collection
      .find({
        transactionId: { $in: transactionIds },
        istZugeordnet: true
      })
      .project({ transactionId: 1 })
      .toArray()
    
    const zugeordneteIds = new Set(zugeordnete.map(z => z.transactionId))
    
    if (zugeordneteIds.size > 0) {
      console.log(`[Mollie] ⚠️ ${zugeordneteIds.size} bereits zugeordnete Transaktionen werden geschützt`)
    }

    // Upsert in MongoDB (bewahre User-Daten)
    const bulkOps = formattedTransactions
      .filter(t => !zugeordneteIds.has(t.transactionId)) // Überspringe zugeordnete! ✅
      .map(t => ({
        updateOne: {
          filter: { transactionId: t.transactionId },
          update: {
            $set: {
              // Mollie-Original-Daten
              datum: t.datum,
              datumDate: t.datumDate,
              betrag: t.betrag,
              waehrung: t.waehrung,
              status: t.status,
              methode: t.methode,
              beschreibung: t.beschreibung,
              kundenName: t.kundenName,
              kundenEmail: t.kundenEmail,
              rechnungsNr: t.rechnungsNr,
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
      console.log(`[Mollie] MongoDB: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`)
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
      bezahlt: updatedTransactions.filter(t => t.status === 'paid').length,
      offen: updatedTransactions.filter(t => t.status === 'open').length,
      fehlgeschlagen: updatedTransactions.filter(t => t.status === 'failed').length,
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
        betrag: t.betrag,
        waehrung: t.waehrung,
        status: t.status,
        methode: t.methode,
        beschreibung: t.beschreibung,
        kundenName: t.kundenName,
        kundenEmail: t.kundenEmail,
        rechnungsNr: t.rechnungsNr,
        istZugeordnet: t.istZugeordnet || false,
        zugeordneteRechnung: t.zugeordneteRechnung || null,
        zugeordnetesKonto: t.zugeordnetesKonto || null,
        zuordnungsArt: t.zuordnungsArt || null,
      }))
    })

  } catch (error) {
    console.error('[Mollie] Error:', error)
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
 * POST /api/fibu/zahlungen/mollie
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
    const mollieCollection = db.collection('fibu_mollie_transactions')
    const rechnungenCollection = db.collection('fibu_rechnungen_vk')

    const dateFilter = {
      datumDate: {
        $gte: new Date(from + 'T00:00:00Z'),
        $lte: new Date(to + 'T23:59:59Z')
      }
    }

    const transactions = await mollieCollection.find(dateFilter).toArray()
    console.log(`[Mollie Sync] Found ${transactions.length} transactions`)

    let matched = 0
    let unmatched = 0

    if (autoMatch) {
      for (const transaction of transactions) {
        let matchedRechnung = null

        // 1. Versuche über Rechnungsnummer in Metadata
        if (transaction.rechnungsNr) {
          matchedRechnung = await rechnungenCollection.findOne({
            cRechnungsNr: { $regex: transaction.rechnungsNr, $options: 'i' }
          })
        }

        // 2. Versuche über Beschreibung
        if (!matchedRechnung && transaction.beschreibung) {
          const rnMatch = transaction.beschreibung.match(/RE\d{4}-\d{5}/i)
          if (rnMatch) {
            matchedRechnung = await rechnungenCollection.findOne({
              cRechnungsNr: { $regex: rnMatch[0], $options: 'i' }
            })
          }
        }

        // 3. Versuche über Betrag + Datum (±3 Tage)
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
          await mollieCollection.updateOne(
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

    console.log(`[Mollie Sync] Matched: ${matched}, Unmatched: ${unmatched}`)

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
    console.error('[Mollie Sync] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
