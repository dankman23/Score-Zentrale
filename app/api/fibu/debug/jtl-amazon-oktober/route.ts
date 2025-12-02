export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '../../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    console.log('[JTL Amazon Oktober] Starte Exploration...')
    const pool = await getJTLConnection()
    
    const results: any = {}
    
    // 1. Alle Schemas anzeigen
    const schemas = await pool.request().query(`
      SELECT DISTINCT TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA
    `)
    results.schemas = schemas.recordset.map((s: any) => s.TABLE_SCHEMA)
    
    // 2. Suche nach Amazon/Zahlung relevanten Tabellen (ALLE Schemas)
    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%amazon%' 
          OR TABLE_NAME LIKE '%markt%' 
          OR TABLE_NAME LIKE '%zahlungs%'
          OR TABLE_NAME LIKE '%rechnung%'
          OR TABLE_NAME LIKE '%abgleich%'
          OR TABLE_NAME LIKE '%settlement%'
          OR TABLE_NAME LIKE '%auftrag%'
          OR TABLE_NAME LIKE '%Zahlung%'
          OR TABLE_NAME LIKE '%Rechnung%'
          OR TABLE_NAME LIKE '%Auftrag%'
        )
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    results.tabellen = tables.recordset.map((t: any) => `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`)
    
    // 3. Erkunde pf_amazon_settlement Struktur
    const settlementCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'pf_amazon_settlement'
      ORDER BY ORDINAL_POSITION
    `)
    results.settlement_spalten = settlementCols.recordset.map((c: any) => ({
      name: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      length: c.CHARACTER_MAXIMUM_LENGTH
    }))
    
    // 4. Erkunde pf_amazon_settlementpos Struktur
    const settlementPosCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'pf_amazon_settlementpos'
      ORDER BY ORDINAL_POSITION
    `)
    results.settlementpos_spalten = settlementPosCols.recordset.map((c: any) => ({
      name: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      length: c.CHARACTER_MAXIMUM_LENGTH
    }))
    
    // 5. Zähle Settlement-Positionen für Oktober
    const oktoberCount = await pool.request().query(`
      SELECT COUNT(*) as anzahl
      FROM dbo.pf_amazon_settlementpos pos
      INNER JOIN dbo.pf_amazon_settlement s ON pos.kSettlement = s.kSettlement
      WHERE s.dSettlementStartDate >= '2025-10-01' AND s.dSettlementStartDate < '2025-11-01'
    `)
    results.oktober_settlementpos_anzahl = oktoberCount.recordset[0].anzahl
    
    // 6. Beispiel Settlement-Positionen anzeigen
    const examples = await pool.request().query(`
      SELECT TOP 20
        pos.kSettlementPos,
        pos.cTransactionType,
        pos.cAmountType,
        pos.cAmountDescription,
        pos.fAmount,
        pos.cOrderId,
        pos.cMerchantOrderId,
        pos.cSKU,
        s.dSettlementStartDate,
        s.dSettlementEndDate
      FROM dbo.pf_amazon_settlementpos pos
      INNER JOIN dbo.pf_amazon_settlement s ON pos.kSettlement = s.kSettlement
      WHERE s.dSettlementStartDate >= '2025-10-01' AND s.dSettlementStartDate < '2025-11-01'
      ORDER BY s.dSettlementStartDate DESC, pos.cOrderId
    `)
    results.beispiel_settlementpos = examples.recordset
    
    // 7. Gruppiere nach cAmountType
    const byAmountType = await pool.request().query(`
      SELECT 
        pos.cAmountType,
        COUNT(*) as anzahl,
        SUM(pos.fAmount) as summe
      FROM dbo.pf_amazon_settlementpos pos
      INNER JOIN dbo.pf_amazon_settlement s ON pos.kSettlement = s.kSettlement
      WHERE s.dSettlementStartDate >= '2025-10-01' AND s.dSettlementStartDate < '2025-11-01'
      GROUP BY pos.cAmountType
      ORDER BY anzahl DESC
    `)
    results.nach_amount_type = byAmountType.recordset
    
    // 8. Gruppiere nach cTransactionType
    const byTransactionType = await pool.request().query(`
      SELECT 
        pos.cTransactionType,
        COUNT(*) as anzahl
      FROM dbo.pf_amazon_settlementpos pos
      INNER JOIN dbo.pf_amazon_settlement s ON pos.kSettlement = s.kSettlement
      WHERE s.dSettlementStartDate >= '2025-10-01' AND s.dSettlementStartDate < '2025-11-01'
      GROUP BY pos.cTransactionType
      ORDER BY anzahl DESC
    `)
    results.nach_transaction_type = byTransactionType.recordset
    
    return NextResponse.json({
      ok: true,
      data: results
    })
    
  } catch (err: any) {
    console.error('[JTL Amazon Oktober] Fehler:', err.message)
    return NextResponse.json({
      ok: false,
      error: err.message
    }, { status: 500 })
  }
}
