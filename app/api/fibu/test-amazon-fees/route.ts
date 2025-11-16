import { NextResponse } from 'next/server'
import { getJTLConnection } from '../../../lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // Prüfe externe Belege mit Gebühren
    const result1 = await pool.request().query(`
      SELECT TOP 5
        eb.cBelegNr,
        eb.dErstellDatum,
        eb.fGesamtsumme,
        eb.cMarktplatz,
        (SELECT COUNT(*) FROM Rechnung.tExternerBelegPosition WHERE kExternerBeleg = eb.kExternerBeleg) as anzahl_positionen
      FROM Rechnung.tExternerBeleg eb
      WHERE eb.cMarktplatz LIKE '%Amazon%'
      ORDER BY eb.dErstellDatum DESC
    `)
    
    // Prüfe Gebühren-Positionen
    const result2 = await pool.request().query(`
      SELECT TOP 20
        ebp.cName,
        ebp.fPreisNetto,
        ebp.fSteuersatz,
        ebp.nTyp,
        eb.cBelegNr,
        eb.dErstellDatum
      FROM Rechnung.tExternerBelegPosition ebp
      JOIN Rechnung.tExternerBeleg eb ON ebp.kExternerBeleg = eb.kExternerBeleg
      WHERE eb.cMarktplatz LIKE '%Amazon%'
        AND (ebp.cName LIKE '%Gebühr%' OR ebp.cName LIKE '%Fee%' OR ebp.cName LIKE '%FBA%' OR ebp.fPreisNetto < 0)
      ORDER BY eb.dErstellDatum DESC
    `)
    
    // Prüfe auch eBay
    const result3 = await pool.request().query(`
      SELECT TOP 20
        ebp.cName,
        ebp.fPreisNetto,
        ebp.fSteuersatz,
        ebp.nTyp,
        eb.cBelegNr,
        eb.dErstellDatum
      FROM Rechnung.tExternerBelegPosition ebp
      JOIN Rechnung.tExternerBeleg eb ON ebp.kExternerBeleg = eb.kExternerBeleg
      WHERE eb.cMarktplatz LIKE '%eBay%'
        AND (ebp.cName LIKE '%Gebühr%' OR ebp.cName LIKE '%Fee%' OR ebp.fPreisNetto < 0)
      ORDER BY eb.dErstellDatum DESC
    `)
    
    return NextResponse.json({
      ok: true,
      amazon_belege: result1.recordset,
      amazon_gebuehren: result2.recordset,
      ebay_gebuehren: result3.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Amazon Fees] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
