export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'Verkauf' 
        AND TABLE_NAME = 'tAuftrag'
      ORDER BY ORDINAL_POSITION
    `
    
    const result = await pool.request().query(query)
    
    // Sample von tAuftrag
    const sampleQuery = `
      SELECT TOP 5 *
      FROM Verkauf.tAuftrag
      ORDER BY dErstellt DESC
    `
    
    const sample = await pool.request().query(sampleQuery)
    
    return NextResponse.json({
      ok: true,
      columns: result.recordset,
      sample: sample.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Auftrag] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
