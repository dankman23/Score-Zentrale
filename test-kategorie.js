// Test: Produktkategorien-Erkennung
const { getMssqlPool } = require('./app/lib/db/mssql')

async function testKategorien() {
  try {
    const pool = await getMssqlPool()
    
    // Teste mit einem bekannten Kunden (z.B. kKunde = 100000)
    const result = await pool.request()
      .input('kKunde', 100000)
      .query(`
        WITH Kategorien AS (
          SELECT 
            CASE 
              WHEN CHARINDEX(' ', ab.cName) > 0 
              THEN LEFT(ab.cName, CHARINDEX(' ', ab.cName) - 1)
              ELSE ab.cName
            END as kategorie,
            SUM(op.fAnzahl * op.fVKNetto) as umsatz
          FROM Verkauf.tAuftrag o
          INNER JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
          INNER JOIN tArtikel art ON art.kArtikel = op.kArtikel
          INNER JOIN tArtikelBeschreibung ab ON ab.kArtikel = art.kArtikel
            AND ab.kSprache = 1
          WHERE o.kKunde = @kKunde
            AND (o.nStorno IS NULL OR o.nStorno = 0)
            AND o.cAuftragsNr LIKE 'AU%'
            AND op.kArtikel > 0
          GROUP BY 
            CASE 
              WHEN CHARINDEX(' ', ab.cName) > 0 
              THEN LEFT(ab.cName, CHARINDEX(' ', ab.cName) - 1)
              ELSE ab.cName
            END
        )
        SELECT TOP 5 kategorie, umsatz
        FROM Kategorien
        WHERE kategorie NOT IN ('Kord', 'und', 'der', 'die', 'das')
          AND LEN(kategorie) > 2
        ORDER BY umsatz DESC
      `)
    
    console.log('✅ Top 5 Kategorien:')
    result.recordset.forEach((row, i) => {
      console.log(`${i+1}. ${row.kategorie}: ${row.umsatz.toFixed(2)} EUR`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  }
}

testKategorien()
