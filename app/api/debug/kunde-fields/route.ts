export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool } from '../../../../lib/db/mssql'

/**
 * GET /api/debug/kunde-fields
 * Check what fields exist in tKunde table
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getMSSQLPool()
    
    // Find tKunde table
    const tableCheck = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'tKunde' AND TABLE_TYPE = 'BASE TABLE'
    `)
    
    if (tableCheck.recordset.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'tKunde table not found' 
      }, { status: 404 })
    }
    
    const kundeTable = tableCheck.recordset[0].TABLE_SCHEMA + '.tKunde'
    
    // Get all columns from tKunde
    const columnsResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tKunde'
      ORDER BY ORDINAL_POSITION
    `)
    
    // Sample data from tKunde (first 3 customers)
    const sampleData = await pool.request().query(`
      SELECT TOP 3 *
      FROM ${kundeTable}
    `)
    
    return NextResponse.json({
      ok: true,
      kundeTable,
      columnCount: columnsResult.recordset.length,
      columns: columnsResult.recordset,
      sampleData: sampleData.recordset
    })
  } catch (error: any) {
    console.error('[Debug Kunde Fields] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
