/**
 * Migriert Oktober 2025 Zahlungen - setzt bank_konto_nr in der Datenbank
 */

import { MongoClient } from 'mongodb'

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale'

const BANK_KONTO_MAPPING: Record<string, { konto: string, bezeichnung: string }> = {
  'amazon': { konto: '1814', bezeichnung: 'Amazon (Zahlungskonto)' },
  'ebay': { konto: '1810', bezeichnung: 'eBay (Zahlungskonto)' },
  'paypal': { konto: '1801', bezeichnung: 'PayPal (Zahlungskonto)' },
  'commerzbank': { konto: '1802', bezeichnung: 'Commerzbank (Zahlungskonto)' },
  'postbank': { konto: '1701', bezeichnung: 'Postbank (Zahlungskonto)' },
  'mollie': { konto: '1840', bezeichnung: 'Mollie (Zahlungskonto)' },
  'otto': { konto: '1820', bezeichnung: 'Otto (Zahlungskonto)' }
}

async function migrateOktober() {
  console.log('🚀 Migration Oktober 2025 Zahlungen...\n')
  
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const dbName = process.env.MONGO_DB || process.env.DB_NAME || new URL(MONGO_URL).pathname.substring(1)
  const db = client.db(dbName)
  
  const fromDate = new Date('2025-10-01')
  const toDate = new Date('2025-10-31T23:59:59')
  
  let totalUpdated = 0
  
  // Finde alle Collections die Zahlungen enthalten könnten
  const allCollections = await db.listCollections().toArray()
  const zahlungsCollections = allCollections
    .map(c => c.name)
    .filter(name => 
      name.includes('paypal') || 
      name.includes('amazon') || 
      name.includes('commerzbank') || 
      name.includes('postbank') ||
      name.includes('mollie') ||
      name.includes('ebay') ||
      name.includes('otto')
    )
  
  console.log(`📦 Gefundene Collections: ${zahlungsCollections.join(', ')}\n`)
  
  for (const collName of zahlungsCollections) {
    console.log(`\n📊 Verarbeite: ${collName}`)
    
    try {
      // Erkenne Quelle aus Collection-Name
      let quelle = ''
      let mapping = null
      
      for (const [key, value] of Object.entries(BANK_KONTO_MAPPING)) {
        if (collName.toLowerCase().includes(key)) {
          quelle = key.charAt(0).toUpperCase() + key.slice(1)
          mapping = value
          break
        }
      }
      
      if (!mapping) {
        console.log(`  ⚠️ Keine Zuordnung für Collection: ${collName}`)
        continue
      }
      
      const collection = db.collection(collName)
      
      // Zähle Oktober-Zahlungen
      const oktoberCount = await collection.countDocuments({
        datum: {
          $gte: fromDate,
          $lte: toDate
        }
      })
      
      if (oktoberCount === 0) {
        console.log(`  ⏭️ Keine Oktober-Zahlungen`)
        continue
      }
      
      console.log(`  📅 ${oktoberCount} Oktober-Zahlungen gefunden`)
      
      // Update alle Oktober-Zahlungen
      const result = await collection.updateMany(
        {
          datum: {
            $gte: fromDate,
            $lte: toDate
          }
        },
        {
          $set: {
            bank_konto_nr: mapping.konto,
            bank_konto_bezeichnung: mapping.bezeichnung,
            migration_datum: new Date()
          }
        }
      )
      
      console.log(`  ✅ ${result.modifiedCount} Zahlungen aktualisiert → ${mapping.konto}`)
      totalUpdated += result.modifiedCount
      
    } catch (error: any) {
      console.error(`  ❌ Fehler bei ${collName}:`, error.message)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log(`✅ MIGRATION ABGESCHLOSSEN: ${totalUpdated} Oktober-Zahlungen aktualisiert`)
  console.log('='.repeat(60))
  
  await client.close()
}

migrateOktober()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fehler:', error)
    process.exit(1)
  })
