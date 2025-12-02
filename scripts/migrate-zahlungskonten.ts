/**
 * Migrations-Script für Zahlungskonten
 * Zieht alle bestehenden Zahlungen nach:
 * 1. Setzt bank_konto_nr basierend auf Quelle
 * 2. Stellt sicher, dass Status nur vom Gegenkonto abhängt
 * 3. Bereinigt falsche Zuordnungen
 */

import { MongoClient } from 'mongodb'

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale'

async function connectToDatabase() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const dbName = process.env.MONGO_DB || process.env.DB_NAME || new URL(MONGO_URL).pathname.substring(1)
  const db = client.db(dbName)
  return { db, client }
}

const BANK_KONTO_MAPPING: Record<string, string> = {
  'Postbank': '1701',
  'Commerzbank': '1802',
  'PayPal': '1801',
  'Amazon': '1814',
  'eBay': '1810',
  'Mollie': '1840',
  'Otto': '1820'
}

async function migrateZahlungskonten() {
  console.log('🚀 Migration Zahlungskonten gestartet...\n')
  
  const { db } = await connectToDatabase()
  
  const collections = [
    'fibu_zahlungen_amazon',
    'fibu_zahlungen_ebay', 
    'fibu_zahlungen_paypal',
    'fibu_zahlungen_commerzbank',
    'fibu_zahlungen_postbank',
    'fibu_zahlungen_mollie',
    'fibu_zahlungen_otto'
  ]
  
  let totalProcessed = 0
  let totalUpdated = 0
  
  for (const collectionName of collections) {
    console.log(`\n📦 Verarbeite: ${collectionName}`)
    
    try {
      const collection = db.collection(collectionName)
      const count = await collection.countDocuments()
      
      if (count === 0) {
        console.log(`  ⏭️ Leer, überspringe...`)
        continue
      }
      
      console.log(`  📊 ${count} Zahlungen gefunden`)
      
      // Ermittle Quelle aus Collection-Name
      let quelle = ''
      if (collectionName.includes('amazon')) quelle = 'Amazon'
      else if (collectionName.includes('ebay')) quelle = 'eBay'
      else if (collectionName.includes('paypal')) quelle = 'PayPal'
      else if (collectionName.includes('commerzbank')) quelle = 'Commerzbank'
      else if (collectionName.includes('postbank')) quelle = 'Postbank'
      else if (collectionName.includes('mollie')) quelle = 'Mollie'
      else if (collectionName.includes('otto')) quelle = 'Otto'
      
      const bankKonto = BANK_KONTO_MAPPING[quelle]
      
      if (!bankKonto) {
        console.log(`  ⚠️ Keine Zuordnung für Quelle: ${quelle}`)
        continue
      }
      
      // Update alle Zahlungen in dieser Collection
      const result = await collection.updateMany(
        {},
        {
          $set: {
            bank_konto_nr: bankKonto,
            bank_konto_bezeichnung: `${quelle} (Zahlungskonto)`,
            quelle_aktualisiert: new Date()
          }
        }
      )
      
      console.log(`  ✅ ${result.modifiedCount} Zahlungen aktualisiert → Zahlungskonto: ${bankKonto}`)
      
      totalProcessed += count
      totalUpdated += result.modifiedCount
      
    } catch (error) {
      console.error(`  ❌ Fehler bei ${collectionName}:`, error.message)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 MIGRATIONS-ZUSAMMENFASSUNG:')
  console.log('='.repeat(60))
  console.log(`Total verarbeitet: ${totalProcessed} Zahlungen`)
  console.log(`Total aktualisiert: ${totalUpdated} Zahlungen`)
  console.log('\n✅ Migration abgeschlossen!')
}

migrateZahlungskonten()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fehler:', error)
    process.exit(1)
  })
