export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    const query = `
      SELECT TOP 5 COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'Verkauf' 
        AND TABLE_NAME = 'tAuftrag'
        AND (COLUMN_NAME LIKE '%typ%' OR COLUMN_NAME LIKE '%status%' OR COLUMN_NAME LIKE '%art%')
      ORDER BY ORDINAL_POSITION
    `
    
    const result = await pool.request().query(query)
    
    // Auch eine Sample von tAuftrag mit diesen Spalten
    const sampleQuery = `
      SELECT TOP 10 
        kAuftrag,
        dErstellt,
        cStatus,
        nStorno
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
