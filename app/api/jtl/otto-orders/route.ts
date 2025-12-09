export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()
    
    // JTL speichert Marktplatz-Aufträge in tAuftragsattribut
    // Otto-Bestellungen haben oft spezielle Attribute
    
    // 1. Finde alle Tabellen mit "auftrag" oder "order"
    const tables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (TABLE_NAME LIKE '%auftrag%' OR TABLE_NAME LIKE '%order%' OR TABLE_NAME LIKE '%bestellung%')
      ORDER BY TABLE_NAME
    `)
    
    // 2. Hole Sample-Daten aus tAuftragsattribut (falls vorhanden)
    let auftragsattribute = { recordset: [] }
    try {
      auftragsattribute = await pool.request().query(`
        SELECT TOP 20
          cName,
          cWert,
          COUNT(*) as Anzahl
        FROM tAuftragsattribut
        WHERE cName LIKE '%otto%' OR cName LIKE '%Otto%' OR cName LIKE '%market%'
        GROUP BY cName, cWert
        ORDER BY COUNT(*) DESC
      `)
    } catch (e) {
      console.log('tAuftragsattribut nicht gefunden')
    }
    
    // 3. Suche in tAuftrag nach Otto
    let auftraege = { recordset: [] }
    try {
      auftraege = await pool.request().query(`
        SELECT TOP 10
          kAuftrag,
          cAuftragsNr,
          dErstellt,
          fGesamtsumme
        FROM tAuftrag
        WHERE cAuftragsNr LIKE '%8155%'
        ORDER BY dErstellt DESC
      `)
    } catch (e) {
      console.log('Fehler bei tAuftrag:', e)
    }
    
    return NextResponse.json({
      ok: true,
      tables: tables.recordset,
      auftragsattribute: auftragsattribute.recordset,
      auftraege: auftraege.recordset
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
