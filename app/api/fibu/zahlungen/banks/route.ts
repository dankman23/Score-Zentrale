export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { getDb } from '../../../lib/db/mongodb'

// Konto-IDs aus JTL
const BANK_ACCOUNTS = {
  commerzbank: '610000200',
  postbank: '976588501',
}

/**
 * GET /api/fibu/zahlungen/banks
 * Lädt Bank-Transaktionen aus JTL (tZahlungsabgleichUmsatz) und speichert in MongoDB
 * 
 * Query Parameter:
 * - bank: 'commerzbank', 'postbank', oder 'all' (default: 'all')
 * - from: Start-Datum (YYYY-MM-DD)
 * - to: End-Datum (YYYY-MM-DD)
 * - refresh: Optional, wenn true werden Daten neu aus JTL geholt
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bank = searchParams.get('bank') || 'all'
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const refresh = searchParams.get('refresh') === 'true'

    // Standard: Letzter Monat
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Bestimme welche Konten abgefragt werden sollen
    let kontoIds: string[] = []
    let banks: string[] = []
    
    if (bank === 'all') {
      kontoIds = Object.values(BANK_ACCOUNTS)
      banks = Object.keys(BANK_ACCOUNTS)
    } else if (BANK_ACCOUNTS[bank as keyof typeof BANK_ACCOUNTS]) {
      kontoIds = [BANK_ACCOUNTS[bank as keyof typeof BANK_ACCOUNTS]]
      banks = [bank]
    } else {
      return NextResponse.json(
        { ok: false, error: `Unbekannte Bank: ${bank}. Gültig: commerzbank, postbank, all` },
        { status: 400 }
      )
    }

    console.log(`[Banks] Fetching transactions for ${banks.join(', ')} from ${startDate} to ${endDate}`)

    const db = await getDb()
    const results: any = {}

    // Für jede Bank einzeln verarbeiten
    for (const bankName of banks) {
      const kontoId = BANK_ACCOUNTS[bankName as keyof typeof BANK_ACCOUNTS]
      const collectionName = `fibu_${bankName}_transactions`
      const collection = db.collection(collectionName)

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
          console.log(`[Banks/${bankName}] Returning ${cached.length} cached transactions from MongoDB`)
          
          results[bankName] = {
            cached: true,
            count: cached.length,
            stats: {
              gesamtBetrag: cached.reduce((sum, t) => sum + (t.betrag || 0), 0),
              einnahmen: cached.filter(t => t.betrag > 0).reduce((sum, t) => sum + t.betrag, 0),
              ausgaben: cached.filter(t => t.betrag < 0).reduce((sum, t) => sum + Math.abs(t.betrag), 0),
            },
            transactions: cached.map(t => ({
              _id: t._id?.toString(),
              transactionId: t.transactionId,
              datum: t.datum,
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
          }
          continue
        }
      }

      // Hole Daten aus JTL MSSQL
      console.log(`[Banks/${bankName}] Fetching fresh data from JTL...`)
      const pool = await getMssqlPool()
      
      const result = await pool.request()
        .input('kontoId', kontoId)
        .input('startDate', new Date(startDate + 'T00:00:00Z'))
        .input('endDate', new Date(endDate + 'T23:59:59Z'))
        .query(`
          SELECT 
            cKontoIdentifikation,
            cTransaktionID,
            dBuchungsdatum,
            fBetrag,
            cWaehrungISO,
            cName,
            cKonto,
            cVerwendungszweck,
            cReferenz,
            kZahlungsabgleichModul
          FROM tZahlungsabgleichUmsatz
          WHERE cKontoIdentifikation = @kontoId
            AND dBuchungsdatum >= @startDate
            AND dBuchungsdatum <= @endDate
          ORDER BY dBuchungsdatum DESC
        `)

      console.log(`[Banks/${bankName}] Received ${result.recordset.length} transactions from JTL`)

      // Formatiere und speichere in MongoDB
      const formattedTransactions = result.recordset.map((t: any) => ({
        transactionId: t.cTransaktionID,
        datum: t.dBuchungsdatum?.toISOString() || null,
        datumDate: t.dBuchungsdatum || null,
        betrag: t.fBetrag || 0,
        waehrung: t.cWaehrungISO || 'EUR',
        verwendungszweck: t.cVerwendungszweck || '',
        gegenkonto: t.cName || null,
        gegenkontoIban: t.cKonto || null,
        buchungstext: null, // JTL hat kein separates Buchungstext-Feld
        referenz: t.cReferenz || null,
        kontoId: t.cKontoIdentifikation,
        modulId: t.kZahlungsabgleichModul,
        quelle: bankName.charAt(0).toUpperCase() + bankName.slice(1),
        ursprungsdaten: t,
      }))

      // Upsert in MongoDB (bewahre User-Daten)
      const bulkOps = formattedTransactions.map(t => ({
        updateOne: {
          filter: { transactionId: t.transactionId },
          update: {
            $set: {
              // JTL-Original-Daten
              datum: t.datum,
              datumDate: t.datumDate,
              betrag: t.betrag,
              waehrung: t.waehrung,
              verwendungszweck: t.verwendungszweck,
              gegenkonto: t.gegenkonto,
              gegenkontoIban: t.gegenkontoIban,
              buchungstext: t.buchungstext,
              referenz: t.referenz,
              kontoId: t.kontoId,
              modulId: t.modulId,
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
        const writeResult = await collection.bulkWrite(bulkOps)
        console.log(`[Banks/${bankName}] MongoDB: ${writeResult.upsertedCount} inserted, ${writeResult.modifiedCount} updated`)
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

      results[bankName] = {
        cached: false,
        count: updatedTransactions.length,
        stats: {
          gesamtBetrag: updatedTransactions.reduce((sum, t) => sum + (t.betrag || 0), 0),
          einnahmen: updatedTransactions.filter(t => t.betrag > 0).reduce((sum, t) => sum + t.betrag, 0),
          ausgaben: updatedTransactions.filter(t => t.betrag < 0).reduce((sum, t) => sum + Math.abs(t.betrag), 0),
        },
        transactions: updatedTransactions.map(t => ({
          _id: t._id?.toString(),
          transactionId: t.transactionId,
          datum: t.datum,
          betrag: t.betrag,
          waehrung: t.waehrung,
          verwendungszweck: t.verwendungszweck,
          gegenkonto: t.gegenkonto,
          gegenkontoIban: t.gegenkontoIban,
          buchungstext: t.buchungstext,
          referenz: t.referenz,
          istZugeordnet: t.istZugeordnet || false,
          zugeordneteRechnung: t.zugeordneteRechnung || null,
          zugeordnetesKonto: t.zugeordnetesKonto || null,
          zuordnungsArt: t.zuordnungsArt || null,
        }))
      }
    }

    // Gesamtstatistik
    const totalStats = {
      anzahlBanken: banks.length,
      gesamtTransaktionen: Object.values(results).reduce((sum: number, r: any) => sum + r.count, 0),
      gesamtBetrag: Object.values(results).reduce((sum: number, r: any) => sum + r.stats.gesamtBetrag, 0),
      gesamtEinnahmen: Object.values(results).reduce((sum: number, r: any) => sum + r.stats.einnahmen, 0),
      gesamtAusgaben: Object.values(results).reduce((sum: number, r: any) => sum + r.stats.ausgaben, 0),
    }

    return NextResponse.json({
      ok: true,
      from: startDate,
      to: endDate,
      banks: results,
      totalStats
    })

  } catch (error) {
    console.error('[Banks] Error:', error)
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
 * POST /api/fibu/zahlungen/banks
 * Synchronisiert Bank-Transaktionen mit JTL Rechnungen (Auto-Matching)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bank = 'all', from, to, autoMatch = true } = body

    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: 'from und to Parameter sind erforderlich' },
        { status: 400 }
      )
    }

    // Bestimme welche Banken gematcht werden sollen
    let banks: string[] = []
    if (bank === 'all') {
      banks = Object.keys(BANK_ACCOUNTS)
    } else if (BANK_ACCOUNTS[bank as keyof typeof BANK_ACCOUNTS]) {
      banks = [bank]
    } else {
      return NextResponse.json(
        { ok: false, error: `Unbekannte Bank: ${bank}` },
        { status: 400 }
      )
    }

    const db = await getDb()
    const rechnungenCollection = db.collection('fibu_rechnungen_vk')
    const matchResults: any = {}

    for (const bankName of banks) {
      const collectionName = `fibu_${bankName}_transactions`
      const collection = db.collection(collectionName)

      const dateFilter = {
        datumDate: {
          $gte: new Date(from + 'T00:00:00Z'),
          $lte: new Date(to + 'T23:59:59Z')
        }
      }

      const transactions = await collection.find(dateFilter).toArray()
      console.log(`[Banks/${bankName} Sync] Found ${transactions.length} transactions`)

      let matched = 0
      let unmatched = 0

      if (autoMatch) {
        for (const transaction of transactions) {
          let matchedRechnung = null

          // 1. Versuche über Referenz (z.B. "RE2025-97025")
          if (transaction.referenz) {
            const rnMatch = transaction.referenz.match(/RE\d{4}-\d{5}/i)
            if (rnMatch) {
              matchedRechnung = await rechnungenCollection.findOne({
                cRechnungsNr: { $regex: rnMatch[0], $options: 'i' }
              })
            }
          }

          // 2. Versuche über Verwendungszweck
          if (!matchedRechnung && transaction.verwendungszweck) {
            const rnMatch = transaction.verwendungszweck.match(/RE\d{4}-\d{5}/i)
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
            await collection.updateOne(
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

      matchResults[bankName] = {
        total: transactions.length,
        matched,
        unmatched,
        matchRate: transactions.length > 0 ? ((matched / transactions.length) * 100).toFixed(1) + '%' : '0%'
      }
    }

    return NextResponse.json({
      ok: true,
      from,
      to,
      banks: matchResults,
      totalMatched: Object.values(matchResults).reduce((sum: number, r: any) => sum + r.matched, 0),
      totalUnmatched: Object.values(matchResults).reduce((sum: number, r: any) => sum + r.unmatched, 0),
    })

  } catch (error) {
    console.error('[Banks Sync] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
