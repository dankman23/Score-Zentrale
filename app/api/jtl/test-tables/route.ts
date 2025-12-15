export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Suche nach Plattform/Online/Shop Tabellen
    const tablesQuery = `
      SELECT TABLE_NAME, TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
        AND (
          TABLE_NAME LIKE '%Plattform%' 
          OR TABLE_NAME LIKE '%Online%'
          OR TABLE_NAME LIKE '%Markt%'
          OR TABLE_NAME LIKE '%Shop%'
        )
      ORDER BY TABLE_NAME
    `
    
    const result = await pool.request().query(tablesQuery)
    
    return NextResponse.json({
      ok: true,
      tables: result.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Tables] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
