export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Get column names from lvRechnungsverwaltung
    const rvColumns = await pool.request().query(`
      SELECT TOP 1 * FROM Verkauf.lvRechnungsverwaltung
    `)
    
    const firstRV = rvColumns.recordset[0]
    const rvColumnNames = firstRV ? Object.keys(firstRV) : []
    
    return NextResponse.json({
      ok: true,
      lvRechnungsverwaltung: {
        columnNames: rvColumnNames,
        sample: firstRV
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
