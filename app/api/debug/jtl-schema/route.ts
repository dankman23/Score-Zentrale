export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

/**
 * GET /api/debug/jtl-schema?table=tKunde
 * Debug-Endpoint: Zeigt alle Spalten einer JTL-Tabelle
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('table') || 'tKunde'
    
    const pool = await getMssqlPool()
    
    // Query 1: Tabellenstruktur abfragen
    const schemaResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `)
    
    // Query 2: Ein Beispiel-Datensatz laden
    const sampleResult = await pool.request().query(`
      SELECT TOP 1 * FROM ${tableName}
    `)
    
    const columns = schemaResult.recordset
    const sample = sampleResult.recordset[0] || {}
    
    return NextResponse.json({
      ok: true,
      table: tableName,
      columns: columns,
      columnNames: columns.map((c: any) => c.COLUMN_NAME),
      sampleData: sample
    })
    
  } catch (error: any) {
    console.error('[Debug] Schema error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
