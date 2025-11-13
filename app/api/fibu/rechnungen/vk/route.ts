export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSqlConnection } from '../../../lib/db/mssql'

/**
 * GET /api/fibu/rechnungen/vk
 * Lädt VK-Rechnungen aus JTL MSSQL
 * 
 * Query-Parameter:
 * - from: Startdatum (YYYY-MM-DD)
 * - to: Enddatum (YYYY-MM-DD)
 * - limit: Max. Anzahl (default: 1000)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'
    const limit = parseInt(searchParams.get('limit') || '1000')
    
    const pool = await getSqlConnection()
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(`
        SELECT TOP ${limit}
          r.kRechnung,
          r.cRechnungsNr,
          r.dErstellt,
          r.fGesamtsumme,
          r.fWarensumme,
          r.fVersandkosten,
          k.cFirma,
          k.cLand,
          CASE
            WHEN EXISTS (SELECT 1 FROM tZahlung z WHERE z.kRechnung = r.kRechnung) THEN 'Bezahlt'
            ELSE 'Offen'
          END as status
        FROM tRechnung r
        LEFT JOIN tKunde k ON r.kKunde = k.kKunde
        WHERE r.dErstellt >= @from
          AND r.dErstellt < DATEADD(day, 1, CAST(@to as date))
        ORDER BY r.dErstellt DESC
      `)
    
    const rechnungen = result.recordset.map(r => ({
      id: r.kRechnung.toString(),
      rechnungsNr: r.cRechnungsNr,
      datum: r.dErstellt,
      kunde: r.cFirma || 'Unbekannt',
      land: r.cLand,
      betrag: r.fGesamtsumme,
      warenwert: r.fWarensumme,
      versandkosten: r.fVersandkosten,
      status: r.status
    }))
    
    return NextResponse.json({
      ok: true,
      rechnungen,
      total: rechnungen.length,
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('[VK-Rechnungen API] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
