export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn } from '@/lib/sql/utils'

/**
 * GET /api/jtl/sales/filters
 * Gibt verfügbare Hersteller und Warengruppen zurück
 */
export async function GET() {
  try {
    const pool = await getMssqlPool()
    const articleTable = 'dbo.tArtikel'
    
    // Hole Hersteller (distinct, sortiert) - über tHersteller Tabelle
    const herstellerTable = 'dbo.tHersteller'
    const hasKHersteller = await hasColumn(pool, articleTable, 'kHersteller')
    const hasTHersteller = hasKHersteller ? await hasColumn(pool, herstellerTable, 'kHersteller') : false
    
    let hersteller: string[] = []
    if (hasTHersteller) {
      const herstellerQuery = `
        SELECT DISTINCT h.cName
        FROM ${herstellerTable} h
        WHERE h.cName IS NOT NULL AND h.cName != ''
        ORDER BY h.cName
      `
      const herstellerResult = await pool.request().query(herstellerQuery)
      hersteller = herstellerResult.recordset.map((r: any) => r.cName)
    }
    
    // Hole Warengruppen (wenn Feld existiert)
    let warengruppen: string[] = []
    try {
      const warengruppenQuery = `
        SELECT DISTINCT cWarengruppe
        FROM ${articleTable}
        WHERE cWarengruppe IS NOT NULL AND cWarengruppe != ''
        ORDER BY cWarengruppe
      `
      const warengruppenResult = await pool.request().query(warengruppenQuery)
      warengruppen = warengruppenResult.recordset.map((r: any) => r.cWarengruppe)
    } catch (e) {
      // Feld existiert nicht - das ist OK
      console.log('[Sales Filters] cWarengruppe field not found, skipping')
    }
    
    return NextResponse.json({ 
      ok: true, 
      hersteller,
      warengruppen
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/filters] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
