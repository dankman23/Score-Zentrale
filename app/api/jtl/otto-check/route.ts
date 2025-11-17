export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // Suche nach Otto Bestellungen
    const bestellungen = await pool.request().query(`
      SELECT TOP 10
        b.kBestellung,
        b.cBestellNr,
        b.dErstellt,
        p.cName as Plattform
      FROM tBestellung b
      LEFT JOIN tPlattform p ON b.kPlattform = p.kPlattform
      WHERE p.cName LIKE '%Otto%' OR p.cName LIKE '%OTTO%'
      ORDER BY b.dErstellt DESC
    `)
    
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
    
    // Prüfe Plattformen
    const plattformen = await pool.request().query(`
      SELECT * FROM tPlattform WHERE cName LIKE '%Otto%' OR cName LIKE '%OTTO%'
    `)
    
    return NextResponse.json({
      ok: true,
      bestellungen: bestellungen.recordset,
      zahlungen: zahlungen.recordset,
      plattformen: plattformen.recordset
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
