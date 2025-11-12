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
      SELECT 
        r.kRechnung,
        r.cRechnungsNr,
        r.dErstellt AS rechnungsdatum,
        r.fGesamtsumme AS brutto,
        r.fWarensumme AS netto,
        r.fMwSt,
        r.cStatus,
        r.kKunde,
        k.cFirma AS kundenName,
        ISNULL(k.cUSTID, '') AS kundenUstId,
        ISNULL(k.cLand, 'DE') AS kundenLand,
        ISNULL(za.cName, 'Unbekannt') AS zahlungsart,
        ISNULL(r.kZahlungsart, 0) AS kZahlungsart
      FROM dbo.tRechnung r
      LEFT JOIN dbo.tKunde k ON r.kKunde = k.kKunde
      LEFT JOIN dbo.tZahlungsart za ON r.kZahlungsart = za.kZahlungsart
      WHERE r.dErstellt >= @from 
        AND r.dErstellt < @to
        AND r.cStatus != 'Storniert'
      ORDER BY r.dErstellt DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    const rechnungen = result.recordset.map((r: any) => {
      const hatUstId = r.kundenUstId && r.kundenUstId.length > 0
      const istInnerg = hatUstId && r.kundenLand !== 'DE'
      const mwstSatz = calculateMwStSatz(r.brutto, r.netto)
      
      return {
        kRechnung: r.kRechnung,
        cRechnungsNr: r.cRechnungsNr,
        rechnungsdatum: r.rechnungsdatum,
        brutto: parseFloat(r.brutto || 0),
        netto: parseFloat(r.netto || 0),
        mwst: parseFloat(r.fMwSt || 0),
        mwstSatz,
        status: r.cStatus,
        kKunde: r.kKunde,
        kundenName: r.kundenName,
        kundenLand: r.kundenLand,
        kundenUstId: r.kundenUstId || null,
        zahlungsart: r.zahlungsart,
        kZahlungsart: r.kZahlungsart,
        istGutschrift: isGutschrift(r.cRechnungsNr),
        istInnerg,
        // Automatische Kontenzuordnung
        debitorKonto: getDebitorKonto(r.kZahlungsart, r.kundenLand, hatUstId),
        sachkonto: getSachkonto(r.kundenLand, hatUstId, mwstSatz)
      }
    })
    
    // Speichere in MongoDB für spätere Verarbeitung
    const db = await getDb()
    const collection = db.collection('fibu_vk_rechnungen')
    
    for (const rechnung of rechnungen.slice(0, limit)) {
      await collection.updateOne(
        { kRechnung: rechnung.kRechnung, typ: rechnung.typ },
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
