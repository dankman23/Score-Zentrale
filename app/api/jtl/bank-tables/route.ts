export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlConnection } from '../../../lib/db/mssql'

/**
 * GET /api/jtl/bank-tables
 * Findet alle Bank-bezogenen Tabellen in JTL
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlConnection()
    
    // Suche nach Bank-Tabellen
    const result = await pool.request().query(`
      SELECT 
        t.TABLE_NAME,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME) as COLUMN_COUNT
      FROM 
        INFORMATION_SCHEMA.TABLES t
      WHERE 
        t.TABLE_SCHEMA = 'dbo'
        AND (
          t.TABLE_NAME LIKE '%bank%' 
          OR t.TABLE_NAME LIKE '%commerzbank%'
          OR t.TABLE_NAME LIKE '%postbank%'
          OR t.TABLE_NAME LIKE '%konto%'
          OR t.TABLE_NAME LIKE '%zahlung%'
        )
      ORDER BY t.TABLE_NAME
    `)
    
    return NextResponse.json({
      ok: true,
      tables: result.recordset
    })
  } catch (error) {
    console.error('[JTL Bank Tables] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
