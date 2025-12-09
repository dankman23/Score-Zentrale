import { getJTLConnection } from '@/lib/db/mssql'

/**
 * Durchsucht JTL-Datenbank nach Amazon-Auszahlungs-Tabellen
 */
async function findAmazonPayoutTables() {
  try {
    const pool = await getJTLConnection()
    
    console.log('\n🔍 Suche nach Amazon-bezogenen Tabellen in JTL-Datenbank...\n')
    
    // 1. Alle Tabellen mit "Amazon" im Namen
    console.log('=== Schritt 1: Tabellen mit "Amazon" im Namen ===')
    const amazonTables = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%Amazon%'
      ORDER BY TABLE_NAME
    `)
    
    console.log(`Gefunden: ${amazonTables.recordset.length} Tabellen\n`)
    amazonTables.recordset.forEach(t => {
      console.log(`  - ${t.TABLE_SCHEMA}.${t.TABLE_NAME} (${t.TABLE_TYPE})`)
    })
    
    // 2. Tabellen mit "Payout", "Settlement", "Zahlung"
    console.log('\n=== Schritt 2: Tabellen mit "Payout", "Settlement", "Zahlung" ===')
    const paymentTables = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%Payout%'
         OR TABLE_NAME LIKE '%Settlement%'
         OR TABLE_NAME LIKE '%Zahlung%'
         OR TABLE_NAME LIKE '%Abrechnung%'
      ORDER BY TABLE_NAME
    `)
    
    console.log(`Gefunden: ${paymentTables.recordset.length} Tabellen\n`)
    paymentTables.recordset.forEach(t => {
      console.log(`  - ${t.TABLE_SCHEMA}.${t.TABLE_NAME} (${t.TABLE_TYPE})`)
    })
    
    // 3. Für jede Amazon-Tabelle: Spalten anzeigen
    console.log('\n=== Schritt 3: Spalten der Amazon-Tabellen ===')
    for (const table of amazonTables.recordset) {
      const columns = await pool.request().query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table.TABLE_NAME}'
        ORDER BY ORDINAL_POSITION
      `)
      
      console.log(`\n📋 ${table.TABLE_NAME} (${columns.recordset.length} Spalten):`)
      columns.recordset.forEach(c => {
        const len = c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ''
        console.log(`    - ${c.COLUMN_NAME}: ${c.DATA_TYPE}${len}`)
      })
      
      // Zähle Zeilen und prüfe auf Oktober 2025 Daten
      try {
        const count = await pool.request().query(`
          SELECT COUNT(*) as cnt FROM dbo.${table.TABLE_NAME}
        `)
        console.log(`    ➜ Gesamt-Zeilen: ${count.recordset[0].cnt}`)
        
        // Suche nach Datums-Spalten
        const dateColumns = columns.recordset.filter(c => 
          c.DATA_TYPE.includes('date') || 
          c.DATA_TYPE.includes('time') ||
          c.COLUMN_NAME.toLowerCase().includes('date') ||
          c.COLUMN_NAME.toLowerCase().includes('datum')
        )
        
        if (dateColumns.length > 0) {
          console.log(`    ➜ Datums-Spalten: ${dateColumns.map(c => c.COLUMN_NAME).join(', ')}`)
          
          // Prüfe auf Oktober 2025 Daten
          for (const dateCol of dateColumns) {
            try {
              const oktData = await pool.request().query(`
                SELECT COUNT(*) as cnt 
                FROM dbo.${table.TABLE_NAME}
                WHERE ${dateCol.COLUMN_NAME} >= '2025-10-01' 
                  AND ${dateCol.COLUMN_NAME} < '2025-11-01'
              `)
              if (oktData.recordset[0].cnt > 0) {
                console.log(`    ✅ ${oktData.recordset[0].cnt} Zeilen im Oktober 2025 (${dateCol.COLUMN_NAME})`)
              }
            } catch (e) {
              // Ignoriere Fehler
            }
          }
        }
        
        // Suche nach Betrags-Spalten
        const amountColumns = columns.recordset.filter(c => 
          c.COLUMN_NAME.toLowerCase().includes('amount') ||
          c.COLUMN_NAME.toLowerCase().includes('betrag') ||
          c.COLUMN_NAME.toLowerCase().includes('summe') ||
          c.COLUMN_NAME.toLowerCase().includes('total')
        )
        
        if (amountColumns.length > 0) {
          console.log(`    ➜ Betrags-Spalten: ${amountColumns.map(c => c.COLUMN_NAME).join(', ')}`)
        }
        
      } catch (e) {
        console.log(`    ⚠️ Fehler beim Zählen: ${e.message}`)
      }
    }
    
    await pool.close()
    console.log('\n✅ Analyse abgeschlossen!\n')
    
  } catch (error) {
    console.error('❌ Fehler:', error)
  }
}

findAmazonPayoutTables()
