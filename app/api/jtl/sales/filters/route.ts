export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

/**
 * GET /api/jtl/sales/filters
 * Gibt verfügbare Hersteller und Warengruppen zurück
 */
export async function GET() {
  try {
    const pool = await getMssqlPool()
    const articleTable = 'dbo.tArtikel'
    
    // Hole Hersteller (distinct, sortiert)
    const herstellerQuery = `
      SELECT DISTINCT cHersteller
      FROM ${articleTable}
      WHERE cHersteller IS NOT NULL AND cHersteller != ''
      ORDER BY cHersteller
    `
    
    const herstellerResult = await pool.request().query(herstellerQuery)
    const hersteller = herstellerResult.recordset.map((r: any) => r.cHersteller)
    
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
