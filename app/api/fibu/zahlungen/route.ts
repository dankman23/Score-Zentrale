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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '500')
    const limit = parseInt(searchParams.get('limit') || '0') // 0 = kein Limit (alle laden)

    // Standard: Letzter Monat
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`[Zahlungen NEU] Loading from ${startDate} to ${endDate}, anbieter: ${anbieter || 'all'}`)

    const db = await getDb()
    const startDateTime = new Date(startDate + 'T00:00:00Z')
    const endDateTime = new Date(endDate + 'T23:59:59Z')
    
    // FIBU-Modul: Nur Daten ab Oktober 2025
    const minDate = new Date('2025-10-01T00:00:00Z')
    
    // Lade Rechnungen für Auto-Matching (für PayPal AU-Nummern)
    const vkRechnungen = db.collection('fibu_vk_rechnungen')
    const rechnungenMap = new Map()
    
    // Lade alle Rechnungen mit cBestellNr für schnelles Lookup
    const rechnungenDocs = await vkRechnungen.find({
      cBestellNr: { $exists: true, $ne: null, $ne: '' }
    }, {
      projection: { cBestellNr: 1, cRechnungsNr: 1, brutto: 1 }
    }).toArray()
    
    rechnungenDocs.forEach(r => {
      rechnungenMap.set(r.cBestellNr, {
        rechnungsNr: r.cRechnungsNr,
        betrag: r.brutto
      })
    })
    
    console.log(`[Zahlungen] Rechnungen geladen für Auto-Matching: ${rechnungenMap.size}`)
    
    // Prüfe ob Zeitraum vor Oktober 2025
    if (endDateTime < minDate) {
      console.log(`[Zahlungen] Zeitraum liegt vor Oktober 2025 (${startDate} - ${endDate})`)
      return NextResponse.json({
        ok: true,
        from: startDate,
        to: endDate,
        stats: { gesamt: 0, gesamtsumme: 0, anbieter: {} },
        zahlungen: [],
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        info: 'FIBU-Modul enthält nur Daten ab Oktober 2025'
      })
    }
    
    // Wenn Start vor Oktober, beginne bei Oktober
    const effectiveStartDate = startDateTime < minDate ? minDate : startDateTime

    const dateFilter = {
      datumDate: {
        $gte: effectiveStartDate,
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
      { name: 'Amazon', collection: 'fibu_amazon_settlements' },
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
      
      // Erweitere Filter für Mollie: nur erfolgreiche Transaktionen
      let query = { ...dateFilter }
      if (source.name === 'Mollie') {
        query = {
          ...dateFilter,
          status: { $in: ['paid', 'authorized'] }  // Nur bezahlte/autorisierte Transaktionen
        }
      }
      
      const payments = await collection
        .find(query)
        .sort({ datumDate: -1 })
        .toArray()

      console.log(`[Zahlungen] ${source.name}: ${payments.length} Transaktionen`)

      // Formatiere einheitlich mit Fokus auf Zuordnung
      const formatted = payments.map(p => {
        // Basis-Felder
        let verwendungszweck = p.verwendungszweck || p.beschreibung || p.betreff || ''
        let gegenkonto = p.gegenkonto || p.kundenName || ''
        let referenz = ''  // Haupt-Referenz für Matching (Auftragsnummer, Order-ID)
        let transaktionsId = p.transactionId || p._id?.toString() || ''
        let sku = null
        let kategorie = null
        
        // AUTO-ZUORDNUNG: Amazon-Transaktionen werden automatisch zugeordnet (nur wenn noch nicht zugeordnet)
        let autoZugeordnet = false
        let autoGegenkonto = null
        let autoZuordnungsArt = null
        
        // Anbieter-spezifische Anpassungen
        if (source.name === 'Amazon') {
          // Amazon: Order-ID als Referenz, amountType als Kategorie
          referenz = p.orderId || p.merchantOrderId || ''
          kategorie = p.amountType || ''  // ItemPrice, ItemFees, etc.
          verwendungszweck = p.amountDescription || ''
          gegenkonto = ''  // Amazon hat keinen Kundennamen
          sku = p.sku || ''
          transaktionsId = p.transactionId || ''
          
          // AUTO-ZUORDNUNG für Amazon basierend auf amountType (nur wenn noch NICHT zugeordnet)
          if (!p.istZugeordnet) {
            const amountTypeKey = (p.amountType || '').split('/').pop() // z.B. "Order/ItemPrice/Principal" → "Principal"
            
            if (amountTypeKey === 'Principal' || p.amountType?.includes('ItemPrice')) {
              autoZugeordnet = true
              autoGegenkonto = '69001'  // Umsatzerlöse
              autoZuordnungsArt = 'Amazon Erlös (Principal)'
            } else if (amountTypeKey === 'Commission' || p.amountType?.includes('ItemFees/Commission')) {
              autoZugeordnet = true
              autoGegenkonto = '6770'  // Amazon Kommission
              autoZuordnungsArt = 'Amazon Gebühr (Kommission)'
            } else if (amountTypeKey === 'Shipping' || p.amountType?.includes('Shipping')) {
              autoZugeordnet = true
              autoGegenkonto = '4800'  // Versanderlöse
              autoZuordnungsArt = 'Amazon Versand'
            } else if (p.amountType?.includes('Tax')) {
              autoZugeordnet = true
              autoGegenkonto = '1776'  // Umsatzsteuer
              autoZuordnungsArt = 'Amazon Steuer'
            } else if (p.amountType?.includes('MarketplaceFacilitatorVAT')) {
              autoZugeordnet = true
              autoGegenkonto = '1370'  // Abziehbare Vorsteuer
              autoZuordnungsArt = 'Amazon MwSt (von Amazon abgeführt)'
            } else if (p.amountType?.includes('FBA')) {
              autoZugeordnet = true
              autoGegenkonto = '4950'  // FBA Gebühren
              autoZuordnungsArt = 'Amazon FBA Gebühr'
            } else if (p.amountType?.includes('Refund')) {
              autoZugeordnet = true
              autoGegenkonto = '69001'  // Rückerstattungen gegen Erlöse
              autoZuordnungsArt = 'Amazon Rückerstattung'
            } else if (p.amountType?.includes('Transfer')) {
              autoZugeordnet = true
              autoGegenkonto = '1200'  // Forderungen
              autoZuordnungsArt = 'Amazon Transfer/Auszahlung'
            } else if (p.transactionType === 'other-transaction') {
              autoZugeordnet = true
              autoGegenkonto = '6855'  // Sonstige Aufwendungen
              autoZuordnungsArt = 'Amazon Sonstige Transaktion'
            } else {
              // Fallback: Unbekannte Amazon-Transaktionen werden auch zugeordnet
              autoZugeordnet = true
              autoGegenkonto = '1815'  // Amazon Settlement-Konto (neutral)
              autoZuordnungsArt = 'Amazon (automatisch zugeordnet)'
            }
          }
          
        } else if (source.name === 'Mollie') {
          // Mollie: AU-Nummer aus Verwendungszweck extrahieren
          const auMatch = verwendungszweck.match(/AU_\d+_SW\d+/)
          referenz = auMatch ? auMatch[0] : ''
          transaktionsId = p.transactionId || ''
          // gegenkonto bleibt wie in Basis-Init (p.gegenkonto || p.kundenName)
          
        } else if (source.name === 'PayPal') {
          // PayPal: rechnungsNr (AU-Nummer) als Referenz, kundenName als Gegenkonto
          referenz = p.rechnungsNr || ''  // AU_12450_SW6
          transaktionsId = p.transactionId || ''
          gegenkonto = p.kundenName || ''  // Kundenname
          verwendungszweck = p.betreff || p.rechnungsNr || ''  // Betreff oder AU-Nummer als Fallback
          
          // AUTO-ZUORDNUNG für PayPal über AU-Nummer (nur wenn noch nicht zugeordnet)
          if (!p.istZugeordnet) {
            if (referenz && referenz.match(/^AU_\d+_SW\d+$/)) {
              // Prüfe ob Rechnung mit dieser AU-Nummer existiert
              const rechnung = rechnungenMap.get(referenz)
              
              if (rechnung) {
                // Perfektes Match: AU-Nummer + Rechnung gefunden
                autoZugeordnet = true
                autoGegenkonto = '69012'  // Paypal-Erlöskonto (Sammelkonto)
                autoZuordnungsArt = 'rechnung'  // Typ für Rechnungszuordnung
                // Speichere auch die zugeordnete Rechnung
                p.zugeordneteRechnung = rechnung.rechnungsNr
              } else {
                // AU-Nummer vorhanden, aber keine Rechnung gefunden
                autoZugeordnet = true
                autoGegenkonto = '69012'
                autoZuordnungsArt = 'PayPal Zahlung (AU-Nummer, keine Rechnung)'
              }
            } else if (p.betrag < 0) {
              // Negative PayPal-Beträge (Gebühren, Einkäufe)
              autoZugeordnet = true
              autoGegenkonto = '6855'  // Sonstige Aufwendungen
              autoZuordnungsArt = 'PayPal Gebühr/Einkauf'
            }
          }
          
        } else if (source.name === 'Commerzbank' || source.name === 'Postbank') {
          // Bank: Verwendungszweck durchsuchen nach Mustern
          // Suche nach RE2025-xxxxx (Rechnungsnummer) oder AU-xxxxx (Auftragsnummer)
          const reMatch = verwendungszweck.match(/RE\d{4}-\d+/)
          const auMatch = verwendungszweck.match(/AU[-_\s]?\d+[-_\s]?SW\d+/i)
          
          // Normalisiere AU-Nummer zum Standard-Format AU_12345_SW6
          if (auMatch) {
            const cleaned = auMatch[0].replace(/\s/g, '').replace(/AU/i, 'AU_').replace(/SW/i, '_SW')
            // Stelle sicher, dass Format korrekt ist: AU_xxxxx_SWx
            referenz = cleaned.includes('_') ? cleaned : cleaned.replace(/AU_(\d+)SW/, 'AU_$1_SW')
          } else {
            referenz = reMatch ? reMatch[0] : ''
          }
          transaktionsId = p.transactionId || p._id?.toString() || ''
          
          // AUTO-ZUORDNUNG für Bank-Transaktionen
          if (!p.istZugeordnet) {
            if (referenz && referenz.match(/^AU_\d+_SW\d+$/)) {
              // AU-Nummer gefunden - prüfe Rechnung
              const rechnung = rechnungenMap.get(referenz)
              
              if (rechnung) {
                autoZugeordnet = true
                autoGegenkonto = '69012'  // Erlöskonto
                autoZuordnungsArt = 'rechnung'
                p.zugeordneteRechnung = rechnung.rechnungsNr
              } else {
                autoZugeordnet = true
                autoGegenkonto = '69012'
                autoZuordnungsArt = 'Bank Eingang (AU-Nummer, keine Rechnung)'
              }
            } else if (p.betrag < 0) {
              // Negative Beträge: Wahrscheinlich Lieferantenrechnungen
              // Prüfe ob Kreditor bekannt ist
              const lieferant = p.gegenkonto || ''
              if (lieferant && lieferant.length > 3) {
                autoZugeordnet = true
                autoGegenkonto = '70000'  // Kreditorenkonto (Wareneingang)
                autoZuordnungsArt = 'Lieferantenrechnung (Kreditor: ' + lieferant + ')'
              } else {
                autoZugeordnet = true
                autoGegenkonto = '6855'  // Sonstige Aufwendungen
                autoZuordnungsArt = 'Bank Ausgang (Sonstige)'
              }
            } else if (p.betrag > 0 && !referenz) {
              // Positive Beträge ohne Referenz
              autoZugeordnet = true
              autoGegenkonto = '69012'  // Erlöskonto
              autoZuordnungsArt = 'Bank Eingang (ohne Referenz)'
            }
          }
        }
        
        return {
          _id: p._id?.toString(),
          
          // Haupt-Identifikatoren (für Matching)
          transaktionsId,  // Eindeutige Transaction-ID
          referenz,  // Auftragsnummer / Order-ID für Matching
          
          // Basis-Daten
          datum: p.datum,
          betrag: p.betrag || 0,
          waehrung: p.waehrung || 'EUR',
          anbieter: source.name,
          quelle: source.collection,
          
          // Beschreibung & Details
          verwendungszweck,
          gegenkonto,
          gegenkontoIban: p.gegenkontoIban || null,
          kundenEmail: p.kundenEmail || null,
          
          // Gebühren & Kategorien (wichtig für Kontenzuordnung)
          gebuehr: p.gebuehr || null,
          kategorie: kategorie || null,
          methode: p.methode || null,
          status: p.status || null,
          
          // Amazon-spezifisch
          sku: sku || null,
          
          // Buchungsinformationen
          buchung: p.buchung || null,
          
          // Zuordnung zu Rechnungen (mit Auto-Zuordnung)
          istZugeordnet: p.istZugeordnet || autoZugeordnet,
          zugeordneteRechnung: p.zugeordneteRechnung || null,
          zugeordnetesKonto: p.zugeordnetesKonto || autoGegenkonto,
          zuordnungsArt: p.zuordnungsArt || autoZuordnungsArt,
          zuordnungsDatum: p.zuordnungsDatum || (autoZugeordnet ? new Date().toISOString() : null),
          zuordnungsMethode: p.zuordnungsMethode || (autoZugeordnet ? 'auto-amazon-type' : null),
          
          // Abweichungen (für Teilzahlungen, Skonto, Währung)
          abweichungsgrund: p.abweichungsgrund || null,
          abweichungsBetrag: p.abweichungsBetrag || null,
          zuordnungsNotiz: p.zuordnungsNotiz || null,
        }
      })

      allPayments.push(...formatted)

      // Stats
      stats.anbieter[source.name] = {
        anzahl: formatted.length,
        summe: formatted.reduce((sum, p) => sum + p.betrag, 0)
      }
    }

    // Sortiere nach Datum
    allPayments.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())

    // Berechne Gesamt-Stats VOR Pagination
    const totalCount = allPayments.length
    const totalSum = allPayments.reduce((sum, p) => sum + p.betrag, 0)
    const zugeordnetCount = allPayments.filter(p => p.istZugeordnet).length
    const nichtZugeordnetCount = totalCount - zugeordnetCount
    
    stats.gesamt = totalCount
    stats.gesamtsumme = totalSum
    stats.zuordnung = {
      zugeordnet: zugeordnetCount,
      zugeordnetProzent: totalCount > 0 ? Math.round((zugeordnetCount / totalCount) * 100) : 0,
      nichtZugeordnet: nichtZugeordnetCount,
      nichtZugeordnetProzent: totalCount > 0 ? Math.round((nichtZugeordnetCount / totalCount) * 100) : 0
    }

    // Pagination anwenden
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedPayments = limit > 0 
      ? allPayments.slice(0, limit) 
      : allPayments.slice(startIndex, endIndex)
    
    const totalPages = limit > 0 
      ? 1 
      : Math.ceil(totalCount / pageSize)

    console.log(`[Zahlungen] Gesamt: ${totalCount} Transaktionen, Seite ${page}/${totalPages}, ${Object.keys(stats.anbieter).length} Anbieter`)

    return NextResponse.json({
      ok: true,
      from: startDate,
      to: endDate,
      stats,
      zahlungen: paginatedPayments,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
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
