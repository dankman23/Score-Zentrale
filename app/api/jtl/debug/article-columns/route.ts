export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'tArtikel'
      ORDER BY ORDINAL_POSITION
    `
    
    const result = await pool.request().query(query)
    
    return NextResponse.json({
      ok: true,
      columns: result.recordset
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
