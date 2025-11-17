import { NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // Prüfe tExternerBeleg für Amazon
    const belege = await pool.request().query(`
      SELECT TOP 10
        eb.kExternerBeleg,
        eb.cBelegNr,
        eb.dBelegdatumUtc,
        (SELECT COUNT(*) FROM Rechnung.tExternerBelegPosition WHERE kExternerBeleg = eb.kExternerBeleg) as anzahl_positionen
      FROM Rechnung.tExternerBeleg eb
      WHERE eb.cBelegNr LIKE 'XRE-%'
        OR eb.cBelegNr LIKE 'AMZ-%'
      ORDER BY eb.dBelegdatumUtc DESC
    `)
    
    // Prüfe Positionen mit Details
    const positionen = await pool.request().query(`
      SELECT TOP 50
        eb.cBelegNr,
        eb.dBelegdatumUtc,
        eb.cKundenName,
        ebp.cName as position_name,
        ebp.fPreisNetto,
        ebp.cBestellNr,
        ebp.cAuftragsnummer
      FROM Rechnung.tExternerBelegPosition ebp
      JOIN Rechnung.tExternerBeleg eb ON ebp.kExternerBeleg = eb.kExternerBeleg
      WHERE eb.cBelegNr LIKE 'XRE-%'
        OR eb.cBelegNr LIKE 'AMZ-%'
      ORDER BY eb.dBelegdatumUtc DESC
    `)
    
    return NextResponse.json({
      ok: true,
      belege: belege.recordset,
      positionen: positionen.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Amazon Settlement] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
