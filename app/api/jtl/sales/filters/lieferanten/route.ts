export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    const query = `
      SELECT DISTINCT l.cName
      FROM dbo.tLieferant l
      WHERE l.cName IS NOT NULL AND l.cName != ''
      ORDER BY l.cName
    `
    const result = await pool.request().query(query)
    const values = (result.recordset || []).map(r => r.cName)

    return NextResponse.json({ ok: true, values })
  } catch (error: any) {
    console.error('[/api/jtl/sales/filters/lieferanten] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
