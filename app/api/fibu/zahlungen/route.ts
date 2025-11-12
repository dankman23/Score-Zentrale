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
    
    // Hole Zahlungen aus tZahlungseingang (die echte Zahlungstabelle)
    const query = `
      SELECT TOP ${limit}
        z.kZahlungseingang,
        z.kRechnung,
        z.fBetrag AS betrag,
        z.dZeit AS zahlungsdatum,
        ISNULL(z.cHinweis, '') AS hinweis,
        ISNULL(z.cAbgeholt, '') AS abgeholt,
        ISNULL(z.cZahlungsanbieter, 'Unbekannt') AS zahlungsanbieter,
        ISNULL(z.cISO, 'EUR') AS waehrung,
        r.cRechnungsNr AS rechnungsNr,
        r.tKunde_kKunde AS kKunde,
        k.cFirma AS kundenFirma,
        ISNULL(b.kZahlungsart, 0) AS kZahlungsart,
        ISNULL(za.cName, 'Unbekannt') AS zahlungsart
      FROM dbo.tZahlungseingang z
      LEFT JOIN dbo.tRechnung r ON z.kRechnung = r.kRechnung
      LEFT JOIN dbo.tKunde k ON r.tKunde_kKunde = k.kKunde
      LEFT JOIN dbo.tBestellung b ON r.tBestellung_kBestellung = b.kBestellung
      LEFT JOIN dbo.tZahlungsart za ON b.kZahlungsart = za.kZahlungsart
      WHERE z.dZeit >= @from
        AND z.dZeit < @to
      ORDER BY z.dZeit DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    const zahlungen = result.recordset.map((z: any) => ({
      kZahlungseingang: z.kZahlungseingang,
      kRechnung: z.kRechnung,
      rechnungsNr: z.rechnungsNr,
      betrag: parseFloat(z.betrag || 0),
      zahlungsdatum: z.zahlungsdatum,
      hinweis: z.hinweis,
      abgeholt: z.abgeholt,
      zahlungsanbieter: z.zahlungsanbieter,
      zahlungsart: z.zahlungsart,
      kZahlungsart: z.kZahlungsart,
      kKunde: z.kKunde,
      kundenName: z.kundenFirma || `Kunde #${z.kKunde}`,
      waehrung: z.waehrung
    }))
    
    // Speichere in MongoDB
    const db = await getDb()
    const collection = db.collection('fibu_zahlungen')
    
    for (const zahlung of zahlungen.slice(0, limit)) {
      await collection.updateOne(
        { kZahlungseingang: zahlung.kZahlungseingang },
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
