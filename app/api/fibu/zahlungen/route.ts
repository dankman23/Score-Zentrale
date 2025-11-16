export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'
import { getDb } from '../../../lib/db/mongodb'

/**
 * Normalisiert Zahlungsanbieter-Namen
 * Erlaubt nur: PayPal, Amazon Payment, eBay, Mollie, Commerzbank, Otto.de, Postbank
 * Filtert alle Zahlungsarten von Bestellungen (Ratepay, Vorkasse, Rechnung etc.)
 */
function normalizeZahlungsanbieter(anbieter: string, zahlungsart: string, quelle: string): string {
  // Normalisierungs-Map für echte Zahlungsanbieter
  const mapping: { [key: string]: string } = {
    'paypal': 'PayPal',
    'paypal (bank)': 'PayPal',
    'amazon payment': 'Amazon Payment',
    'amazon': 'Amazon Payment',
    'ebay managed payments': 'eBay',
    'ebay (bank)': 'eBay',
    'ebay': 'eBay',
    'mollie': 'Mollie',
    'commerzbank': 'Commerzbank',
    'otto.de': 'Otto.de',
    'otto': 'Otto.de',
    'postbank': 'Postbank'
  }
  
  // Versuche beide Felder
  const check1 = anbieter?.toLowerCase().trim()
  const check2 = zahlungsart?.toLowerCase().trim()
  
  const normalized = mapping[check1] || mapping[check2]
  
  // Falls gefunden, return
  if (normalized) return normalized
  
  // Spezialfall: Postbank/Bank-Quelle
  if (quelle === 'postbank' || quelle === 'Postbank' || quelle === 'tZahlungsabgleichUmsatz') {
    return 'Postbank'
  }
  
  // WICHTIG: Filtere Zahlungsarten von Bestellungen (nicht Zahlungsanbieter!)
  // Diese sollten NICHT als Zahlungsanbieter erscheinen
  const zahlungsartenFilter = [
    'vorkasse', 'rechnung', 'lastschrift', 'überweisung', 
    'ratepay', 'ratenkauf', 'nachnahme', 'bar', 'barzahlung',
    'sofortüberweisung', 'giropay', 'klarna', 'paydirekt',
    'kreditkarte', 'visa', 'mastercard', 'amex'
  ]
  
  if (zahlungsartenFilter.includes(check1) || zahlungsartenFilter.includes(check2)) {
    // Diese sind keine Anbieter, sondern Zahlungsarten
    // Falls aus JTL: ignoriere diese Zahlung
    return null as any
  }
  
  // Fallback: Wenn unklar, dann Postbank
  return 'Postbank'
}

/**
 * GET /api/fibu/zahlungen
 * Lädt alle Zahlungen aus JTL-Wawi für einen Zeitraum
 */
