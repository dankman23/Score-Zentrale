export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { getDb } from '../../../lib/db/mongodb'

/**
 * GET /api/fibu/zahlungen
 * Lädt alle Zahlungen aus JTL-Wawi für einen Zeitraum
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const limit = parseInt(searchParams.get('limit') || '500', 10)
    
    const pool = await getMssqlPool()
    
    // Hole Zahlungen aus tZahlung mit erweitertenInfos
    const query = `
      SELECT TOP ${limit}
        z.kZahlung,
        z.kRechnung,
        z.fBetrag AS betrag,
        z.dDatum AS zahlungsdatum,
        ISNULL(z.cHinweis, '') AS hinweis,
        ISNULL(z.cZahlungsanbieter, 'Unbekannt') AS zahlungsanbieter,
        ISNULL(z.cISO, 'EUR') AS waehrung,
        ISNULL(z.kZahlungsart, 0) AS kZahlungsart,
        r.cRechnungsNr AS rechnungsNr,
        'Kunde #' + CAST(r.tKunde_kKunde AS VARCHAR) AS kundenName,
        ISNULL(za.cName, 'Unbekannt') AS zahlungsart
      FROM dbo.tZahlung z
      LEFT JOIN dbo.tRechnung r ON z.kRechnung = r.kRechnung
      LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      WHERE z.dDatum >= @from
        AND z.dDatum < @to
      ORDER BY z.dDatum DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    const zahlungen = result.recordset.map((z: any) => ({
      kZahlung: z.kZahlung,
      kRechnung: z.kRechnung,
      rechnungsNr: z.rechnungsNr,
      betrag: parseFloat(z.betrag || 0),
      zahlungsdatum: z.zahlungsdatum,
      hinweis: z.hinweis,
      zahlungsanbieter: z.zahlungsanbieter || 'Manuell',
      zahlungsart: z.zahlungsart,
      kZahlungsart: z.kZahlungsart,
      kundenName: z.kundenName,
      waehrung: z.waehrung,
      // Echte Belegnummer aus Hinweis extrahieren oder generieren
      belegnummer: z.hinweis || `ZE-${z.kZahlung}`
    }))
    
    // Speichere in MongoDB
    const db = await getDb()
    const collection = db.collection('fibu_zahlungen')
    
    for (const zahlung of zahlungen.slice(0, limit)) {
      await collection.updateOne(
        { kZahlung: zahlung.kZahlung },
        { 
          $set: { 
            ...zahlung, 
            updated_at: new Date() 
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
    }
    
    return NextResponse.json({
      ok: true,
      zahlungen: zahlungen.slice(0, limit),
      total: zahlungen.length,
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
