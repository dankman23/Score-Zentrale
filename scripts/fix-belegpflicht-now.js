/**
 * SOFORTIGER FIX: Setze belegpflicht für ALLE Konten in 'kontenplan' Collection
 */

const { MongoClient } = require('mongodb')

// Load environment variables manually
const fs = require('fs')
const envContent = fs.readFileSync('/app/.env', 'utf-8')
const MONGO_URL = envContent.match(/MONGO_URL=(.+)/)?.[1] || 'mongodb://localhost:27017/score_zentrale'

// Liste der Konten OHNE Belegpflicht (aus dem Original-Script)
const OHNE_BELEGPFLICHT = [
  '1370', '1460', '1600', '1701', '1800', '1801', '1802', '1810', '1811',
  '1813', '1814', '1815', '1816', '1819', '1820', '1821', '1825',
  '3720', '3730', '3740', '3790', '3804', '3806', '3817', '3820', '3837',
  '6020', '6035', '6110',
  '69001', '69002', '69003', '69004', '69005', '69006', '69007', '69008',
  '69010', '69011', '69012', '69013', '69014', '69015', '69016', '69017',
  '69018', '69019', '69020'
]

async function fixBelegpflicht() {
  const client = new MongoClient(process.env.MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db()
    const collection = db.collection('kontenplan')
    
    console.log('\n=== FIXING kontenplan Collection ===\n')
    
    // 1. Setze ALLE auf true als Basis
    console.log('🔧 SCHRITT 1: Setze alle Konten auf belegpflicht = TRUE...')
    const resultAll = await collection.updateMany(
      {},
      { $set: { belegpflicht: true } }
    )
    console.log(`✅ ${resultAll.modifiedCount} Konten auf TRUE gesetzt`)
    
    // 2. Setze spezifische Konten auf FALSE
    console.log('🔧 SCHRITT 2: Setze Systemkonten auf belegpflicht = FALSE...')
    let falseCount = 0
    
    for (const nr of OHNE_BELEGPFLICHT) {
      const result = await collection.updateOne(
        { kontonummer: nr },
        { $set: { belegpflicht: false } }
      )
      if (result.modifiedCount > 0) {
        falseCount++
        console.log(`  ✅ ${nr} → FALSE`)
      }
    }
    console.log(`✅ ${falseCount} Systemkonten auf FALSE gesetzt`)
    
    // 3. STATISTIK
    console.log('\n📊 ERGEBNIS:')
    const totalCount = await collection.countDocuments({})
    const mitBelegpflicht = await collection.countDocuments({ belegpflicht: true })
    const ohneBelegpflicht = await collection.countDocuments({ belegpflicht: false })
    
    console.log(`  Gesamt: ${totalCount} Konten`)
    console.log(`  MIT Belegpflicht (TRUE): ${mitBelegpflicht}`)
    console.log(`  OHNE Belegpflicht (FALSE): ${ohneBelegpflicht}`)
    
    // 4. VERIFIZIERUNG - Sample einiger Konten
    console.log('\n🔍 VERIFIZIERUNG (Stichprobe):')
    const testKonten = ['1200', '1370', '1800', '1810', '3720', '4120', '6020', '6770']
    
    for (const nr of testKonten) {
      const konto = await collection.findOne({ kontonummer: nr })
      if (konto) {
        const status = konto.belegpflicht ? '✓ TRUE' : '✗ FALSE'
        console.log(`  ${nr} (${konto.bezeichnung}): ${status}`)
      } else {
        console.log(`  ${nr}: [NICHT GEFUNDEN]`)
      }
    }
    
    console.log('\n' + '='.repeat(60))
    
  } catch (error) {
    console.error('❌ Fehler:', error)
    throw error
  } finally {
    await client.close()
    console.log('\n✅ Verbindung geschlossen')
  }
}

// Run
fixBelegpflicht()
  .then(() => {
    console.log('\n🎉 BELEGPFLICHT-FIX ERFOLGREICH!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 FIX FEHLGESCHLAGEN:', error)
    process.exit(1)
  })
