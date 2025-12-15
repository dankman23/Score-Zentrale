export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Struktur von tShop
    const shopStructure = `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tShop'
      ORDER BY ORDINAL_POSITION
    `
    const shopCols = await pool.request().query(shopStructure)
    
    // Sample von tShop
    const shopSample = `
      SELECT TOP 5 * FROM dbo.tShop
    `
    const test = await pool.request().query(shopSample)
    
    return NextResponse.json({
      ok: true,
      shopCols: shopCols.recordset,
      shopSample: test.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Platforms] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
