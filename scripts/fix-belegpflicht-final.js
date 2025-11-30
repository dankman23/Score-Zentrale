/**
 * FINALER FIX: Belegpflicht korrekt setzen
 * 
 * 1. Prüft ob alle Systemkonten existieren
 * 2. Legt fehlende Konten an
 * 3. Setzt Belegpflicht HART (überschreibt bestehende Werte)
 */

const { MongoClient } = require('mongodb')
const fs = require('fs')

// Parse .env
const envContent = fs.readFileSync('/app/.env', 'utf8')
const MONGO_URL = envContent.split('\n').find(line => line.startsWith('MONGO_URL=')).split('=')[1].trim()

// DEFINITIVE Liste: Konten OHNE Belegpflicht
const SYSTEMKONTEN_OHNE_BELEGPFLICHT = {
  // Bank/Payment/Transit
  '1370': { bezeichnung: 'Durchlaufende Posten', klasse: '1' },
  '1460': { bezeichnung: 'Geldtransit', klasse: '1' },
  '1600': { bezeichnung: 'Verrechnungskonten', klasse: '1' },
  '1701': { bezeichnung: 'Privates Verrechnungskonto', klasse: '1' },
  '1800': { bezeichnung: 'Bank', klasse: '1' },
  '1801': { bezeichnung: 'PayPal', klasse: '1' },
  '1802': { bezeichnung: 'Stripe', klasse: '1' },
  '1810': { bezeichnung: 'Commerzbank', klasse: '1' },
  '1811': { bezeichnung: 'Postbank', klasse: '1' },
  '1813': { bezeichnung: 'Mollie', klasse: '1' },
  '1814': { bezeichnung: 'eBay Managed Payments', klasse: '1' },
  '1815': { bezeichnung: 'Amazon Settlement', klasse: '1' },
  '1816': { bezeichnung: 'Kaufland', klasse: '1' },
  '1819': { bezeichnung: 'Otto', klasse: '1' },
  '1820': { bezeichnung: 'Kreditkarten', klasse: '1' },
  '1821': { bezeichnung: 'Ratepay', klasse: '1' },
  '1825': { bezeichnung: 'Kasse', klasse: '1' },
  
  // Lohn/Steuern/Verrechnung
  '3720': { bezeichnung: 'Verbindlichkeiten aus Lohn und Gehalt', klasse: '3' },
  '3730': { bezeichnung: 'Umsatzsteuer-Zahllast', klasse: '3' },
  '3740': { bezeichnung: 'Sonstige Verbindlichkeiten', klasse: '3' },
  '3790': { bezeichnung: 'Durchlaufende Posten (Passiva)', klasse: '3' },
  '3804': { bezeichnung: 'Umsatzsteuer Vorjahr', klasse: '3' },
  '3806': { bezeichnung: 'Umsatzsteuer 19 %', klasse: '3' },
  '3817': { bezeichnung: 'Umsatzsteuer aus ig. Erwerb 19 %', klasse: '3' },
  '3820': { bezeichnung: 'Umsatzsteuer Vorjahre', klasse: '3' },
  '3837': { bezeichnung: 'Umsatzsteuer Vorauszahlungen', klasse: '3' },
  
  // Löhne/Sozialaufwand
  '6020': { bezeichnung: 'Gehälter', klasse: '6' },
  '6035': { bezeichnung: 'Gesetzliche soziale Aufwendungen', klasse: '6' },
  '6110': { bezeichnung: 'Lohnfortzahlung', klasse: '6' },
  
  // Sammeldebitoren
  '69001': { bezeichnung: 'Sammelkonto Amazon Payment', klasse: '6' },
  '69002': { bezeichnung: 'Sammelkonto Bar', klasse: '6' },
  '69003': { bezeichnung: 'Sammelkonto eBay Managed Payments', klasse: '6' },
  '69004': { bezeichnung: 'Sammelkonto eBay Rechnungskauf', klasse: '6' },
  '69005': { bezeichnung: 'Sammelkonto EPS', klasse: '6' },
  '69006': { bezeichnung: 'Sammelkonto GiroPay', klasse: '6' },
  '69007': { bezeichnung: 'Sammelkonto Kaufland.de', klasse: '6' },
  '69008': { bezeichnung: 'Sammelkonto Kreditkarte', klasse: '6' },
  '69010': { bezeichnung: 'Sammelkonto Nachnahme', klasse: '6' },
  '69011': { bezeichnung: 'Sammelkonto Otto.de', klasse: '6' },
  '69012': { bezeichnung: 'Sammelkonto PayPal', klasse: '6' },
  '69013': { bezeichnung: 'Sammelkonto PayPal Express', klasse: '6' },
  '69014': { bezeichnung: 'Sammelkonto Ratepay', klasse: '6' },
  '69015': { bezeichnung: 'Sammelkonto Rechnung', klasse: '6' },
  '69016': { bezeichnung: 'Sammelkonto Rechnungskauf', klasse: '6' },
  '69017': { bezeichnung: 'Sammelkonto Scheck', klasse: '6' },
  '69018': { bezeichnung: 'Sammelkonto Überweisung/Vorkasse', klasse: '6' },
  '69019': { bezeichnung: 'Sammelkonto Überweisung mit Skonto', klasse: '6' },
  '69020': { bezeichnung: 'Sammelkonto Mollie', klasse: '6' }
}

