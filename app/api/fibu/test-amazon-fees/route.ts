import { NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // Prüfe externe Belege
    const result1 = await pool.request().query(`
      SELECT TOP 5
        eb.cBelegNr,
        eb.dBelegdatumUtc,
        (SELECT COUNT(*) FROM Rechnung.tExternerBelegPosition WHERE kExternerBeleg = eb.kExternerBeleg) as anzahl_positionen
      FROM Rechnung.tExternerBeleg eb
      WHERE eb.cBelegNr LIKE 'XRE-%' OR eb.cBelegNr LIKE 'AMZ-%'
      ORDER BY eb.dBelegdatumUtc DESC
    `)
    
    // Prüfe Gebühren-Positionen (negative Beträge = Gebühren)
    const result2 = await pool.request().query(`
      SELECT TOP 50
        ebp.cName,
        ebp.fPreisNetto,
        ebp.fSteuersatz,
        eb.cBelegNr,
        eb.dBelegdatumUtc
      FROM Rechnung.tExternerBelegPosition ebp
      JOIN Rechnung.tExternerBeleg eb ON ebp.kExternerBeleg = eb.kExternerBeleg
      WHERE ebp.fPreisNetto < 0
      ORDER BY eb.dBelegdatumUtc DESC
    `)
    
    return NextResponse.json({
      ok: true,
      externe_belege: result1.recordset,
      gebuehren_positionen: result2.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Amazon Fees] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
