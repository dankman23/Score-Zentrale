export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // Try different schema possibilities
    const schemas = ['Kunde', 'dbo']
    let columns = []
    
    for (const schema of schemas) {
      try {
        const query = `
          SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'tKunde'
          ORDER BY ORDINAL_POSITION
        `
        
        const result = await pool.request().query(query)
        if (result.recordset?.length > 0) {
          columns = result.recordset
          return NextResponse.json({
            ok: true,
            schema,
            table: `${schema}.tKunde`,
            columns
          })
        }
      } catch (e) {
        // Try next schema
      }
    }
    
    return NextResponse.json({ 
      ok: false, 
      error: 'tKunde table not found in Kunde or dbo schema' 
    }, { status: 404 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
