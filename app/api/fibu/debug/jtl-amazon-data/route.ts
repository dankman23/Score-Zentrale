export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '@/lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getJTLConnection()
    
    // 1. Spalten von pf_amazon_settlementpos
    const spalten = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'pf_amazon_settlementpos'
      ORDER BY ORDINAL_POSITION
    `)
    
    const spaltenListe = spalten.recordset.map((c: any) => c.COLUMN_NAME)
    
    // 2. Erste paar Zeilen holen (mit allen Spalten)
    const beispiel = await pool.request().query(`
      SELECT TOP 30 *
      FROM dbo.pf_amazon_settlementpos
    `)
    
    return NextResponse.json({
      ok: true,
      spalten: spaltenListe,
      anzahl: beispiel.recordset.length,
      daten: beispiel.recordset
    })
    
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      stack: err.stack
    }, { status: 500 })
  }
}
