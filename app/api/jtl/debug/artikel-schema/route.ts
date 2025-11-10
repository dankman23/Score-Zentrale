export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToMSSQL } from '@/lib/db/mssql'

/**
 * GET /api/jtl/debug/artikel-schema
 * Zeigt Schema und Statistiken der tArtikel Tabelle
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await connectToMSSQL()

    // 1. Schema abrufen
    const schemaResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tArtikel'
      ORDER BY ORDINAL_POSITION
    `)

    // 2. Artikel-Typen zählen
    const countResult = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN nAktiv = 1 THEN 1 ELSE 0 END) as aktiv,
        SUM(CASE WHEN nAktiv = 0 THEN 1 ELSE 0 END) as inaktiv
      FROM tArtikel
    `)

    // 3. Sample Artikel
    const sampleResult = await pool.request().query(`
      SELECT TOP 5
        kArtikel,
        cArtNr,
        cName,
        nAktiv,
        kHersteller,
        kArtikelGruppe,
        fVKNetto,
        fEKNetto
      FROM tArtikel
      WHERE nAktiv = 1
      ORDER BY kArtikel DESC
    `)

    return NextResponse.json({
      ok: true,
      schema: schemaResult.recordset,
      counts: countResult.recordset[0],
      sample: sampleResult.recordset,
      note: 'Schema und Statistiken für tArtikel'
    })

  } catch (error: any) {
    console.error('[Artikel Schema] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
