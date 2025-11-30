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
// DEFINITIVE LISTE basierend auf fachlicher Vorgabe
const KEINE_BELEGPFLICHT = [
  // === Bank/Zahlung & Transit ===
  '1370', '1460', '1600', '1701', '1800', '1801', '1802', '1810', '1811',
  
  // === Lohn/Steuern/Verrechnung ===
  '3720', '3730', '3740', '3790', '3804', '3806', '3817', '3820', '3837',
  
  // === Löhne/Sozialaufwand ===
  '6020', '6035', '6110',
  
  // === Sammeldebitoren (69001-69020) ===
  '69001', '69002', '69003', '69004', '69005', '69006', '69007', '69008',
  '69010', '69011', '69012', '69013', '69014', '69015', '69016', '69017',
  '69018', '69019', '69020'
]

async function migrate() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db()
    const collection = db.collection('fibu_kontenplan')
    
    // 0. RESET: Entferne alle belegpflicht-Felder für sauberen Neustart
    await collection.updateMany(
      {},
      { $unset: { belegpflicht: "" } }
    )
    console.log('🔄 Alle belegpflicht-Felder zurückgesetzt')
    
    // 1. Zähle alle Konten
    const totalCount = await collection.countDocuments({})
    console.log(`📊 Gefunden: ${totalCount} Konten im Kontenplan`)
    
    // 2. Setze belegpflicht = true für alle Konten der Klassen 4-8
    // WICHTIG: klasse ist String, nicht Number!
    const resultTrue = await collection.updateMany(
      {
        klasse: { $in: ['4', '5', '6', '7', '8'] },
        belegpflicht: { $exists: false }
      },
      {
        $set: { belegpflicht: true }
      }
    )
    console.log(`✅ Belegpflicht = TRUE gesetzt für ${resultTrue.modifiedCount} Konten (Klassen 4-8)`)
    
    // 2b. Stelle sicher, dass Aufwandskonten wie 6770 (Amazongebühren) belegpflichtig sind
    const resultAufwand = await collection.updateMany(
      {
        kontonummer: { $regex: /^(6[0-9]{3}|5[0-9]{3}|4[0-9]{3})$/ },
        kontonummer: { $nin: KEINE_BELEGPFLICHT }
      },
      {
        $set: { belegpflicht: true }
      }
    )
    console.log(`✅ Belegpflicht = TRUE forciert für ${resultAufwand.modifiedCount} Aufwandskonten`)
    
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
    // WICHTIG: klasse ist String!
    const resultOther = await collection.updateMany(
      {
        klasse: { $in: ['0', '1', '2', '3', '9'] },
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
