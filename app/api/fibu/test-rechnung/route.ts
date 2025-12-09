export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Get column names from tExterneRechnung
    const erQuery = await pool.request().query(`
      SELECT TOP 1 * FROM Verkauf.tExterneRechnung
    `)
    
    const er = erQuery.recordset[0]
    const erColumns = er ? Object.keys(er) : []
    
    return NextResponse.json({
      ok: true,
      lvExterneRechnung: {
        columnNames: erColumns,
        sample: er
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
