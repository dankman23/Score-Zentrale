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
    
    const pool = await getMSSQLConnection()
    
    const query = `
      SELECT
        z.kZahlung,
        z.kRechnung,
        z.fBetrag AS betrag,
        z.dZeit AS zahlungsdatum,
        ISNULL(z.cHinweis, '') AS verwendungszweck,
        ISNULL(z.kZahlungsart, 0) AS kZahlungsart,
        ISNULL(za.cName, 'Unbekannt') AS zahlungsart,
        ISNULL(za.cModulId, '') AS zahlungsart_modul,
        r.cRechnungsNr AS rechnungsNr
      FROM dbo.tZahlung z
      LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      LEFT JOIN dbo.tRechnung r ON z.kRechnung = r.kRechnung
      WHERE z.dZeit >= @from
        AND z.dZeit < @to
      ORDER BY z.dZeit DESC
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
      verwendungszweck: z.verwendungszweck,
      zahlungsart: z.zahlungsart,
      kZahlungsart: z.kZahlungsart,
      zahlungsart_modul: z.zahlungsart_modul
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
