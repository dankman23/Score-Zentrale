/**
 * AUFRÄUMEN: Alte fibu_kontenplan Collection archivieren/löschen
 * 
 * Hintergrund:
 * - Es gab zwei Collections: `kontenplan` (korrekt) und `fibu_kontenplan` (veraltet)
 * - Die API verwendet jetzt ausschließlich `kontenplan`
 * - Die alte Collection kann entfernt werden
 */

const { MongoClient } = require('mongodb')

// Load environment variables manually
const fs = require('fs')
const envContent = fs.readFileSync('/app/.env', 'utf-8')
const MONGO_URL = envContent.match(/MONGO_URL=(.+)/)?.[1] || 'mongodb://localhost:27017/score_zentrale'

async function cleanupOldKontenplan() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db()
    
    console.log('\n=== KONTENPLAN CLEANUP ===\n')
    
    // 1. Prüfe welche Collections existieren
    const collections = await db.listCollections().toArray()
    const collectionNames = collections.map(c => c.name)
    
    console.log('📋 Vorhandene Kontenplan-Collections:')
    const kontenplanCollections = collectionNames.filter(name => 
      name.includes('kontenplan') || name.includes('ARCHIV')
    )
    kontenplanCollections.forEach(name => console.log(`  - ${name}`))
    
    // 2. Archiviere fibu_kontenplan, falls vorhanden
    if (collectionNames.includes('fibu_kontenplan')) {
      console.log('\n🔧 Archiviere "fibu_kontenplan" Collection...')
      
      const count = await db.collection('fibu_kontenplan').countDocuments({})
      console.log(`  Anzahl Dokumente: ${count}`)
      
      if (count > 0) {
        // Umbenennen zu Archiv
        await db.collection('fibu_kontenplan').rename('_ARCHIV_fibu_kontenplan_deprecated')
        console.log('  ✅ Umbenannt zu: _ARCHIV_fibu_kontenplan_deprecated')
      } else {
        // Wenn leer, einfach löschen
        await db.collection('fibu_kontenplan').drop()
        console.log('  ✅ Gelöscht (war leer)')
      }
    } else {
      console.log('\n✅ "fibu_kontenplan" existiert nicht (bereits aufgeräumt)')
    }
    
    // 3. Lösche sehr alte Archive (falls vorhanden)
    if (collectionNames.includes('_ARCHIV_fibu_kontenplan_old')) {
      console.log('\n🗑️  Lösche altes Archiv "_ARCHIV_fibu_kontenplan_old"...')
      await db.collection('_ARCHIV_fibu_kontenplan_old').drop()
      console.log('  ✅ Gelöscht')
    }
    
    // 4. Verifiziere die aktive Collection
    console.log('\n📊 VERIFIZIERUNG der aktiven "kontenplan" Collection:')
    const kontenplanCount = await db.collection('kontenplan').countDocuments({})
    const mitBelegpflicht = await db.collection('kontenplan').countDocuments({ belegpflicht: true })
    const ohneBelegpflicht = await db.collection('kontenplan').countDocuments({ belegpflicht: false })
    
    console.log(`  Gesamt: ${kontenplanCount} Konten`)
    console.log(`  MIT Belegpflicht: ${mitBelegpflicht}`)
    console.log(`  OHNE Belegpflicht: ${ohneBelegpflicht}`)
    
    // 5. Final - Liste aller Collections
    console.log('\n📋 Verbleibende Kontenplan-Collections:')
    const finalCollections = await db.listCollections().toArray()
    const finalKontenplan = finalCollections
      .map(c => c.name)
      .filter(name => name.includes('kontenplan'))
    
    finalKontenplan.forEach(name => {
      if (name === 'kontenplan') {
        console.log(`  ✅ ${name} (AKTIV)`)
      } else {
        console.log(`  📦 ${name} (Archiv)`)
      }
    })
    
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
cleanupOldKontenplan()
  .then(() => {
    console.log('\n🎉 CLEANUP ERFOLGREICH!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 CLEANUP FEHLGESCHLAGEN:', error)
    process.exit(1)
  })
