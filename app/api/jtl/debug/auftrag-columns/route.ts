export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    const schemas = ['Verkauf', 'dbo']
    let columns = []
    
    for (const schema of schemas) {
      try {
        const query = `
          SELECT COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'tAuftrag'
            AND (COLUMN_NAME LIKE '%Adresse%' OR COLUMN_NAME LIKE '%adresse%')
          ORDER BY ORDINAL_POSITION
        `
        
        const result = await pool.request().query(query)
        if (result.recordset?.length > 0) {
          columns = result.recordset
          return NextResponse.json({
            ok: true,
            schema,
            table: `${schema}.tAuftrag`,
            columns
          })
        }
      } catch (e) {
        // Try next schema
      }
    }
    
    return NextResponse.json({ 
      ok: false, 
      error: 'No address columns found in tAuftrag' 
    }, { status: 404 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
