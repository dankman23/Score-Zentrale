import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '@/lib/db/mssql'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Holt Amazon Settlement-Daten (Auszahlungen/Geldtransit)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    
    const pool = await getJTLConnection()
    
    console.log(`[Amazon Settlements] Lade Daten von ${from} bis ${to}...`)
    
    const result = await pool.request().query(`
      SELECT 
        kMessageId,
        SettlementID,
        SettlementStartDate,
        SettlementEndDate,
        DepositDate,
        TotalAmount,
        Currency,
        dErstellt
      FROM dbo.pf_amazon_settlement
      WHERE DepositDate >= '${from}'
        AND DepositDate < '${to}'
      ORDER BY DepositDate
    `)
    
    console.log(`[Amazon Settlements] ${result.recordset.length} Settlements gefunden`)
    
    // Berechne Summe
    const summe = result.recordset.reduce((sum, row) => sum + (row.TotalAmount || 0), 0)
    
    await pool.close()
    
    return NextResponse.json({
      ok: true,
      zeitraum: { from, to },
      anzahl: result.recordset.length,
      summe_total: summe,
      settlements: result.recordset
    })
    
  } catch (error: any) {
    console.error('[Amazon Settlements] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
