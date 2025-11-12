export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Get column names from tRechnung
    const columns = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.tRechnung 
      WHERE dErstellt >= '2025-10-01'
    `)
    
    const firstRow = columns.recordset[0]
    const columnNames = firstRow ? Object.keys(firstRow) : []
    
    // Get column names from tZahlung
    const zahlungColumns = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.tZahlung
      WHERE dZeit >= '2025-10-01'
    `)
    
    const firstZahlung = zahlungColumns.recordset[0]
    const zahlungColumnNames = firstZahlung ? Object.keys(firstZahlung) : []
    
    return NextResponse.json({
      ok: true,
      tRechnung: {
        columnNames,
        sample: firstRow
      },
      tZahlung: {
        columnNames,
        sample: firstZahlung
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
