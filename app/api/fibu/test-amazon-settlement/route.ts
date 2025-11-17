import { NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // Liste alle Tabellen im Schema Rechnung auf
    const tables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'Rechnung'
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `)
    
    // Suche nach Tabellen die mit Amazon/Settlement zu tun haben
    const amazonTables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (TABLE_NAME LIKE '%amazon%' OR TABLE_NAME LIKE '%settlement%' OR TABLE_NAME LIKE '%Extern%')
      ORDER BY TABLE_NAME
    `)
    
    return NextResponse.json({
      ok: true,
      rechnung_tables: tables.recordset,
      amazon_related_tables: amazonTables.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Amazon Settlement] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
