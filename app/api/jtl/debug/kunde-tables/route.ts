export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    const query = `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (TABLE_NAME LIKE '%Kunde%' OR TABLE_NAME LIKE '%kunde%')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `
    
    const result = await pool.request().query(query)
    
    return NextResponse.json({
      ok: true,
      tables: result.recordset
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
