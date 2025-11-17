import { NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // 1. Prüfe Struktur von pf_amazon_settlement
    const settlement_sample = await pool.request().query(`
      SELECT TOP 1 * FROM dbo.pf_amazon_settlement
      ORDER BY kSettlement DESC
    `)
    
    // 2. Prüfe Struktur von pf_amazon_settlementpos
    const settlementpos_sample = await pool.request().query(`
      SELECT TOP 5 * FROM dbo.pf_amazon_settlementpos
      ORDER BY kSettlementPos DESC
    `)
    
    // 3. Zähle Settlements im Oktober
    const count = await pool.request().query(`
      SELECT COUNT(*) as anzahl FROM dbo.pf_amazon_settlement
      WHERE dErstellDatum >= '2025-10-01' AND dErstellDatum < '2025-11-01'
    `)
    
    // 4. Zähle Positionen im Oktober
    const pos_count = await pool.request().query(`
      SELECT COUNT(*) as anzahl FROM dbo.pf_amazon_settlementpos sp
      JOIN dbo.pf_amazon_settlement s ON sp.kSettlement = s.kSettlement
      WHERE s.dErstellDatum >= '2025-10-01' AND s.dErstellDatum < '2025-11-01'
    `)
    
    return NextResponse.json({
      ok: true,
      settlement_columns: settlement_sample.recordset[0] ? Object.keys(settlement_sample.recordset[0]) : [],
      settlement_sample: settlement_sample.recordset[0],
      settlementpos_columns: settlementpos_sample.recordset[0] ? Object.keys(settlementpos_sample.recordset[0]) : [],
      settlementpos_samples: settlementpos_sample.recordset,
      oktober_settlements: count.recordset[0],
      oktober_positionen: pos_count.recordset[0]
    })
    
  } catch (error: any) {
    console.error('[Test Amazon Settlement] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
