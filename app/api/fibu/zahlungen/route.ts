export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'
import { getDb } from '../../../lib/db/mongodb'

/**
 * GET /api/fibu/zahlungen
 * Lädt alle Zahlungen aus JTL-Wawi für einen Zeitraum
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    // Dynamische Datumsbereiche - Standard: gesamter Zeitraum
    const from = searchParams.get('from') || '2020-01-01'
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '10000', 10)
    
    const pool = await getMssqlPool()
    
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
      zahlungsanbieter: z.zahlungsart,
      istZugeordnet: z.kRechnung > 0
    }))
    
    // Lade auch Postbank-Transaktionen
    const db = await getDb()
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
      zahlungsart: t.kategorie === 'gehalt' ? 'Gehalt' : t.buchungstext,
      kZahlungsart: 0,
      kundenName: t.auftraggeber,
      zuordnungstyp: t.kategorie || 'Nicht zugeordnet',
      cBestellNr: t.matchedBestellNr || '',
      belegnummer: t.verwendungszweck?.substring(0, 50) || '',
      zahlungsanbieter: t.kategorie === 'gehalt' ? 'Gehalt' : 'Postbank',
      istZugeordnet: false,
      kategorie: t.kategorie
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
