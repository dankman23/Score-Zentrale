export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'

/**
 * GET /api/fibu/rechnungen/vk?from=2025-10-01&to=2025-10-31
 * Lädt VK-Rechnungen aus JTL
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    
    const pool = await getMssqlPool()
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(`
        SELECT 
          r.kRechnung,
          r.cRechnungsNr as rechnungsnr,
          r.dErstellt as rechnungsdatum,
          r.fGesamtsumme as brutto,
          r.fWarensumme as netto,
          r.fVersand as versand,
          r.fMwSt as mwst,
          r.cStatus as status,
          k.cFirma as kunde_name,
          k.cUSTID as kunde_ustid,
          k.cLand as kunde_land,
          za.cName as zahlungsart,
          r.kZahlungsart as zahlungsart_id
        FROM dbo.tRechnung r
        LEFT JOIN dbo.tKunde k ON r.kKunde = k.kKunde
        LEFT JOIN dbo.tZahlungsart za ON r.kZahlungsart = za.kZahlungsart
        WHERE r.dErstellt >= @from 
          AND r.dErstellt < DATEADD(day, 1, @to)
        ORDER BY r.dErstellt DESC
      `)
    
    return NextResponse.json({
      ok: true,
      rechnungen: result.recordset,
      count: result.recordset.length
    })
  } catch (error: any) {
    console.error('[VK-Rechnungen] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
