export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // Suche nach Otto Aufträgen/Rechnungen in JTL
    // Oft haben Marktplatz-Bestellungen spezielle Kennzeichnungen
    
    // 1. Prüfe Verkaufsrechnung mit Otto-Kennzeichnung
    const rechnungen = await pool.request().query(`
      SELECT TOP 10
        cRechnungsNr,
        dRechnungsdatum,
        fBrutto,
        cKundenname,
        cBestellNr
      FROM tRechnung
      WHERE cBestellNr LIKE 'OTTO%' 
         OR cBestellNr LIKE '%otto%'
         OR cKundenname LIKE '%Otto%'
      ORDER BY dRechnungsdatum DESC
    `)
    
    // 2. Prüfe alle Bestellnummern-Muster
    const alleBestellungen = await pool.request().query(`
      SELECT TOP 20
        cBestellNr,
        COUNT(*) as Anzahl
      FROM tRechnung
      WHERE cBestellNr IS NOT NULL
      GROUP BY cBestellNr
      ORDER BY COUNT(*) DESC
    `)
    
    return NextResponse.json({
      ok: true,
      ottoRechnungen: rechnungen.recordset,
      bestellnummerMuster: alleBestellungen.recordset
    })
  } catch (error) {
    console.error('[Otto Orders] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
