export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { getDb } from '../../../../lib/db/mongodb'
import { getDebitorKonto, getSachkonto, calculateMwStSatz, isGutschrift } from '../../../../lib/fibu-utils'

/**
 * GET /api/fibu/rechnungen/vk/sync
 * Synchronisiert VK-Rechnungen aus JTL mit vollständigen Daten (Kunde, Zahlungen, Beträge)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    
    const pool = await getMssqlPool()
    
    // Schritt 1: Lade Basis-Rechnungen
    const rechnungenQuery = `
      SELECT TOP ${limit}
        r.kRechnung,
        r.cRechnungsNr,
        r.dErstellt AS rechnungsdatum,
        r.tKunde_kKunde AS kKunde,
        r.cBezahlt,
        r.cStatus,
        r.tBestellung_kBestellung AS kBestellung,
        b.kZahlungsart
      FROM dbo.tRechnung r
      LEFT JOIN dbo.tBestellung b ON r.tBestellung_kBestellung = b.kBestellung
      WHERE r.dErstellt >= @from 
        AND r.dErstellt < @to
        AND ISNULL(r.cStatus, '') != 'Storniert'
      ORDER BY r.dErstellt DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(rechnungenQuery)
    
    const rechnungen = []
    
    // Schritt 2: F\u00fcr jede Rechnung, lade Details
    for (const r of result.recordset) {
      try {
        // Lade Kundendaten
        const kundeQuery = await pool.request()
          .input('kKunde', r.kKunde)
          .query(`
            SELECT kKunde, cFirma, cUSTID, cLand
            FROM dbo.tKunde
            WHERE kKunde = @kKunde
          `)
        
        const kunde = kundeQuery.recordset[0] || {
          cFirma: 'Unbekannt',
          cUSTID: null,
          cLand: 'DE'
        }
        
        // Lade Rechnungspositionen f\u00fcr Gesamtsumme
        const posQuery = await pool.request()
          .input('kRechnung', r.kRechnung)
          .query(`
            SELECT 
              SUM(fPreis * nAnzahl) AS netto,
              SUM((fPreis * nAnzahl) * (fMwSt / 100.0)) AS mwst,
              SUM((fPreis * nAnzahl) * (1 + fMwSt / 100.0)) AS brutto
            FROM Verkauf.tRechnungspos
            WHERE kRechnung = @kRechnung
          `)
        
        const betraege = posQuery.recordset[0] || { brutto: 0, netto: 0, mwst: 0 }
        
        // Lade Zahlungsart
        const zahlungsartQuery = await pool.request()
          .input('kZahlungsart', r.kZahlungsart || 0)
          .query(`
            SELECT cName FROM dbo.tZahlungsart WHERE kZahlungsart = @kZahlungsart
          `)
        
        const zahlungsart = zahlungsartQuery.recordset[0]?.cName || 'Unbekannt'
        
        // Berechne Konten
        const hatUstId = kunde.cUSTID && kunde.cUSTID.length > 0
        const kundenLand = kunde.cLand || 'DE'
        const istInnerg = hatUstId && kundenLand !== 'DE'
        const mwstSatz = calculateMwStSatz(betraege.brutto, betraege.netto)
        
        rechnungen.push({
          kRechnung: r.kRechnung,
          cRechnungsNr: r.cRechnungsNr,
          rechnungsdatum: r.rechnungsdatum,
          brutto: parseFloat(betraege.brutto || 0),
          netto: parseFloat(betraege.netto || 0),
          mwst: parseFloat(betraege.mwst || 0),
          mwstSatz,
          status: r.cBezahlt === 'Y' ? 'Bezahlt' : 'Offen',
          kKunde: r.kKunde,
          kundenName: kunde.cFirma,
          kundenLand,
          kundenUstId: kunde.cUSTID || null,
          zahlungsart,
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
      zeitraum: { from, to },
      message: `${rechnungen.length} Rechnungen synchronisiert`
    })
  } catch (error: any) {
    console.error('[VK-Rechnungen Sync] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
