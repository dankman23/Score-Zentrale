export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

/**
 * GET /api/jtl/bank-structure
 * Zeigt Struktur und Sample-Daten der Bank-Tabellen
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // Struktur von tZahlungsabgleichUmsatz
    const columns = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH
      FROM 
        INFORMATION_SCHEMA.COLUMNS
      WHERE 
        TABLE_NAME = 'tZahlungsabgleichUmsatz'
      ORDER BY ORDINAL_POSITION
    `)
    
    // Sample Daten (letzte 5)
    const sample = await pool.request().query(`
      SELECT TOP 5 * 
      FROM tZahlungsabgleichUmsatz
      ORDER BY kZahlungsabgleichUmsatz DESC
    `)
    
    // Alle verschiedenen Konten-IDs
    const kontoIdentifikationen = await pool.request().query(`
      SELECT DISTINCT 
        u.cKontoIdentifikation,
        u.kZahlungsabgleichModul,
        COUNT(*) OVER (PARTITION BY u.cKontoIdentifikation) as AnzahlTransaktionen
      FROM tZahlungsabgleichUmsatz u
      ORDER BY AnzahlTransaktionen DESC
    `)
    
    // Konto-Daten
    const konten = await pool.request().query(`
      SELECT * FROM tkontodaten
    `)
    
    return NextResponse.json({
      ok: true,
      columns: columns.recordset,
      sample: sample.recordset,
      konten: konten.recordset,
      kontoIdentifikationen: kontoIdentifikationen.recordset
    })
  } catch (error) {
    console.error('[JTL Bank Structure] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
