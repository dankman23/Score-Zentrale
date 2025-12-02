export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '../../../../lib/db/mssql'

export async function GET(request: NextRequest) {
  try {
    console.log('[JTL Amazon Oktober] Starte Exploration...')
    const pool = await getJTLConnection()
    
    const results: any = {}
    
    // 1. Suche nach Amazon-relevanten Tabellen
    const tables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%amazon%' 
          OR TABLE_NAME LIKE '%markt%' 
          OR TABLE_NAME LIKE '%zahlungs%'
          OR TABLE_NAME LIKE '%rechnung%'
          OR TABLE_NAME LIKE '%abgleich%'
          OR TABLE_NAME LIKE '%settlement%'
        )
      ORDER BY TABLE_NAME
    `)
    results.tabellen = tables.recordset.map((t: any) => t.TABLE_NAME)
    
    // 2. tZahlungseingang erkunden
    const zahlungsColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tZahlungseingang'
      ORDER BY ORDINAL_POSITION
    `)
    results.tZahlungseingang_spalten = zahlungsColumns.recordset.map((c: any) => ({
      name: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      length: c.CHARACTER_MAXIMUM_LENGTH
    }))
    
    // 3. Alle Zahlungen für Oktober zählen
    const allZahlungen = await pool.request().query(`
      SELECT COUNT(*) as anzahl
      FROM dbo.tZahlungseingang
      WHERE dZeit >= '2025-10-01' AND dZeit < '2025-11-01'
    `)
    results.oktober_gesamt = allZahlungen.recordset[0].anzahl
    
    // 4. Zähle nach Zahlungsanbieter
    const byAnbieter = await pool.request().query(`
      SELECT 
        COALESCE(cZahlungsanbieter, 'Unbekannt') as anbieter,
        COUNT(*) as anzahl,
        SUM(fBetrag) as summe
      FROM dbo.tZahlungseingang
      WHERE dZeit >= '2025-10-01' AND dZeit < '2025-11-01'
      GROUP BY cZahlungsanbieter
      ORDER BY anzahl DESC
    `)
    results.nach_anbieter = byAnbieter.recordset
    
    // 5. Zähle nach ModulId
    const byModul = await pool.request().query(`
      SELECT 
        COALESCE(cModulId, 'Unbekannt') as modulId,
        COUNT(*) as anzahl
      FROM dbo.tZahlungseingang
      WHERE dZeit >= '2025-10-01' AND dZeit < '2025-11-01'
      GROUP BY cModulId
      ORDER BY anzahl DESC
    `)
    results.nach_modul = byModul.recordset
    
    // 6. Beispiel-Zahlungen
    const examples = await pool.request().query(`
      SELECT TOP 10
        kZahlungseingang,
        dZeit,
        fBetrag,
        cISO,
        cHinweis,
        cAbsender,
        cZahlungsanbieter,
        cModulId
      FROM dbo.tZahlungseingang
      WHERE dZeit >= '2025-10-01' AND dZeit < '2025-11-01'
      ORDER BY dZeit DESC
    `)
    results.beispiele = examples.recordset
    
    // 7. Prüfe tZahlungsabgleichUmsatz (Amazon Settlement Daten)
    try {
      const settlementCount = await pool.request().query(`
        SELECT COUNT(*) as anzahl
        FROM dbo.tZahlungsabgleichUmsatz
        WHERE dDatum >= '2025-10-01' AND dDatum < '2025-11-01'
      `)
      results.settlement_daten_anzahl = settlementCount.recordset[0].anzahl
      
      // Struktur von tZahlungsabgleichUmsatz
      const settlementCols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'tZahlungsabgleichUmsatz'
        ORDER BY ORDINAL_POSITION
      `)
      results.settlement_spalten = settlementCols.recordset.map((c: any) => c.COLUMN_NAME)
      
      // Beispiel Settlement-Daten
      const settlementExamples = await pool.request().query(`
        SELECT TOP 5 *
        FROM dbo.tZahlungsabgleichUmsatz
        WHERE dDatum >= '2025-10-01' AND dDatum < '2025-11-01'
        ORDER BY dDatum DESC
      `)
      results.settlement_beispiele = settlementExamples.recordset
      
    } catch (err: any) {
      results.settlement_error = err.message
    }
    
    return NextResponse.json({
      ok: true,
      data: results
    })
    
  } catch (err: any) {
    console.error('[JTL Amazon Oktober] Fehler:', err.message)
    return NextResponse.json({
      ok: false,
      error: err.message
    }, { status: 500 })
  }
}
