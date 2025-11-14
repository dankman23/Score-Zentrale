/**
 * Test Amazon Transaktionen und externe Belege
 */

const sql = require('mssql')

const config = {
  server: '162.55.235.45',
  port: 49172,
  database: 'eazybusiness',
  user: 'sellermath',
  password: 'xbPWTh87rLtvQx11',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  }
}

async function testAmazonTransactions() {
  try {
    console.log('🔍 Teste Amazon Transaktionen und externe Belege...\n')
    
    const pool = await sql.connect(config)
    
    // 1. Prüfe externe Belege mit Positionen und Transaktionen
    console.log('1️⃣ Prüfe Rechnung.tExternerBeleg mit Transaktionen:\n')
    const query = `
      SELECT TOP 5
        eb.kExternerBeleg,
        eb.cBelegnr,
        eb.dBelegdatumUtc,
        eck.fVkBrutto,
        -- Transaktionen
        et.kExternerBelegTransaktion,
        et.fBetrag AS transaktionsBetrag,
        et.dBuchungsdatum AS transaktionsDatum,
        et.cTransaktionsTyp
      FROM Rechnung.tExternerBeleg eb
      LEFT JOIN Rechnung.tExternerBelegEckdaten eck ON eb.kExternerBeleg = eck.kExternerBeleg
      LEFT JOIN Rechnung.tExternerBelegTransaktion et ON eb.kExternerBeleg = et.kExternerBeleg
      WHERE eb.nBelegtyp = 0
        AND eb.dBelegdatumUtc >= '2025-10-01'
      ORDER BY eb.dBelegdatumUtc DESC
    `
    
    const result = await pool.request().query(query)
    
    console.log(`Gefunden: ${result.recordset.length} Datensätze\n`)
    
    // Gruppiere nach Beleg
    const belegeMap = new Map()
    result.recordset.forEach(r => {
      if (!belegeMap.has(r.kExternerBeleg)) {
        belegeMap.set(r.kExternerBeleg, {
          belegnr: r.cBelegnr,
          datum: r.dBelegdatumUtc,
          brutto: r.fVkBrutto,
          transaktionen: []
        })
      }
      
      if (r.kExternerBelegTransaktion) {
        belegeMap.get(r.kExternerBeleg).transaktionen.push({
          betrag: r.transaktionsBetrag,
          datum: r.transaktionsDatum,
          typ: r.cTransaktionsTyp
        })
      }
    })
    
    // Zeige Details
    let index = 1
    for (const [kExternerBeleg, data] of belegeMap) {
      console.log(`${index}. ${data.belegnr} - ${data.brutto?.toFixed(2) || 0} EUR`)
      console.log(`   Datum: ${data.datum ? new Date(data.datum).toLocaleDateString('de-DE') : 'N/A'}`)
      
      if (data.transaktionen.length > 0) {
        console.log(`   ✅ ${data.transaktionen.length} Transaktion(en):`)
        data.transaktionen.forEach(t => {
          console.log(`      - ${t.betrag?.toFixed(2) || 0} EUR am ${t.datum ? new Date(t.datum).toLocaleDateString('de-DE') : 'N/A'} (${t.typ || 'N/A'})`)
        })
      } else {
        console.log(`   ❌ Keine Transaktionen gefunden`)
      }
      console.log('')
      index++
    }
    
    // 2. Statistik
    console.log('\n📊 Statistik:')
    const mitTransaktionen = Array.from(belegeMap.values()).filter(b => b.transaktionen.length > 0).length
    const ohneTransaktionen = Array.from(belegeMap.values()).filter(b => b.transaktionen.length === 0).length
    console.log(`   - Mit Transaktionen: ${mitTransaktionen}`)
    console.log(`   - Ohne Transaktionen: ${ohneTransaktionen}`)
    
    await pool.close()
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
  }
}

testAmazonTransactions()
