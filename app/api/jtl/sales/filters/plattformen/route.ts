export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    const query = `
      SELECT DISTINCT cPlattform
      FROM Verkauf.tAuftrag
      WHERE cPlattform IS NOT NULL AND cPlattform != ''
      ORDER BY cPlattform
    `
    const result = await pool.request().query(query)
    const values = (result.recordset || []).map(r => r.cPlattform)

    return NextResponse.json({ ok: true, values })
  } catch (error: any) {
    console.error('[/api/jtl/sales/filters/plattformen] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
