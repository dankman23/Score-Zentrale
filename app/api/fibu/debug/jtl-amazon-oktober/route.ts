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
    
    // ENDE: Erst mal nur Schemas und Tabellen auflisten
    
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
