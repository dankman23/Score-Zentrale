/**
 * KRITISCHER FIX: Entferne Konto 70000 (existiert nicht!)
 * Ersetze durch korrekte Konten: 1701 (Postbank Bank) oder 69018 (Überweisung Debitor)
 */

const { MongoClient } = require('mongodb')
const fs = require('fs')

const envContent = fs.readFileSync('/app/.env', 'utf-8')
const MONGO_URL = envContent.match(/MONGO_URL=(.+)/)?.[1]

async function fixKonto70000() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden\n')
    
    const db = client.db()
    
    console.log('=== SCHRITT 1: SUCHE NACH KONTO 70000 ===\n')
    
    const collections = [
      'fibu_paypal_transactions',
      'fibu_commerzbank_transactions',
      'fibu_postbank_transactions',
      'fibu_amazon_settlements',
      'fibu_ebay_transactions',
      'fibu_mollie_transactions'
    ]
    
    let totalFound = 0
    let totalFixed = 0
    
    for (const collName of collections) {
      const count = await db.collection(collName).countDocuments({
        $or: [
          { zugeordnetesKonto: '70000' },
          { konto_id: '70000' }
        ]
      })
      
      if (count > 0) {
        console.log(`📦 ${collName}: ${count} Zahlungen mit 70000`)
        totalFound += count
        
        // Sample zeigen
        const samples = await db.collection(collName).find({
          $or: [
            { zugeordnetesKonto: '70000' },
            { konto_id: '70000' }
          ]
        }).limit(2).toArray()
        
        samples.forEach(s => {
          console.log(`   - ${s.datum}: ${s.betrag} EUR, Anbieter: ${s.anbieter}`)
        })
        
        // FIX: Ersetze 70000 durch korrektes Konto
        // Logik: Postbank-Zahlungen → 1701 (Bankkonto)
        //        Andere → 69018 (Überweisung Debitor)
        
        const result = await db.collection(collName).updateMany(
          { 
            $or: [
              { zugeordnetesKonto: '70000' },
              { konto_id: '70000' }
            ]
          },
          {
            $set: {
              zugeordnetesKonto: collName.includes('postbank') ? '1701' : '69018',
              konto_id: collName.includes('postbank') ? '1701' : '69018'
            }
          }
        )
        
        console.log(`   ✅ ${result.modifiedCount} Zahlungen korrigiert\n`)
        totalFixed += result.modifiedCount
      }
    }
    
    console.log('=== SCHRITT 2: KONTENPLAN PRÜFEN ===\n')
    
    const konto70000 = await db.collection('kontenplan').findOne({ kontonummer: '70000' })
    
    if (konto70000) {
      console.log('⚠️  Konto 70000 existiert im Kontenplan - LÖSCHE ES!')
      await db.collection('kontenplan').deleteOne({ kontonummer: '70000' })
      console.log('✅ Konto 70000 aus Kontenplan gelöscht\n')
    } else {
      console.log('✅ Konto 70000 existiert nicht im Kontenplan (korrekt)\n')
    }
    
    console.log('=== SCHRITT 3: VERIFIZIERUNG ===\n')
    
    // Prüfe ob 70000 noch existiert
    let stillExists = 0
    for (const collName of collections) {
      const count = await db.collection(collName).countDocuments({
        $or: [
          { zugeordnetesKonto: '70000' },
          { konto_id: '70000' }
        ]
      })
      stillExists += count
    }
    
    if (stillExists > 0) {
      console.log(`❌ FEHLER: ${stillExists} Zahlungen haben immer noch 70000!`)
    } else {
      console.log('✅ Konto 70000 komplett entfernt!')
    }
    
    // Zeige neue Konten-Verteilung für Postbank
    const postbankMit1701 = await db.collection('fibu_postbank_transactions').countDocuments({
      $or: [
        { zugeordnetesKonto: '1701' },
        { konto_id: '1701' }
      ]
    })
    
    const postbankMit69018 = await db.collection('fibu_postbank_transactions').countDocuments({
      $or: [
        { zugeordnetesKonto: '69018' },
        { konto_id: '69018' }
      ]
    })
    
    console.log('\n📊 POSTBANK-ZAHLUNGEN:')
    console.log(`   Mit Konto 1701 (Postbank Bank): ${postbankMit1701}`)
    console.log(`   Mit Konto 69018 (Überweisung): ${postbankMit69018}`)
    
    console.log('\n' + '='.repeat(60))
    console.log(`📋 ZUSAMMENFASSUNG:`)
    console.log(`   Gefunden:   ${totalFound} Zahlungen mit 70000`)
    console.log(`   Korrigiert: ${totalFixed} Zahlungen`)
    console.log(`   Status:     ${stillExists === 0 ? '✅ ERFOLGREICH' : '❌ FEHLER'}`)
    console.log('='.repeat(60))
    
  } catch (error) {
    console.error('❌ Fehler:', error)
    throw error
  } finally {
    await client.close()
    console.log('\n✅ Verbindung geschlossen')
  }
}

fixKonto70000()
  .then(() => {
    console.log('\n🎉 KONTO 70000 ERFOLGREICH ENTFERNT!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 FIX FEHLGESCHLAGEN:', error)
    process.exit(1)
  })
