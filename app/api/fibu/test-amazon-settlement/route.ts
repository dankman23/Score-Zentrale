import { NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // Spalten direkt aus INFORMATION_SCHEMA
    const settlement_cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'pf_amazon_settlement'
      ORDER BY ORDINAL_POSITION
    `)
    
    const settlementpos_cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'pf_amazon_settlementpos'
      ORDER BY ORDINAL_POSITION
    `)
    
    // Zähle Zeilen
    const settlement_count = await pool.request().query(`
      SELECT COUNT(*) as anzahl FROM dbo.pf_amazon_settlement
    `)
    
    const settlementpos_count = await pool.request().query(`
      SELECT COUNT(*) as anzahl FROM dbo.pf_amazon_settlementpos
    `)
    
    // Sample Daten
    const sample = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.pf_amazon_settlement
    `)
    
    const sample_pos = await pool.request().query(`
      SELECT TOP 3 * FROM dbo.pf_amazon_settlementpos
    `)
    
    return NextResponse.json({
      ok: true,
      settlement_columns: settlement_cols.recordset,
      settlementpos_columns: settlementpos_cols.recordset,
      settlement_count: settlement_count.recordset[0],
      settlementpos_count: settlementpos_count.recordset[0],
      settlement_sample: sample.recordset[0],
      settlementpos_samples: sample_pos.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Amazon Settlement] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
