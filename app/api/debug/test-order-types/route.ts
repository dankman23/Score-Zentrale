export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    const result = await pool.request().query(`
      SELECT TOP 100
        LEFT(cAuftragsNr, 2) as prefix,
        COUNT(*) as count,
        MIN(cAuftragsNr) as beispiel
      FROM Verkauf.tAuftrag
      GROUP BY LEFT(cAuftragsNr, 2)
      ORDER BY count DESC
    `)
    
    return NextResponse.json({
      ok: true,
      prefixes: result.recordset
    })
    
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
