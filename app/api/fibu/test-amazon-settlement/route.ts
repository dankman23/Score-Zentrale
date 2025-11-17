import { NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // Prüfe erstmal alle Spalten in tExternerBeleg
    const columns1 = await pool.request().query(`
      SELECT TOP 1 * FROM Rechnung.tExternerBeleg
      WHERE cBelegNr LIKE 'XRE-%'
    `)
    
    // Prüfe alle Spalten in tExternerBelegPosition  
    const columns2 = await pool.request().query(`
      SELECT TOP 1 * FROM Rechnung.tExternerBelegPosition
      WHERE kExternerBeleg IN (
        SELECT TOP 1 kExternerBeleg FROM Rechnung.tExternerBeleg WHERE cBelegNr LIKE 'XRE-%'
      )
    `)
    
    // Zähle wie viele XRE Belege es gibt
    const count = await pool.request().query(`
      SELECT COUNT(*) as anzahl FROM Rechnung.tExternerBeleg WHERE cBelegNr LIKE 'XRE-%'
    `)
    
    return NextResponse.json({
      ok: true,
      anzahl_xre_belege: count.recordset[0],
      beleg_spalten: columns1.recordset[0] ? Object.keys(columns1.recordset[0]) : [],
      beleg_sample: columns1.recordset[0],
      position_spalten: columns2.recordset[0] ? Object.keys(columns2.recordset[0]) : [],
      position_sample: columns2.recordset[0]
    })
    
  } catch (error: any) {
    console.error('[Test Amazon Settlement] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
