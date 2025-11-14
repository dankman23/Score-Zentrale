/**
 * Analyse: Wie matchen wir externe Rechnungen korrekt zu Amazon Payments?
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

async function analyzeMatching() {
  try {
    console.log('🔍 Analysiere Amazon Payment Matching...\n')
    
    const pool = await sql.connect(config)
    
    // 1. Nehme 5 externe Rechnungen aus Oktober 2025
    console.log('1️⃣ Externe Rechnungen aus Oktober 2025:\n')
    const rechnungen = await pool.request().query(`
      SELECT TOP 5
        eb.kExternerBeleg,
        eb.cBelegnr,
        eb.dBelegdatumUtc,
        eck.fVkBrutto
      FROM Rechnung.tExternerBeleg eb
      LEFT JOIN Rechnung.tExternerBelegEckdaten eck ON eb.kExternerBeleg = eck.kExternerBeleg
      WHERE eb.nBelegtyp = 0
        AND eb.dBelegdatumUtc >= '2025-10-01'
        AND eb.dBelegdatumUtc < '2025-11-01'
      ORDER BY eb.dBelegdatumUtc DESC
    `)
    
    console.log('Rechnungen:')
    rechnungen.recordset.forEach(r => {
      console.log(`  ${r.cBelegnr}: ${r.fVkBrutto?.toFixed(2) || 0} EUR am ${new Date(r.dBelegdatumUtc).toLocaleDateString('de-DE')}`)
    })
    
    // 2. Suche Amazon Payments im gleichen Zeitraum
    console.log('\n2️⃣ Amazon Payments aus Oktober 2025:\n')
    const zahlungen = await pool.request().query(`
      SELECT TOP 20
        z.kZahlung,
        z.fBetrag,
        z.dDatum,
        z.cHinweis,
        z.kBestellung,
        z.kRechnung,
        za.cName AS zahlungsart
      FROM dbo.tZahlung z
      LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      WHERE z.dDatum >= '2025-10-01'
        AND z.dDatum < '2025-11-01'
        AND za.cName LIKE '%Amazon%'
      ORDER BY z.dDatum DESC
    `)
    
    console.log(`Gefunden: ${zahlungen.recordset.length} Amazon Payments\n`)
    
    if (zahlungen.recordset.length > 0) {
      zahlungen.recordset.slice(0, 5).forEach(z => {
        console.log(`  ${z.fBetrag?.toFixed(2) || 0} EUR am ${new Date(z.dDatum).toLocaleDateString('de-DE')}`)
        console.log(`     kZahlung: ${z.kZahlung}, kBestellung: ${z.kBestellung}, kRechnung: ${z.kRechnung}`)
        console.log(`     Hinweis: ${z.cHinweis || 'N/A'}`)
        console.log('')
      })
    } else {
      console.log('  ❌ Keine Amazon Payments gefunden im Oktober 2025!')
    }
    
    // 3. Versuche Matching über Betrag
    console.log('\n3️⃣ Matching-Versuch über Betrag (±0.50 EUR Toleranz):\n')
    
    for (const rechnung of rechnungen.recordset) {
      const betrag = rechnung.fVkBrutto
      if (!betrag) continue
      
      const matches = zahlungen.recordset.filter(z => 
        Math.abs(z.fBetrag - betrag) <= 0.50
      )
      
      console.log(`${rechnung.cBelegnr} (${betrag.toFixed(2)} EUR):`)
      if (matches.length > 0) {
        console.log(`  ✅ ${matches.length} mögliche(s) Match(es):`)
        matches.forEach(m => {
          const diff = Math.abs(m.fBetrag - betrag)
          const daysDiff = Math.abs((new Date(m.dDatum) - new Date(rechnung.dBelegdatumUtc)) / (1000 * 60 * 60 * 24))
          console.log(`     ${m.fBetrag.toFixed(2)} EUR (Diff: ${diff.toFixed(2)} EUR, ${daysDiff.toFixed(0)} Tage)`)
        })
      } else {
        console.log(`  ❌ Kein Match gefunden`)
      }
      console.log('')
    }
    
    // 4. Prüfe pf_amazon Tabellen
    console.log('\n4️⃣ Prüfe pf_amazon_bestellung Tabelle:\n')
    try {
      const amazonBestellungen = await pool.request().query(`
        SELECT TOP 5
          kBestellung,
          cBestellNr
        FROM dbo.pf_amazon_bestellung
        WHERE kBestellung IN (${rechnungen.recordset.map(r => r.kExternerBeleg).join(',')})
      `)
      
      if (amazonBestellungen.recordset.length > 0) {
        console.log('✅ Amazon Bestellungen gefunden:')
        amazonBestellungen.recordset.forEach(b => {
          console.log(`  kBestellung: ${b.kBestellung}, Bestellnr: ${b.cBestellNr}`)
        })
      } else {
        console.log('❌ Keine Amazon Bestellungen gefunden für diese kExternerBeleg IDs')
      }
    } catch (e) {
      console.log('❌ Fehler beim Abrufen von pf_amazon_bestellung:', e.message)
    }
    
    await pool.close()
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
  }
}

analyzeMatching()
