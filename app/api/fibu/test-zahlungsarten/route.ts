import { NextResponse } from 'next/server'
import { getJTLConnection } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getJTLConnection()
    
    // Alle Zahlungsarten
    const za = await pool.request().query(`
      SELECT TOP 50
        kZahlungsart, 
        cName
      FROM dbo.tZahlungsart
      ORDER BY cName
    `)
    
    // Zahlungsabgleich-Module  
    const zm = await pool.request().query(`
      SELECT * FROM dbo.tZahlungsabgleichModul
    `)
    
    // Prüfe welche Zahlungsarten in tZahlung vorkommen
    const used = await pool.request().query(`
      SELECT DISTINCT 
        za.kZahlungsart,
        za.cName,
        COUNT(*) as anzahl
      FROM dbo.tZahlung z
      JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      WHERE z.dDatum >= '2025-10-01'
      GROUP BY za.kZahlungsart, za.cName
      ORDER BY anzahl DESC
    `)
    
    return NextResponse.json({
      ok: true,
      zahlungsarten: za.recordset,
      zahlungsabgleich_module: zm.recordset,
      verwendete_zahlungsarten: used.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Zahlungsarten] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