/**
 * DELETE /api/fibu/zahlungen
 * Zuordnung einer Zahlung löschen
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
    const uniqueId = `${quelle}_${zahlungId}`
    
    // Zuordnung löschen (nicht die Zahlung selbst!)
    const updateData = {
      zuordnungsArt: null,
      istZugeordnet: false,
      zugeordnetesKonto: null,
      rechnungsNr: null,
      rechnungsId: null,
      updated_at: new Date()
    }
    
    // Wenn es eine Postbank-Transaktion ist, update auch in fibu_bank_transaktionen
    if (quelle === 'postbank') {
      await db.collection('fibu_bank_transaktionen').updateOne(
        { _id: zahlungId },
        { $set: updateData }
      )
    }
    
    // Update in fibu_zahlungen
    const result = await db.collection('fibu_zahlungen').updateOne(
      { uniqueId },
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
      message: 'Zuordnung erfolgreich gelöscht'
    })
    
  } catch (error: any) {
    console.error('[Zahlungen DELETE] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/fibu/zahlungen
 * Zuordnung einer Zahlung zu Rechnung oder Konto
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { zahlungId, quelle, zuordnungsArt, rechnungsNr, kontonummer } = body
    
    if (!zahlungId || !quelle) {
      return NextResponse.json(
        { ok: false, error: 'zahlungId und quelle sind erforderlich' },
        { status: 400 }
      )
    }
    
    if (!zuordnungsArt || (zuordnungsArt !== 'rechnung' && zuordnungsArt !== 'konto')) {
      return NextResponse.json(
        { ok: false, error: 'zuordnungsArt muss "rechnung" oder "konto" sein' },
        { status: 400 }
      )
    }
    
    if (zuordnungsArt === 'rechnung' && !rechnungsNr) {
      return NextResponse.json(
        { ok: false, error: 'rechnungsNr ist erforderlich bei zuordnungsArt=rechnung' },
        { status: 400 }
      )
    }
    
    if (zuordnungsArt === 'konto' && !kontonummer) {
      return NextResponse.json(
        { ok: false, error: 'kontonummer ist erforderlich bei zuordnungsArt=konto' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const uniqueId = `${quelle}_${zahlungId}`
    
    // Update Zahlung
    const updateData: any = {
      zuordnungsArt,
      istZugeordnet: true,
      updated_at: new Date()
    }
    
    if (zuordnungsArt === 'rechnung') {
      updateData.rechnungsNr = rechnungsNr
      updateData.rechnungsId = rechnungsNr
      updateData.zugeordnetesKonto = null
    } else {
      updateData.zugeordnetesKonto = kontonummer
      updateData.rechnungsNr = null
      updateData.rechnungsId = null
    }
    
    // Wenn es eine Postbank-Transaktion ist, update auch in fibu_bank_transaktionen
    if (quelle === 'postbank') {
      await db.collection('fibu_bank_transaktionen').updateOne(
        { _id: zahlungId },
        { $set: updateData }
      )
    }
    
    // Update in fibu_zahlungen
    const result = await db.collection('fibu_zahlungen').updateOne(
      { uniqueId },
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
      message: 'Zuordnung erfolgreich gespeichert'
    })
    
  } catch (error: any) {
    console.error('[Zahlungen PUT] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const limit = parseInt(searchParams.get('limit') || '1000')
    const reload = searchParams.get('reload') === 'true'  // Nur bei reload=true neu laden
    
    const db = await getDb()
    
    // Prüfe ob Daten bereits in MongoDB vorhanden (Cache)
    if (!reload) {
      const cached = await db.collection('fibu_zahlungen').find({
        zahlungsdatum: {
          $gte: new Date(from + 'T00:00:00.000Z'),
          $lte: new Date(to + 'T23:59:59.999Z')
        }
      }).limit(limit).toArray()
      
      // Lade auch Bank-Transaktionen (Postbank etc.)
      const bankTransaktionen = await db.collection('fibu_bank_transaktionen').find({
        datum: {
          $gte: new Date(from + 'T00:00:00.000Z'),
          $lte: new Date(to + 'T23:59:59.999Z')
        }
      }).limit(limit).toArray()
      
      // Konvertiere Bank-Transaktionen zu Zahlungs-Format
      const bankZahlungen = bankTransaktionen.map((bt: any) => ({
        zahlungsdatum: bt.datum,
        zahlungsanbieter: normalizeZahlungsanbieter(bt.quelle, bt.buchungstext, bt.quelle),
        betrag: bt.betrag,
        hinweis: bt.verwendungszweck,
        zahlungsart: bt.buchungstext,
        quelle: bt.quelle,
        
        // Zuordnungs-Felder
        rechnungsId: bt.matchedRechnungNr || null,
        rechnungsNr: bt.matchedRechnungNr || null,
        kRechnung: 0,
        kundenName: bt.auftraggeber,
        cBestellNr: bt.matchedBestellNr || null,
        istZugeordnet: bt.matchedRechnungNr ? true : false,
        zugeordnetesKonto: bt.zugeordnetesKonto || null, // NEU: Buchungskonto
        zuordnungsArt: bt.matchedRechnungNr ? 'rechnung' : (bt.zugeordnetesKonto ? 'konto' : null), // NEU
        
        // Meta
        _id: bt._id,
        created_at: bt.created_at,
        updated_at: bt.updated_at
      }))
      
      // Kombiniere beide Listen
      const alleZahlungen = [...cached, ...bankZahlungen]
      
      if (alleZahlungen.length > 0) {
        console.log(`[Zahlungen API] Cache hit: ${cached.length} JTL + ${bankZahlungen.length} Bank = ${alleZahlungen.length} gesamt`)
        
        // Statistiken berechnen
        const stats = {
          gesamt: alleZahlungen.length,
          zugeordnet: alleZahlungen.filter((z: any) => z.istZugeordnet || z.kRechnung > 0).length,
          nichtZugeordnet: alleZahlungen.filter((z: any) => !z.istZugeordnet && (!z.kRechnung || z.kRechnung === 0)).length,
          vonTZahlung: alleZahlungen.filter((z: any) => z.quelle === 'tZahlung').length,
          vonZahlungsabgleich: alleZahlungen.filter((z: any) => z.quelle === 'tZahlungsabgleichUmsatz').length,
          vonPostbank: alleZahlungen.filter((z: any) => z.quelle === 'postbank').length
        }
        
        return NextResponse.json({
          ok: true,
          zahlungen: alleZahlungen,
          stats,
          cached: true,
          zeitraum: { from, to }
        })
      }
    }
    
    console.log(`[Zahlungen API] Cache miss - lade aus JTL...`)
    
    // JTL Connection
    const pool = await getJTLConnection()
    
    /**
     * VERBESSERTE ZAHLUNGSABFRAGE MIT ZWEI QUELLEN:
     * 
     * 1. tZahlung: Standard-Zahlungen (PayPal, eBay, Amazon, etc.)
     *    - Rechnungszuordnung über kRechnung ODER kBestellung
     *    - Amazon-Zahlungen haben kRechnung=0, aber kBestellung ist gesetzt
     * 
     * 2. tZahlungsabgleichUmsatz: Bank-Transaktionen (Commerzbank, Überweisungen)
     *    - Zuordnung über cReferenz (z.B. "AU_12345_SW6")
     *    - Diese fehlen komplett in tZahlung
     */
    const query = `
      -- Teil 1: Standard-Zahlungen aus tZahlung (mit beiden Zuordnungswegen)
      SELECT TOP ${limit}
        'tZahlung' AS quelle,
        z.kZahlung AS zahlungsId,
        COALESCE(z.kRechnung, r2.kRechnung, 0) AS kRechnung,
        COALESCE(r.cRechnungsNr, r2.cRechnungsNr, 'Unbekannt') AS rechnungsNr,
        z.fBetrag AS betrag,
        z.dDatum AS zahlungsdatum,
        ISNULL(z.cHinweis, '') AS hinweis,
        ISNULL(za.cName, 'Unbekannt') AS zahlungsart,
        z.kZahlungsart,
        CASE 
          WHEN z.kRechnung IS NOT NULL AND z.kRechnung > 0 THEN 'Direkt (kRechnung)'
          WHEN z.kBestellung IS NOT NULL AND r2.kRechnung IS NOT NULL THEN 'Indirekt (kBestellung)'
          ELSE 'Nicht zugeordnet'
        END AS zuordnungstyp,
        b.cBestellNr,
        COALESCE('Kunde #' + CAST(r.tKunde_kKunde AS VARCHAR), 'Kunde #' + CAST(r2.tKunde_kKunde AS VARCHAR), '') AS kundenName
      FROM dbo.tZahlung z
      -- Direkte Zuordnung über kRechnung
      LEFT JOIN dbo.tRechnung r ON z.kRechnung = r.kRechnung
      -- Indirekte Zuordnung über kBestellung (wichtig für Amazon!)
      LEFT JOIN dbo.tBestellung b ON z.kBestellung = b.kBestellung
      LEFT JOIN dbo.tRechnung r2 ON b.kBestellung = r2.tBestellung_kBestellung
      -- WICHTIG: Externe Belege (XRE-* Rechnungen für Amazon Payment)
      LEFT JOIN Rechnung.tExternerBeleg eb ON z.kBestellung = eb.kExternerBeleg AND eb.nBelegtyp = 0
      -- Zahlungsart
      LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      WHERE z.dDatum >= @from
        AND z.dDatum < DATEADD(day, 1, @to)
      
      UNION ALL
      
      -- Teil 2: Bank-Transaktionen aus tZahlungsabgleichUmsatz (Commerzbank etc.)
      SELECT TOP ${Math.floor(limit / 2)}
        'tZahlungsabgleichUmsatz' AS quelle,
        u.kZahlungsabgleichUmsatz AS zahlungsId,
        COALESCE(r.kRechnung, 0) AS kRechnung,
        COALESCE(r.cRechnungsNr, 'Unbekannt') AS rechnungsNr,
        u.fBetrag AS betrag,
        u.dBuchungsdatum AS zahlungsdatum,
        ISNULL(u.cVerwendungszweck, '') AS hinweis,
        CASE 
          WHEN u.kZahlungsabgleichModul = 1 THEN 'PayPal (Bank)'
          WHEN u.kZahlungsabgleichModul = 5 THEN 'Commerzbank'
          WHEN u.kZahlungsabgleichModul = 7 THEN 'eBay (Bank)'
          ELSE 'Bank-Überweisung'
        END AS zahlungsart,
        0 AS kZahlungsart,
        CASE 
          WHEN r.kRechnung IS NOT NULL THEN 'Via Referenz'
          ELSE 'Nicht zugeordnet'
        END AS zuordnungstyp,
        NULL AS cBestellNr,
        ISNULL(u.cName, '') AS kundenName
      FROM dbo.tZahlungsabgleichUmsatz u
      -- Versuche Zuordnung über cReferenz (z.B. "AU_12345")
      LEFT JOIN dbo.tBestellung b ON u.cReferenz = b.cBestellNr
      LEFT JOIN dbo.tRechnung r ON b.kBestellung = r.tBestellung_kBestellung
      WHERE u.dBuchungsdatum >= @from
        AND u.dBuchungsdatum < DATEADD(day, 1, @to)
        AND u.nSichtbar = 1
      
      ORDER BY zahlungsdatum DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    let zahlungen = result.recordset.map((z: any) => ({
      quelle: z.quelle,
      zahlungsId: z.zahlungsId,
      kRechnung: z.kRechnung,
      rechnungsNr: z.rechnungsNr || 'Unbekannt',
      betrag: parseFloat(z.betrag || 0),
      zahlungsdatum: z.zahlungsdatum,
      hinweis: z.hinweis || '',
      zahlungsart: z.zahlungsart,
      kZahlungsart: z.kZahlungsart,
      kundenName: z.kundenName || '',
      zuordnungstyp: z.zuordnungstyp,
      cBestellNr: z.cBestellNr || '',
      // Belegnummer: Verwende Hinweis oder generiere aus ID
      belegnummer: z.hinweis ? z.hinweis.substring(0, 50) : `${z.quelle}-${z.zahlungsId}`,
      zahlungsanbieter: normalizeZahlungsanbieter(z.zahlungsart, z.zahlungsart, z.quelle),
      istZugeordnet: z.kRechnung > 0,
      zugeordnetesKonto: null, // NEU: wird später aus MongoDB geladen falls vorhanden
      zuordnungsArt: z.kRechnung > 0 ? 'rechnung' : null // NEU
    })).filter((z: any) => z.zahlungsanbieter !== null) // WICHTIG: Filtere ungültige Zahlungsarten
    
    // Lade auch Postbank-Transaktionen
    const postbankCollection = db.collection('fibu_bank_transaktionen')
    const postbankTransaktionen = await postbankCollection.find({
      datum: { $gte: new Date(from), $lte: new Date(to + 'T23:59:59.999Z') }
    }).toArray()
    
    // Konvertiere Postbank-Transaktionen zu Zahlungs-Format
    const postbankZahlungen = postbankTransaktionen.map((t: any) => ({
      quelle: 'postbank',
      zahlungsId: t._id.toString(),
      kRechnung: 0,
      rechnungsNr: t.matchedRechnungNr || 'Unbekannt',
      betrag: t.betrag,
      zahlungsdatum: t.datum,
      hinweis: t.verwendungszweck,
      zahlungsart: t.buchungstext,
      kZahlungsart: 0,
      kundenName: t.auftraggeber,
      zuordnungstyp: t.kategorie || 'Nicht zugeordnet',
      cBestellNr: t.matchedBestellNr || '',
      belegnummer: t.verwendungszweck?.substring(0, 50) || '',
      zahlungsanbieter: normalizeZahlungsanbieter('postbank', t.buchungstext, 'postbank'),
      istZugeordnet: t.matchedRechnungNr ? true : (t.zugeordnetesKonto ? true : false),
      kategorie: t.kategorie,
      zugeordnetesKonto: t.zugeordnetesKonto || null, // NEU
      zuordnungsArt: t.matchedRechnungNr ? 'rechnung' : (t.zugeordnetesKonto ? 'konto' : null) // NEU
    }))
    
    // Kombiniere alle Zahlungen
    zahlungen = [...zahlungen, ...postbankZahlungen]
    
    // Speichere in MongoDB mit eindeutiger ID pro Quelle
    // WICHTIG: Überschreibe NICHT bestehende Zuordnungen!
    const collection = db.collection('fibu_zahlungen')
    
    for (const zahlung of zahlungen) {
      // Eindeutige ID basierend auf Quelle und zahlungsId
      const uniqueId = `${zahlung.quelle}_${zahlung.zahlungsId}`
      
      // Prüfe ob bereits vorhanden
      const existing = await collection.findOne({ uniqueId })
      
      if (existing) {
        // Wenn bereits vorhanden, nur bestimmte Felder aktualisieren
        // NICHT überschreiben: Zuordnungen, manuelle Änderungen
        await collection.updateOne(
          { uniqueId },
          { 
            $set: { 
              // Nur Basis-Daten aktualisieren
              betrag: zahlung.betrag,
              zahlungsdatum: zahlung.zahlungsdatum,
              hinweis: zahlung.hinweis,
              zahlungsart: zahlung.zahlungsart,
              zahlungsanbieter: zahlung.zahlungsanbieter,
              updated_at: new Date()
            }
            // Lasse kRechnung, istZugeordnet, und andere Zuordnungen unverändert
          }
        )
      } else {
        // Neu anlegen
        await collection.insertOne({
          ...zahlung,
          uniqueId,
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    }
    
    // Statistiken
    const stats = {
      gesamt: zahlungen.length,
      zugeordnet: zahlungen.filter(z => z.istZugeordnet).length,
      nichtZugeordnet: zahlungen.filter(z => !z.istZugeordnet).length,
      vonTZahlung: zahlungen.filter(z => z.quelle === 'tZahlung').length,
      vonZahlungsabgleich: zahlungen.filter(z => z.quelle === 'tZahlungsabgleichUmsatz').length
    }
    
    return NextResponse.json({
      ok: true,
      zahlungen,
      stats,
      zeitraum: { from, to }
    })
  } catch (error: any) {
    console.error('[Zahlungen] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
