export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Get column names from tKunde
    const kundeQuery = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.tKunde WHERE kKunde > 0
    `)
    
    const kunde = kundeQuery.recordset[0]
    const kundeColumns = kunde ? Object.keys(kunde) : []
    
    // Get column names from tLand
    const landQuery = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.tLand
    `)
    
    const land = landQuery.recordset[0]
    const landColumns = land ? Object.keys(land) : []
    
    return NextResponse.json({
      ok: true,
      tKunde: {
        columnNames: kundeColumns,
        sample: kunde
      },
      tLand: {
        columnNames: landColumns,
        sample: land
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
