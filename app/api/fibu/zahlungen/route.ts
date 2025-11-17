export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

/**
 * NEUE Zahlungen API - holt NUR von echten Zahlungsquellen
 * NICHT mehr aus JTL tZahlungsabgleichUmsatz (zu viele Zahlungsarten)
 * 
 * Quellen:
 * 1. PayPal API (fibu_paypal_transactions)
 * 2. Commerzbank (fibu_commerzbank_transactions)
 * 3. Postbank (fibu_postbank_transactions)
 * 4. Mollie (fibu_mollie_transactions)
 * 5. Amazon Settlements (optional später)
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const anbieter = searchParams.get('anbieter') // z.B. 'paypal', 'commerzbank', 'all'
    const limit = parseInt(searchParams.get('limit') || '1000')

    // Standard: Letzter Monat
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`[Zahlungen NEU] Loading from ${startDate} to ${endDate}, anbieter: ${anbieter || 'all'}`)

    const db = await getDb()
    const startDateTime = new Date(startDate + 'T00:00:00Z')
    const endDateTime = new Date(endDate + 'T23:59:59Z')

    const dateFilter = {
      datumDate: {
        $gte: startDateTime,
        $lte: endDateTime
      }
    }

    let allPayments: any[] = []
    const stats: any = {
      gesamt: 0,
      anbieter: {}
    }

    // Sammle von allen Quellen
    const sources = [
      { name: 'PayPal', collection: 'fibu_paypal_transactions' },
      { name: 'Commerzbank', collection: 'fibu_commerzbank_transactions' },
      { name: 'Postbank', collection: 'fibu_postbank_transactions' },
      { name: 'Mollie', collection: 'fibu_mollie_transactions' },
    ]

    for (const source of sources) {
      // Filter nach Anbieter wenn angegeben
      if (anbieter && anbieter !== 'all' && anbieter.toLowerCase() !== source.name.toLowerCase()) {
        continue
      }

      const collection = db.collection(source.collection)
      const payments = await collection
        .find(dateFilter)
        .sort({ datumDate: -1 })
        .limit(limit)
        .toArray()

      console.log(`[Zahlungen] ${source.name}: ${payments.length} Transaktionen`)

      // Formatiere einheitlich
      const formatted = payments.map(p => ({
        _id: p._id?.toString(),
        zahlungId: p.transactionId || p._id?.toString(),
        datum: p.datum,
        betrag: p.betrag || 0,
        waehrung: p.waehrung || 'EUR',
        anbieter: source.name,
        quelle: source.collection,
        
        // Details je nach Quelle
        verwendungszweck: p.verwendungszweck || p.beschreibung || p.betreff || '',
        gegenkonto: p.gegenkonto || p.kundenName || '',
        gegenkontoIban: p.gegenkontoIban || null,
        
        // PayPal spezifisch
        kundenEmail: p.kundenEmail || null,
        gebuehr: p.gebuehr || null,
        
        // Mollie spezifisch
        methode: p.methode || null,
        status: p.status || null,
        
        // Zuordnung
        istZugeordnet: p.istZugeordnet || false,
        zugeordneteRechnung: p.zugeordneteRechnung || null,
        zugeordnetesKonto: p.zugeordnetesKonto || null,
        zuordnungsArt: p.zuordnungsArt || null,
      }))

      allPayments.push(...formatted)

      // Stats
      stats.anbieter[source.name] = {
        anzahl: formatted.length,
        summe: formatted.reduce((sum, p) => sum + p.betrag, 0)
      }
    }

    // Sortiere nach Datum
    allPayments.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())

    // Limit anwenden
    if (allPayments.length > limit) {
      allPayments = allPayments.slice(0, limit)
    }

    stats.gesamt = allPayments.length
    stats.gesamtsumme = allPayments.reduce((sum, p) => sum + p.betrag, 0)

    console.log(`[Zahlungen] Gesamt: ${stats.gesamt} Transaktionen, ${Object.keys(stats.anbieter).length} Anbieter`)

    return NextResponse.json({
      ok: true,
      from: startDate,
      to: endDate,
      stats,
      zahlungen: allPayments
    })

  } catch (error) {
    console.error('[Zahlungen] Error:', error)
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
 * PUT /api/fibu/zahlungen
 * Zuordnung einer Zahlung zu Rechnung/Konto
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { zahlungId, quelle, zuordnung } = body

    if (!zahlungId || !quelle) {
      return NextResponse.json(
        { ok: false, error: 'zahlungId und quelle sind erforderlich' },
        { status: 400 }
      )
    }

    const db = await getDb()
    const collection = db.collection(quelle)

    const updateData = {
      istZugeordnet: true,
      zugeordneteRechnung: zuordnung.rechnungsNr || null,
      zugeordnetesKonto: zuordnung.kontoNr || null,
      zuordnungsArt: zuordnung.art || 'manuell',
      updated_at: new Date()
    }

    const result = await collection.updateOne(
      { transactionId: zahlungId },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { ok: false, error: 'Zahlung nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Zuordnung gespeichert'
    })

  } catch (error) {
    console.error('[Zahlungen PUT] Error:', error)
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
 * DELETE /api/fibu/zahlungen
 * Zuordnung löschen
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const zahlungId = searchParams.get('zahlungId')
    const quelle = searchParams.get('quelle')

    if (!zahlungId || !quelle) {
      return NextResponse.json(
        { ok: false, error: 'zahlungId und quelle sind erforderlich' },
        { status: 400 }
      )
    }

    const db = await getDb()
    const collection = db.collection(quelle)

    const updateData = {
      istZugeordnet: false,
      zugeordneteRechnung: null,
      zugeordnetesKonto: null,
      zuordnungsArt: null,
      updated_at: new Date()
    }

    const result = await collection.updateOne(
      { transactionId: zahlungId },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { ok: false, error: 'Zahlung nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Zuordnung gelöscht'
    })

  } catch (error) {
    console.error('[Zahlungen DELETE] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
