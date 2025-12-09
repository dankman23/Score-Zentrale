export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getCommerzbankClient } from '../../../lib/fints-client'
import { getDb } from '../../../lib/db/mongodb'

/**
 * GET /api/fibu/zahlungen/commerzbank
 * Lädt Commerzbank Transaktionen via FinTS und speichert sie in MongoDB
 * 
 * Query Parameter:
 * - iban: IBAN des Kontos (erforderlich beim ersten Aufruf)
 * - from: Start-Datum (YYYY-MM-DD)
 * - to: End-Datum (YYYY-MM-DD)
 * - refresh: Optional, wenn true werden Daten neu von FinTS geholt
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const iban = searchParams.get('iban')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const refresh = searchParams.get('refresh') === 'true'

    // Standard: Letzter Monat
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`[Commerzbank] Fetching transactions from ${startDate} to ${endDate}`)

    const db = await getDb()
    const collection = db.collection('fibu_commerzbank_transactions')

    // Wenn keine IBAN angegeben, hole erste aus MongoDB oder von Bank
    let accountIban = iban
    if (!accountIban) {
      // Versuche aus MongoDB
      const existingTxn = await collection.findOne({}, { sort: { datumDate: -1 } })
      if (existingTxn && existingTxn.iban) {
        accountIban = existingTxn.iban
        console.log(`[Commerzbank] Using IBAN from DB: ${accountIban}`)
      } else {
        // Hole Konten von Bank
        const client = getCommerzbankClient()
        const accounts = await client.getAccounts()
        if (accounts.length === 0) {
          return NextResponse.json(
            { ok: false, error: 'Keine Konten gefunden' },
            { status: 404 }
          )
        }
        accountIban = accounts[0].iban
        console.log(`[Commerzbank] Using first account IBAN: ${accountIban}`)
      }
    }

    // Wenn refresh=false, versuche zuerst aus MongoDB zu laden
    if (!refresh) {
      const startDateTime = new Date(startDate + 'T00:00:00Z')
      const endDateTime = new Date(endDate + 'T23:59:59Z')
      
      const cached = await collection
        .find({
          iban: accountIban,
          datumDate: {
            $gte: startDateTime,
            $lte: endDateTime
          }
        })
        .sort({ datumDate: -1 })
        .toArray()

      if (cached.length > 0) {
        console.log(`[Commerzbank] Returning ${cached.length} cached transactions from MongoDB`)
        
        // Berechne Statistiken
        const stats = {
          anzahl: cached.length,
          gesamtBetrag: cached.reduce((sum, t) => sum + (t.betrag || 0), 0),
          einnahmen: cached.filter(t => t.betrag > 0).reduce((sum, t) => sum + t.betrag, 0),
          ausgaben: cached.filter(t => t.betrag < 0).reduce((sum, t) => sum + Math.abs(t.betrag), 0),
        }

        return NextResponse.json({
          ok: true,
          iban: accountIban,
          from: startDate,
          to: endDate,
          cached: true,
          stats,
          transactions: cached.map(t => ({
            _id: t._id?.toString(),
            transactionId: t.transactionId,
            datum: t.datum,
            wertstellungsdatum: t.wertstellungsdatum,
            betrag: t.betrag,
            waehrung: t.waehrung,
            verwendungszweck: t.verwendungszweck,
            gegenkonto: t.gegenkonto,
            gegenkontoIban: t.gegenkontoIban,
            buchungstext: t.buchungstext,
            istZugeordnet: t.istZugeordnet || false,
            zugeordneteRechnung: t.zugeordneteRechnung || null,
            zugeordnetesKonto: t.zugeordnetesKonto || null,
            zuordnungsArt: t.zuordnungsArt || null,
          }))
        })
      }
    }

    // Hole Daten von FinTS
    console.log('[Commerzbank] Fetching fresh data from FinTS...')
    const client = getCommerzbankClient()
    
    const startDateObj = new Date(startDate + 'T00:00:00Z')
    const endDateObj = new Date(endDate + 'T23:59:59Z')
    
    const transactions = await client.getTransactions(accountIban, startDateObj, endDateObj)
    console.log(`[Commerzbank] Received ${transactions.length} transactions from FinTS`)

    // Formatiere und speichere in MongoDB
    const formattedTransactions = transactions.map(t => {
      const formatted = client.formatForFibu(t, 'Commerzbank')
      return {
        ...formatted,
        iban: accountIban,
      }
    })

    console.log(`[Commerzbank] Saving ${formattedTransactions.length} transactions to MongoDB...`)

    // WICHTIG: Zugeordnete Zahlungen (istZugeordnet=true) dürfen NICHT überschrieben werden!
    const transactionIds = formattedTransactions.map(t => t.transactionId)
    const zugeordnete = await collection
      .find({
        transactionId: { $in: transactionIds },
        iban: accountIban,
        istZugeordnet: true
      })
      .project({ transactionId: 1 })
      .toArray()
    
    const zugeordneteIds = new Set(zugeordnete.map(z => z.transactionId))
    
    if (zugeordneteIds.size > 0) {
      console.log(`[Commerzbank] ⚠️ ${zugeordneteIds.size} bereits zugeordnete Transaktionen werden geschützt`)
    }

    // Upsert in MongoDB (basierend auf transactionId + IBAN)
    // WICHTIG: Bewahre User-Daten (Matching) mit $setOnInsert
    const bulkOps = formattedTransactions
      .filter(t => !zugeordneteIds.has(t.transactionId)) // Überspringe zugeordnete! ✅
      .map(t => ({
      updateOne: {
        filter: { 
          transactionId: t.transactionId,
          iban: accountIban
        },
        update: {
          $set: {
            // FinTS-Original-Daten (können aktualisiert werden)
            datum: t.datum,
            datumDate: t.datumDate,
            wertstellungsdatum: t.wertstellungsdatum,
            betrag: t.betrag,
            waehrung: t.waehrung,
            verwendungszweck: t.verwendungszweck,
            gegenkonto: t.gegenkonto,
            gegenkontoIban: t.gegenkontoIban,
            gegenkontoBic: t.gegenkontoBic,
            buchungstext: t.buchungstext,
            buchungsschluessel: t.buchungsschluessel,
            primanota: t.primanota,
            quelle: t.quelle,
            ursprungsdaten: t.ursprungsdaten,
            updated_at: new Date()
          },
          $setOnInsert: {
            // User-Daten (werden nur beim ersten Insert gesetzt)
            transactionId: t.transactionId,
            iban: accountIban,
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
      console.log(`[Commerzbank] MongoDB bulk write: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`)
    }

    // Lade die aktualisierten Daten aus MongoDB (mit Matching-Informationen)
    const startDateTime = new Date(startDate + 'T00:00:00Z')
    const endDateTime = new Date(endDate + 'T23:59:59Z')
    
    const updatedTransactions = await collection
      .find({
        iban: accountIban,
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
      einnahmen: updatedTransactions.filter(t => t.betrag > 0).reduce((sum, t) => sum + t.betrag, 0),
      ausgaben: updatedTransactions.filter(t => t.betrag < 0).reduce((sum, t) => sum + Math.abs(t.betrag), 0),
    }

    return NextResponse.json({
      ok: true,
      iban: accountIban,
      from: startDate,
      to: endDate,
      cached: false,
      stats,
      transactions: updatedTransactions.map(t => ({
        _id: t._id?.toString(),
        transactionId: t.transactionId,
        datum: t.datum,
        wertstellungsdatum: t.wertstellungsdatum,
        betrag: t.betrag,
        waehrung: t.waehrung,
        verwendungszweck: t.verwendungszweck,
        gegenkonto: t.gegenkonto,
        gegenkontoIban: t.gegenkontoIban,
        buchungstext: t.buchungstext,
        istZugeordnet: t.istZugeordnet || false,
        zugeordneteRechnung: t.zugeordneteRechnung || null,
        zugeordnetesKonto: t.zugeordnetesKonto || null,
        zuordnungsArt: t.zuordnungsArt || null,
      }))
    })

  } catch (error) {
    console.error('[Commerzbank] Error:', error)
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
 * POST /api/fibu/zahlungen/commerzbank
 * Hole verfügbare Konten
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'get-accounts') {
      console.log('[Commerzbank] Fetching accounts from FinTS...')
      const client = getCommerzbankClient()
      const accounts = await client.getAccounts()
      
      return NextResponse.json({
        ok: true,
        accounts: accounts.map(acc => ({
          iban: acc.iban,
          bic: acc.bic,
          accountNumber: acc.accountNumber,
          owner: acc.owner,
          type: acc.type,
          currency: acc.currency,
        }))
      })
    }

    return NextResponse.json(
      { ok: false, error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[Commerzbank] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
