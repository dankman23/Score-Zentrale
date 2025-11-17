export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

/**
 * GET /api/jtl/bank-modules
 * Listet alle Zahlungsabgleich-Module und ihre Konten
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // Alle Module
    const modules = await pool.request().query(`
      SELECT * FROM tZahlungsabgleichModul
    `)
    
    // Alle Konten-IDs mit Sample-Transaktionen
    const konten = await pool.request().query(`
      SELECT 
        u.cKontoIdentifikation,
        u.kZahlungsabgleichModul,
        COUNT(*) as AnzahlTransaktionen,
        MIN(u.dBuchungsdatum) as ErsteBuchung,
        MAX(u.dBuchungsdatum) as LetzteB uchung,
        (SELECT TOP 1 cName FROM tZahlungsabgleichUmsatz WHERE cKontoIdentifikation = u.cKontoIdentifikation ORDER BY dBuchungsdatum DESC) as BeispielName
      FROM tZahlungsabgleichUmsatz u
      GROUP BY u.cKontoIdentifikation, u.kZahlungsabgleichModul
      ORDER BY AnzahlTransaktionen DESC
    `)
    
    return NextResponse.json({
      ok: true,
      modules: modules.recordset,
      konten: konten.recordset
    })
  } catch (error) {
    console.error('[JTL Bank Modules] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
