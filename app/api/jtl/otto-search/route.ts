export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // Suche in tOrder (Marktplatz)
    const orders = await pool.request().query(`
      SELECT TOP 10
        o.*
      FROM tOrder o
      ORDER BY o.kOrder DESC
    `)
    
    // Prüfe tOrderExtension für Plattform-Info
    const extensions = await pool.request().query(`
      SELECT TOP 10 *
      FROM tOrderExtension
      ORDER BY kOrderExtension DESC
    `)
    
    // Suche nach 8155 Pattern (Otto Shop-ID)
    const otto8155 = await pool.request().query(`
      SELECT TOP 10
        cTransaktionID,
        cName,
        fBetrag,
        cVerwendungszweck,
        dBuchungsdatum
      FROM tZahlungsabgleichUmsatz
      WHERE cVerwendungszweck LIKE '%8155%'
      ORDER BY dBuchungsdatum DESC
    `)
    
    return NextResponse.json({
      ok: true,
      orders: orders.recordset,
      extensions: extensions.recordset,
      otto8155Zahlungen: otto8155.recordset
    })
  } catch (error) {
    console.error('[Otto Search] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
