export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // Suche nach Otto in Zahlungsabgleich
    const zahlungen = await pool.request().query(`
      SELECT TOP 10
        cKontoIdentifikation,
        cName,
        cVerwendungszweck,
        fBetrag,
        dBuchungsdatum
      FROM tZahlungsabgleichUmsatz
      WHERE cName LIKE '%Otto%' 
         OR cVerwendungszweck LIKE '%Otto%'
         OR cName LIKE '%OTTO%'
      ORDER BY dBuchungsdatum DESC
    `)
    
    // Alle Plattformen anzeigen
    const alleTabs = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
        AND (TABLE_NAME LIKE '%otto%' OR TABLE_NAME LIKE '%Otto%' OR TABLE_NAME LIKE '%OTTO%' OR TABLE_NAME LIKE '%platt%' OR TABLE_NAME LIKE '%market%')
      ORDER BY TABLE_NAME
    `)
    
    return NextResponse.json({
      ok: true,
      zahlungen: zahlungen.recordset,
      tables: alleTabs.recordset
    })
  } catch (error) {
    console.error('[Otto Check] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
