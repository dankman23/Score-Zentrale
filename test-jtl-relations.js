/**
 * Test um die JTL DB Relationen zu verstehen
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

async function testRelations() {
  try {
    console.log('🔍 Teste JTL DB Relationen für externe Belege...\n')
    
    const pool = await sql.connect(config)
    
    // 1. Prüfe einen externen Beleg
    console.log('1️⃣ Prüfe externe Belege (Rechnung.tExternerBeleg):\n')
    const belege = await pool.request().query(`
      SELECT TOP 3
        eb.kExternerBeleg,
        eb.cBelegnr,
        eb.kKunde,
        eb.cHerkunft,
        eb.nBelegtyp
      FROM Rechnung.tExternerBeleg eb
      WHERE eb.nBelegtyp = 0
      ORDER BY eb.dBelegdatumUtc DESC
    `)
    belege.recordset.forEach(b => {
      console.log(`   kExternerBeleg: ${b.kExternerBeleg}`)
      console.log(`   Belegnr: ${b.cBelegnr}`)
      console.log(`   Herkunft: ${b.cHerkunft}`)
      console.log(`   kKunde: ${b.kKunde}`)
      console.log('')
    })
    
    // 2. Prüfe Zahlungen für diesen Beleg
    const kExternerBeleg = belege.recordset[0].kExternerBeleg
    console.log(`\n2️⃣ Prüfe Zahlungen für kExternerBeleg=${kExternerBeleg}:\n`)
    
    const zahlungen = await pool.request().query(`
      SELECT 
        z.kZahlung,
        z.kBestellung,
        z.kRechnung,
        z.fBetrag,
        z.dDatum,
        z.cHinweis
      FROM dbo.tZahlung z
      WHERE z.kBestellung = ${kExternerBeleg}
    `)
    
    if (zahlungen.recordset.length > 0) {
      zahlungen.recordset.forEach(z => {
        console.log(`   ✅ Zahlung gefunden!`)
        console.log(`   kZahlung: ${z.kZahlung}`)
        console.log(`   kBestellung: ${z.kBestellung}`)
        console.log(`   kRechnung: ${z.kRechnung}`)
        console.log(`   Betrag: ${z.fBetrag}`)
        console.log(`   Datum: ${z.dDatum}`)
        console.log(`   Hinweis: ${z.cHinweis}`)
        console.log('')
      })
    } else {
      console.log(`   ❌ Keine Zahlung gefunden für kBestellung=${kExternerBeleg}`)
    }
    
    // 3. Prüfe tBestellung
    console.log(`\n3️⃣ Prüfe tBestellung für kBestellung=${kExternerBeleg}:\n`)
    const bestellung = await pool.request().query(`
      SELECT TOP 1
        b.kBestellung,
        b.cBestellNr,
        b.cZahlungsanbieter
      FROM dbo.tBestellung b
      WHERE b.kBestellung = ${kExternerBeleg}
    `)
    
    if (bestellung.recordset.length > 0) {
      console.log(`   ✅ Bestellung gefunden!`)
      console.log(`   kBestellung: ${bestellung.recordset[0].kBestellung}`)
      console.log(`   cBestellNr: ${bestellung.recordset[0].cBestellNr}`)
      console.log(`   cZahlungsanbieter: ${bestellung.recordset[0].cZahlungsanbieter}`)
      console.log(`   cBestellNrExtern: ${bestellung.recordset[0].cBestellNrExtern}`)
    } else {
      console.log(`   ❌ Keine Bestellung gefunden für kBestellung=${kExternerBeleg}`)
    }
    
    // 4. Teste mit direktem JOIN
    console.log(`\n4️⃣ Teste kompletten JOIN:\n`)
    const complete = await pool.request().query(`
      SELECT TOP 3
        eb.kExternerBeleg,
        eb.cBelegnr,
        z.kZahlung,
        z.fBetrag AS zahlungsBetrag,
        z.dDatum AS zahlungsDatum,
        z.kBestellung AS z_kBestellung,
        b.kBestellung AS b_kBestellung,
        b.cBestellNr,
        b.cBestellNrExtern
      FROM Rechnung.tExternerBeleg eb
      LEFT JOIN dbo.tZahlung z ON z.kBestellung = eb.kExternerBeleg
      LEFT JOIN dbo.tBestellung b ON z.kBestellung = b.kBestellung
      WHERE eb.nBelegtyp = 0
      ORDER BY eb.dBelegdatumUtc DESC
    `)
    
    complete.recordset.forEach(r => {
      console.log(`   Beleg: ${r.cBelegnr}`)
      console.log(`   kExternerBeleg: ${r.kExternerBeleg}`)
      console.log(`   Zahlung: ${r.kZahlung || 'N/A'}`)
      console.log(`   z.kBestellung: ${r.z_kBestellung || 'N/A'}`)
      console.log(`   b.kBestellung: ${r.b_kBestellung || 'N/A'}`)
      console.log(`   Bestellnummer: ${r.cBestellNr || 'N/A'}`)
      console.log(`   Bestellnr Extern: ${r.cBestellNrExtern || 'N/A'}`)
      console.log('')
    })
    
    await pool.close()
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
  }
}

testRelations()
