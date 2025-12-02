export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '../../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getJTLConnection()
    
    // Settlement-Pos-Beispiele
    const settlementPosExample = await pool.request().query(`
      SELECT TOP 30 *
      FROM dbo.pf_amazon_settlementpos
      ORDER BY kSettlementPos DESC
    `)
    
    return NextResponse.json({
      ok: true,
      anzahl: settlementPosExample.recordset.length,
      daten: settlementPosExample.recordset
    })
    
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message
    }, { status: 500 })
  }
}
