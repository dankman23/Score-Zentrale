export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

/**
 * GET /api/fibu/explore
 * Erkundet JTL-Datenbank für FIBU-relevante Daten
 */
export async function GET() {
  try {
    const pool = await getMssqlPool()
    const result: any = {}

    // Finde alle FIBU-relevanten Tabellen
    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA IN ('Verkauf', 'Einkauf', 'dbo')
        AND (
          TABLE_NAME LIKE '%Rechnung%' 
          OR TABLE_NAME LIKE '%Zahlung%'
          OR TABLE_NAME LIKE '%Zahlungsart%'
          OR TABLE_NAME LIKE '%Lieferant%'
        )
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    result.availableTables = tables.recordset

    // Zahlungsarten (dbo Schema)
    try {
      const zahlungsarten = await pool.request().query(`
        SELECT * FROM dbo.tZahlungsart ORDER BY nSort
      `)
      result.zahlungsarten = zahlungsarten.recordset
    } catch (e: any) {
      result.zahlungsarten = { error: e.message }
    }

    return NextResponse.json({
      ok: true,
      data: result
    })
  } catch (error: any) {
    console.error('[FIBU Explore] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