async function fixBelegpflicht() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db()
    const collection = db.collection('fibu_kontenplan')
    
    // 1. PRÜFE & LEGE FEHLENDE KONTEN AN
    console.log('\n📋 SCHRITT 1: Prüfe Systemkonten...')
    
    let angelegtCount = 0
    for (const [kontonummer, info] of Object.entries(SYSTEMKONTEN_OHNE_BELEGPFLICHT)) {
      const exists = await collection.findOne({ kontonummer })
      
      if (!exists) {
        console.log(`  ➕ Lege an: ${kontonummer} - ${info.bezeichnung}`)
        await collection.insertOne({
          kontonummer,
          bezeichnung: info.bezeichnung,
          klasse: info.klasse,
          belegpflicht: false,
          istSystemkonto: true,
          istAktiv: true,
          created_at: new Date()
        })
        angelegtCount++
      }
    }
    console.log(`✅ ${angelegtCount} Systemkonten angelegt`)
    
    // 2. SETZE BELEGPFLICHT = FALSE (HART, überschreibt bestehende Werte)
    console.log('\n🔧 SCHRITT 2: Setze belegpflicht = FALSE für Systemkonten...')
    
    const kontonummern = Object.keys(SYSTEMKONTEN_OHNE_BELEGPFLICHT)
    const resultFalse = await collection.updateMany(
      { kontonummer: { $in: kontonummern } },
      { $set: { belegpflicht: false } }
    )
    console.log(`✅ ${resultFalse.modifiedCount} Konten auf belegpflicht = FALSE gesetzt`)
    
    // 3. SETZE ALLE ANDEREN AUF TRUE
    console.log('\n🔧 SCHRITT 3: Setze alle anderen Konten auf belegpflicht = TRUE...')
    
    const resultTrue = await collection.updateMany(
      { kontonummer: { $nin: kontonummern } },
      { $set: { belegpflicht: true } }
    )
    console.log(`✅ ${resultTrue.modifiedCount} Konten auf belegpflicht = TRUE gesetzt`)
    
    // 4. STATISTIK
    console.log('\n📊 ERGEBNIS:')
    const totalCount = await collection.countDocuments({})
    const mitBelegpflicht = await collection.countDocuments({ belegpflicht: true })
    const ohneBelegpflicht = await collection.countDocuments({ belegpflicht: false })
    
    console.log(`  Gesamt: ${totalCount} Konten`)
    console.log(`  MIT Belegpflicht: ${mitBelegpflicht}`)
    console.log(`  OHNE Belegpflicht: ${ohneBelegpflicht}`)
    
    // 5. VERIFIZIERUNG - Zeige konkrete Beispiele
    console.log('\n🔍 VERIFIZIERUNG:')
    
    const testKonten = ['1800', '1810', '1815', '3720', '3806', '6020', '4120', '4400', '5200', '6770']
    console.log('  Erwarte FALSE bei: 1800, 1810, 1815, 3720, 3806, 6020')
    console.log('  Erwarte TRUE bei: 4120, 4400, 5200, 6770')
    
    for (const nr of testKonten) {
      const konto = await collection.findOne({ kontonummer: nr })
      if (konto) {
        const status = konto.belegpflicht ? '✓ TRUE' : '✗ FALSE'
        console.log(`  ${nr}: ${status}`)
      } else {
        console.log(`  ${nr}: ⚠️  NICHT GEFUNDEN`)
      }
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error)
    throw error
  } finally {
    await client.close()
    console.log('\n✅ Verbindung geschlossen')
  }
}

// Run
if (require.main === module) {
  fixBelegpflicht()
    .then(() => {
      console.log('\n🎉 BELEGPFLICHT-FIX ERFOLGREICH!')
      process.exit(0)
    })
    .catch(error => {
      console.error('\n💥 FIX FEHLGESCHLAGEN:', error)
      process.exit(1)
    })
}

module.exports = { fixBelegpflicht }
