/**
 * Migration: Belegpflicht-Feld zum Kontenplan hinzufügen
 * 
 * Regel:
 * - Standard: belegpflicht = true für Klassen 4, 5, 6, 7, 8
 * - Ausnahmen: belegpflicht = false für spezielle System-Konten
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale'

// Konten OHNE Belegpflicht (belegpflicht = false)
const KEINE_BELEGPFLICHT = [
  // === 1. Bank- und Zahlungsdienstleisterkonten ===
  '1200', '1210', '1224', // Bankkonten
  '1800', '1810', '1815', '1820', // Zahlungsdienstleister (PayPal, Amazon, etc.)
  '1000', // Kasse
  
  // === 2. Durchlaufende Posten / Geldtransit / Verrechnungskonten ===
  '1360', '1369', '1370', '1371', '1372', '1373', '1374',
  '1600', '1610', // Interne Verrechnungen
  
  // === 3. Steuer-Zahllast-Konten ===
  '1780', '1790', // USt-Zahllast
  '1570', '1576', '1776', // Vorsteuer-Konten
  '1740', '1750', '1760', // Körperschaftsteuer, Gewerbesteuer
  '3730', '3740', '3750', // Steuerschulden
  
  // === 4. Lohn-/Gehaltskonto (Beleg = Lohnjournal) ===
  '6200', '4130', '4140', // Löhne/Gehälter, Sozialabgaben
  
  // === 5. Sammeldebitoren (69xxx) ===
  '69001', '69002', '69003', '69004', '69005', '69006', '69007', '69008',
  '69010', '69011', '69012', '69013', '69014', '69015', '69016', '69017',
  '69018', '69019', '69020',
  
  // === 6. Privatentnahmen/-einlagen ===
  '1890', '2100',
  
  // === 7. Bankgebühren / Zinsen (Kontoauszug reicht) ===
  '4970', '4830', '4831', '4832', '4833', '4834', '4835',
  '2120', '2130' // Zinsen
]

async function migrate() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db()
    const collection = db.collection('fibu_kontenplan')
    
    // 1. Zähle alle Konten
    const totalCount = await collection.countDocuments({})
    console.log(`📊 Gefunden: ${totalCount} Konten im Kontenplan`)
    
    // 2. Setze belegpflicht = true für alle Konten der Klassen 4-8
    const resultTrue = await collection.updateMany(
      {
        klasse: { $in: [4, 5, 6, 7, 8] },
        belegpflicht: { $exists: false }
      },
      {
        $set: { belegpflicht: true }
      }
    )
    console.log(`✅ Belegpflicht = TRUE gesetzt für ${resultTrue.modifiedCount} Konten (Klassen 4-8)`)
    
    // 3. Setze belegpflicht = false für spezielle Konten
    const resultFalse = await collection.updateMany(
      {
        kontonummer: { $in: KEINE_BELEGPFLICHT },
        belegpflicht: { $exists: false }
      },
      {
        $set: { belegpflicht: false }
      }
    )
    console.log(`✅ Belegpflicht = FALSE gesetzt für ${resultFalse.modifiedCount} Konten (Ausnahmen)`)
    
    // 4. Setze belegpflicht = false für alle übrigen Konten (Klassen 0-3, 9)
    const resultOther = await collection.updateMany(
      {
        klasse: { $in: [0, 1, 2, 3, 9] },
        belegpflicht: { $exists: false }
      },
      {
        $set: { belegpflicht: false }
      }
    )
    console.log(`✅ Belegpflicht = FALSE gesetzt für ${resultOther.modifiedCount} Konten (Klassen 0-3, 9)`)
    
    // 5. Fallback: Alle übrigen Konten ohne belegpflicht
    const resultFallback = await collection.updateMany(
      { belegpflicht: { $exists: false } },
      { $set: { belegpflicht: true } }
    )
    console.log(`✅ Belegpflicht = TRUE (Fallback) für ${resultFallback.modifiedCount} übrige Konten`)
    
    // 6. Statistik
    const mitBelegpflicht = await collection.countDocuments({ belegpflicht: true })
    const ohneBelegpflicht = await collection.countDocuments({ belegpflicht: false })
    
    console.log('')
    console.log('📈 Migration abgeschlossen:')
    console.log(`   - Gesamt: ${totalCount} Konten`)
    console.log(`   - Mit Belegpflicht: ${mitBelegpflicht}`)
    console.log(`   - Ohne Belegpflicht: ${ohneBelegpflicht}`)
    
  } catch (error) {
    console.error('❌ Fehler bei Migration:', error)
    throw error
  } finally {
    await client.close()
    console.log('✅ Verbindung geschlossen')
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration erfolgreich!')
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Migration fehlgeschlagen:', error)
      process.exit(1)
    })
}

module.exports = { migrate }
