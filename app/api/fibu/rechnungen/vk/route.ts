export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { getDb } from '../../../../lib/db/mongodb'
import { getDebitorKonto, getSachkonto, calculateMwStSatz, isGutschrift } from '../../../../lib/fibu-utils'

/**
 * GET /api/fibu/rechnungen/vk
 * Lädt VK-Rechnungen aus JTL-Wawi für einen Zeitraum
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    
    const pool = await getMssqlPool()
    
    // Haupt-Query: VK-Rechnungen mit Beträgen und Kundendaten
    const query = `
      SELECT TOP ${limit}
        r.kRechnung,
        r.cRechnungsNr,
        r.dErstellt AS rechnungsdatum,
        r.tKunde_kKunde AS kKunde,
        r.cBezahlt,
        r.cStatus,
        r.tBestellung_kBestellung AS kBestellung,
        b.cBestellNr,
        b.kZahlungsart,
        za.cName AS zahlungsart,
        ISNULL(rv.fGesamtBruttopreis, 0) AS brutto,
        ISNULL(rv.fGesamtNettopreis, 0) AS netto,
        ISNULL(k.cFirma, ISNULL(k.cVorname + ' ' + k.cNachname, 'Unbekannt')) AS kundenName,
        ISNULL(k.cUSTID, '') AS kundenUstId,
        ISNULL(rv.cWaehrung, 'EUR') AS waehrung
      FROM dbo.tRechnung r
      LEFT JOIN dbo.tBestellung b ON r.tBestellung_kBestellung = b.kBestellung
      LEFT JOIN dbo.tZahlungsart za ON b.kZahlungsart = za.kZahlungsart
      LEFT JOIN Verkauf.lvRechnungsverwaltung rv ON r.kRechnung = rv.kRechnung
      LEFT JOIN dbo.tKunde k ON r.tKunde_kKunde = k.kKunde
      WHERE r.dErstellt >= @from 
        AND r.dErstellt < @to
        AND ISNULL(r.cStatus, '') != 'Storniert'
      ORDER BY r.dErstellt DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    // Für jede Rechnung, lade Beträge aus Rechnungspositionen
    const rechnungen = []
    
    for (const r of result.recordset) {
      try {
        // Beträge sind bereits im Query geladen
        const brutto = parseFloat(r.brutto || 0)
        const netto = parseFloat(r.netto || 0)
        const mwst = brutto - netto
        const mwstSatz = netto > 0 ? (mwst / netto) * 100 : 19
        
        // Kundendaten direkt aus tKunde
        const kundenName = r.kundenName || `Kunde #${r.kKunde}`
        const kundenUstId = r.kundenUstId && r.kundenUstId.trim().length > 0 ? r.kundenUstId.trim() : null
        
        // Land aus USt-ID ableiten wenn vorhanden
        let kundenLand = 'DE'
        if (kundenUstId && kundenUstId.length >= 2) {
          kundenLand = kundenUstId.substring(0, 2).toUpperCase()
        }
        
        const hatUstId = kundenUstId !== null
        const istInnerg = hatUstId && kundenLand !== 'DE'
        
        rechnungen.push({
          kRechnung: r.kRechnung,
          cRechnungsNr: r.cRechnungsNr,
          kBestellung: r.kBestellung,
          cBestellNr: r.cBestellNr || '',
          rechnungsdatum: r.rechnungsdatum,
          brutto: parseFloat(brutto.toFixed(2)),
          netto: parseFloat(netto.toFixed(2)),
          mwst: parseFloat(mwst.toFixed(2)),
          mwstSatz: parseFloat(mwstSatz.toFixed(2)),
          status: r.cBezahlt === 'Y' ? 'Bezahlt' : 'Offen',
          kKunde: r.kKunde,
          kundenName,
          kundenLand,
          kundenUstId,
          zahlungsart: r.zahlungsart || 'Unbekannt',
          kZahlungsart: r.kZahlungsart || 0,
          istGutschrift: isGutschrift(r.cRechnungsNr),
          istInnerg,
          debitorKonto: getDebitorKonto(r.kZahlungsart || 0, kundenLand, hatUstId),
          sachkonto: getSachkonto(kundenLand, hatUstId, mwstSatz)
        })
      } catch (err) {
        console.error(`Fehler bei Rechnung ${r.kRechnung}:`, err)
      }
    }
    
    // Speichere in MongoDB
    const db = await getDb()
    const collection = db.collection('fibu_vk_rechnungen')
    
    for (const rechnung of rechnungen) {
      await collection.updateOne(
        { kRechnung: rechnung.kRechnung },
        { 
          $set: { 
            ...rechnung, 
            updated_at: new Date() 
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
    }
    
    return NextResponse.json({
      ok: true,
      rechnungen,
      total: rechnungen.length,
      zeitraum: { from, to }
    })
  } catch (error: any) {
    console.error('[VK-Rechnungen] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
