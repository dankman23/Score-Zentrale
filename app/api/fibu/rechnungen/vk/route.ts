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
    const limit = parseInt(searchParams.get('limit') || '500', 10)
    
    const pool = await getMssqlPool()
    
    // Haupt-Query: VK-Rechnungen  
    const query = `
      SELECT TOP ${limit}
        r.kRechnung,
        r.cRechnungsNr,
        r.dErstellt AS rechnungsdatum,
        r.tKunde_kKunde AS kKunde,
        r.cBezahlt,
        r.cStatus,
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
      .query(query)
    
    const rechnungen = result.recordset.map((r: any) => {
      // Kundendaten müssen separat geladen werden
      const hatUstId = false // Wird später ergänzt
      const istInnerg = false
      const mwstSatz = calculateMwStSatz(r.brutto, r.netto)
      const kundenLand = 'DE' // Default, wird später ergänzt
      
      return {
        kRechnung: r.kRechnung,
        cRechnungsNr: r.cRechnungsNr,
        rechnungsdatum: r.rechnungsdatum,
        brutto: parseFloat(r.brutto || 0),
        netto: parseFloat(r.netto || 0),
        mwst: parseFloat(r.fMwSt || 0),
        mwstSatz,
        status: r.cBezahlt === 'Y' ? 'Bezahlt' : 'Offen',
        kKunde: r.kKunde,
        kundenName: 'Kunde #' + r.kKunde, // Wird später ergänzt
        kundenLand,
        kundenUstId: null,
        zahlungsart: 'TBD', // Wird später ergänzt
        kZahlungsart: r.kZahlungsart,
        istGutschrift: isGutschrift(r.cRechnungsNr),
        istInnerg,
        // Automatische Kontenzuordnung
        debitorKonto: getDebitorKonto(r.kZahlungsart, kundenLand, hatUstId),
        sachkonto: getSachkonto(kundenLand, hatUstId, mwstSatz)
      }
    })
    
    // Speichere in MongoDB für spätere Verarbeitung
    const db = await getDb()
    const collection = db.collection('fibu_vk_rechnungen')
    
    for (const rechnung of rechnungen.slice(0, limit)) {
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
      rechnungen: rechnungen.slice(0, limit),
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
