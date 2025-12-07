export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../app/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    const result = await pool.request().query(`
      SELECT TOP 5
        k.kKunde,
        f.cName as cFirma,
        f.cEMail,
        k.dErstellt
      FROM tKunde k
      LEFT JOIN tFirma f ON f.kFirma = k.kFirma
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
