import { getMssqlPool } from '../lib/db/mssql'

async function exploreJTLAmazonOktober() {
  try {
    console.log('[JTL Amazon Oktober] Verbinde mit Datenbank...')
    const pool = await getMssqlPool()
    
    // 1. Suche nach Amazon-relevanten Tabellen
    console.log('\n=== Amazon-relevante Tabellen ===')
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
        )
      ORDER BY TABLE_NAME
    `)
    
    console.log('Gefundene Tabellen:')
    tables.recordset.forEach((t: any) => console.log(`  - ${t.TABLE_NAME}`))
    
    // 2. tZahlungseingang erkunden
    console.log('\n=== tZahlungseingang Struktur ===')
    const zahlungsColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tZahlungseingang'
      ORDER BY ORDINAL_POSITION
    `)
    console.log('Spalten in tZahlungseingang:')
    zahlungsColumns.recordset.slice(0, 30).forEach((c: any) => {
      console.log(`  - ${c.COLUMN_NAME}: ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ''}`)
    })
    
    // 3. Amazon-Zahlungen für Oktober zählen
    console.log('\n=== Amazon Oktober 2025 - Alle Zahlungen ===')
    const allZahlungen = await pool.request().query(`
      SELECT COUNT(*) as anzahl
      FROM dbo.tZahlungseingang
      WHERE dZeit >= '2025-10-01' AND dZeit < '2025-11-01'
    `)
    console.log(`Alle Zahlungen im Oktober: ${allZahlungen.recordset[0].anzahl}`)
    
    // 4. Zähle nach Zahlungsanbieter
    console.log('\n=== Zahlungen nach Anbieter ===')
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
    
    byAnbieter.recordset.forEach((a: any) => {
      console.log(`  ${a.anbieter}: ${a.anzahl} Zahlungen (${a.summe?.toFixed(2) || 0} EUR)`)
    })
    
    // 5. Zähle nach ModulId
    console.log('\n=== Zahlungen nach ModulId ===')
    const byModul = await pool.request().query(`
      SELECT 
        COALESCE(cModulId, 'Unbekannt') as modulId,
        COUNT(*) as anzahl
      FROM dbo.tZahlungseingang
      WHERE dZeit >= '2025-10-01' AND dZeit < '2025-11-01'
      GROUP BY cModulId
      ORDER BY anzahl DESC
    `)
    
    byModul.recordset.forEach((m: any) => {
      console.log(`  ${m.modulId}: ${m.anzahl} Zahlungen`)
    })
    
    // 6. Beispiel-Zahlungen anzeigen
    console.log('\n=== Beispiel Zahlungen (erste 10) ===')
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
    
    examples.recordset.forEach((z: any, i: number) => {
      console.log(`\n  Zahlung ${i+1}:`)
      console.log(`    ID: ${z.kZahlungseingang}`)
      console.log(`    Datum: ${z.dZeit}`)
      console.log(`    Betrag: ${z.fBetrag} ${z.cISO}`)
      console.log(`    Hinweis: ${z.cHinweis?.substring(0, 80)}`)
      console.log(`    Absender: ${z.cAbsender}`)
      console.log(`    Anbieter: ${z.cZahlungsanbieter}`)
      console.log(`    ModulId: ${z.cModulId}`)
    })
    
    // 7. Prüfe ob es Verknüpfungen zu Aufträgen gibt
    console.log('\n=== Verknüpfung zu Aufträgen ===')
    const auftragsLinks = await pool.request().query(`
      SELECT TOP 5
        z.kZahlungseingang,
        z.fBetrag,
        a.kAuftrag,
        a.cBestellNr,
        a.cVersandInfo
      FROM dbo.tZahlungseingang z
      LEFT JOIN dbo.tBestellung b ON z.kZahlungseingang = b.kZahlungseingang
      LEFT JOIN dbo.tAuftrag a ON b.tAuftrag_kAuftrag = a.kAuftrag
      WHERE z.dZeit >= '2025-10-01' AND z.dZeit < '2025-11-01'
        AND a.kAuftrag IS NOT NULL
      ORDER BY z.dZeit DESC
    `)
    
    console.log(`Zahlungen mit Auftrags-Verknüpfung: ${auftragsLinks.recordset.length}`)
    auftragsLinks.recordset.forEach((l: any) => {
      console.log(`  Zahlung ${l.kZahlungseingang} → Auftrag ${l.cBestellNr} (${l.fBetrag} EUR)`)
    })
    
    console.log('\n[JTL Amazon Oktober] Fertig!')
    process.exit(0)
    
  } catch (err: any) {
    console.error('[JTL Amazon Oktober] Fehler:', err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

exploreJTLAmazonOktober()
