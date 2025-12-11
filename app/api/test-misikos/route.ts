export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    const result = await pool.request().query(`
      SELECT TOP 10 
        cFirma, 
        cEMail, 
        cWWW,
        kKunde
      FROM dbo.tKunde 
      WHERE cFirma LIKE '%misikos%' 
        OR cEMail LIKE '%misikos%'
        OR cWWW LIKE '%misikos%'
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
