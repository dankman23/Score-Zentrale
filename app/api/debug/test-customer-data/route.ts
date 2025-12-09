export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    const result = await pool.request().query(`
      SELECT TOP 5
        k.kKunde,
        a.cFirma,
        a.cVorname,
        a.cName as cNachname,
        a.cMail as cEMail,
        k.dErstellt
      FROM tKunde k
      LEFT JOIN tAdresse a ON a.kKunde = k.kKunde AND a.nStandard = 1
      WHERE 1=1
      ORDER BY k.kKunde DESC
    `)
    
    return NextResponse.json({
      ok: true,
      customers: result.recordset
    })
    
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
