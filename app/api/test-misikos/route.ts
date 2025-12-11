export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Zuerst: Alle Spalten auflisten
    const columnsResult = await pool.request().query(`
      SELECT TOP 1 * FROM tKunde
    `)
    
    const columns = Object.keys(columnsResult.recordset[0] || {})
    
    // Dann: Nach Misikos suchen
    const result = await pool.request().query(`
      SELECT TOP 10 *
      FROM tKunde 
      WHERE cFirma LIKE '%misikos%'
    `)
    
    return NextResponse.json({
      ok: true,
      found: result.recordset.length,
      customers: result.recordset
    })
    
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
