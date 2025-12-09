export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

/**
 * GET /api/jtl/sales/date-range
 * Liefert den verfügbaren Datumsbereich
 */
export async function GET() {
  try {
    const pool = await getMssqlPool()
    const query = `
      SELECT 
        MIN(CAST(dErstellt AS DATE)) AS min_date,
        MAX(CAST(dErstellt AS DATE)) AS max_date
      FROM Verkauf.tAuftrag
      WHERE dErstellt IS NOT NULL
    `
    const result = await pool.request().query(query)
    const row = result.recordset?.[0]

    return NextResponse.json({
      ok: true,
      min: row?.min_date?.toISOString().slice(0, 10) || '2020-01-01',
      max: row?.max_date?.toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10)
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/date-range] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
