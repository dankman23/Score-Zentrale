// Test: JTL tKunde Spalten ermitteln
const { getMssqlPool } = require('./lib/db/mssql')

async function testColumns() {
  try {
    const pool = await getMssqlPool()
    
    // Lade 1 Kunde und zeige alle Spalten
    const result = await pool.request().query(`
      SELECT TOP 1 *
      FROM tKunde
      WHERE nRegistriert = 1
    `)
    
    if (result.recordset.length > 0) {
      console.log('✅ Verfügbare Spalten in tKunde:')
      console.log(Object.keys(result.recordset[0]).join(', '))
      console.log('\n📋 Beispiel-Kunde:')
      console.log(JSON.stringify(result.recordset[0], null, 2))
    } else {
      console.log('❌ Keine Kunden gefunden')
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  }
}

testColumns()
