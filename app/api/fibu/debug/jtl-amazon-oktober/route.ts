export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '@/../lib/db/mssql'

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
    
    // 5. Prüfe Settlement-Tabelle (erst mal nur COUNT)
    try {
      const settlementCount = await pool.request().query(`
        SELECT COUNT(*) as anzahl
        FROM dbo.pf_amazon_settlement
      `)
      results.settlement_gesamt = settlementCount.recordset[0].anzahl
      
      // Beispiel Settlement
      const settlementExample = await pool.request().query(`
        SELECT TOP 3 *
        FROM dbo.pf_amazon_settlement
        ORDER BY kSettlement DESC
      `)
      results.settlement_beispiel = settlementExample.recordset
    } catch (err: any) {
      results.settlement_error = err.message
    }
    
    // 6. Prüfe Settlement-Pos-Tabelle
    try {
      const settlementPosCount = await pool.request().query(`
        SELECT COUNT(*) as anzahl
        FROM dbo.pf_amazon_settlementpos
      `)
      results.settlementpos_gesamt = settlementPosCount.recordset[0].anzahl
      
      // Beispiel Settlement-Pos
      const settlementPosExample = await pool.request().query(`
        SELECT TOP 10 *
        FROM dbo.pf_amazon_settlementpos
        ORDER BY kSettlementPos DESC
      `)
      results.settlementpos_beispiel = settlementPosExample.recordset
    } catch (err: any) {
      results.settlementpos_error = err.message
    }
    
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
