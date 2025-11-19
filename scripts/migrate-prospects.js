/**
 * Migration: cold_prospects → prospects
 * Migriert alle alten Daten in die neue vereinheitlichte Collection
 */

const { MongoClient } = require('mongodb')

async function migrate() {
  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const client = new MongoClient(uri)
  
  try {
    await client.connect()
    console.log('✓ Verbunden mit MongoDB')
    
    const db = client.db()
    const coldProspects = db.collection('cold_prospects')
    const prospects = db.collection('prospects')
    
    // Zähle Dokumente
    const oldCount = await coldProspects.countDocuments()
    const newCount = await prospects.countDocuments()
    
    console.log(`\n📊 Aktueller Stand:`)
    console.log(`   cold_prospects: ${oldCount} Dokumente`)
    console.log(`   prospects: ${newCount} Dokumente`)
    
    if (oldCount === 0) {
      console.log('\n✓ Keine Migration nötig - cold_prospects ist leer')
      return
    }
    
    console.log(`\n🔄 Migriere ${oldCount} Dokumente...`)
    
    // Alle Dokumente aus cold_prospects holen
    const oldDocs = await coldProspects.find({}).toArray()
    
    let migrated = 0
    let skipped = 0
    
    for (const doc of oldDocs) {
      // Prüfe ob schon in prospects existiert (via website)
      if (doc.website) {
        const existing = await prospects.findOne({ website: doc.website })
        
        if (existing) {
          skipped++
          continue
        }
      }
      
      // Migriere Dokument
      await prospects.insertOne(doc)
      migrated++
      
      if (migrated % 10 === 0) {
        process.stdout.write(`\r   Migriert: ${migrated}/${oldCount}`)
      }
    }
    
    console.log(`\n\n✅ Migration abgeschlossen!`)
    console.log(`   ✓ Migriert: ${migrated}`)
    console.log(`   → Übersprungen (Duplikate): ${skipped}`)
    console.log(`   📊 Gesamt in prospects: ${await prospects.countDocuments()}`)
    
    // WICHTIG: Alte Collection NICHT löschen für Sicherheit
    console.log(`\n⚠️  HINWEIS: cold_prospects wurde NICHT gelöscht`)
    console.log(`   Sie können sie manuell löschen mit: db.cold_prospects.drop()`)
    
  } catch (error) {
    console.error('❌ Fehler:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

migrate()
