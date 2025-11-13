export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'

/**
 * GET /api/fibu/rechnungen/vk
 * Lädt VK-Rechnungen aus JTL MSSQL
 * 
 * Query-Parameter:
 * - from: Startdatum (YYYY-MM-DD)
 * - to: Enddatum (YYYY-MM-DD)
 * 
 * WICHTIG: Lädt ALLE Rechnungen ohne Limit!
 * Rechnungen werden NIEMALS automatisch gelöscht.
 * Status-Updates (Offen -> Bezahlt/Storniert) sind erlaubt.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'
    
    console.log('[VK-Rechnungen] Lade ALLE Rechnungen von', from, 'bis', to)
    
    const pool = await getMssqlPool()
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(`
        SELECT
          r.kRechnung,
          r.cRechnungsNr,
          r.dErstellt,
          r.fGesamtsumme,
          r.fWarensumme,
          r.tKunde_kKunde,
          CASE
            WHEN EXISTS (SELECT 1 FROM tZahlung z WHERE z.kRechnung = r.kRechnung) THEN 'Bezahlt'
            ELSE 'Offen'
          END as status
        FROM tRechnung r
        WHERE r.dErstellt >= @from
          AND r.dErstellt < DATEADD(day, 1, CAST(@to as date))
        ORDER BY r.dErstellt DESC
      `)
    
    console.log('[VK-Rechnungen] Geladen:', result.recordset.length, 'Rechnungen')
    
    const rechnungen = result.recordset.map(r => ({
      id: r.kRechnung.toString(),
      rechnungsNr: r.cRechnungsNr,
      datum: r.dErstellt,
      kunde: `Kunde #${r.tKunde_kKunde || 'Unbekannt'}`,
      betrag: r.fGesamtsumme,
      warenwert: r.fWarensumme,
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
