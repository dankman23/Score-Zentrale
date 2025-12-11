export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    const result = await pool.request().query(`
      SELECT TOP 10 
        k.cFirma, 
        k.cMail as cEmail, 
        k.cWWW as cHomepage,
        k.kKunde
      FROM tKunde k
      WHERE k.cFirma LIKE '%misikos%' 
        OR k.cMail LIKE '%misikos%'
        OR k.cWWW LIKE '%misikos%'
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
