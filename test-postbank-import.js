/**
 * Test Postbank CSV Import
 */

const fs = require('fs')
const FormData = require('form-data')
const fetch = require('node-fetch')

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function testPostbankImport() {
  console.log('🧪 Teste Postbank CSV Import...\n')
  
  // 1. Lösche alte fehlerhafte Einträge
  console.log('1️⃣ Lösche alte fehlerhafte Einträge...')
  try {
    const { MongoClient } = require('mongodb')
    const client = await MongoClient.connect(process.env.MONGO_URL || 'mongodb://localhost:27017')
    const db = client.db('score_zentrale')
    const collection = db.collection('fibu_bank_import')
    
    const deleteResult = await collection.deleteMany({ 
      $or: [
        { quelle: 'Unbekannt' },
        { betrag: 0 }
      ]
    })
    
    console.log(`   ✅ ${deleteResult.deletedCount} fehlerhafte Einträge gelöscht\n`)
    await client.close()
  } catch (error) {
    console.log(`   ⚠️ Fehler beim Löschen: ${error.message}\n`)
  }
  
  // 2. Teste Import
  console.log('2️⃣ Importiere Postbank CSV...')
  
  // Lade die CSV vom User-Asset
  const csvUrl = 'https://customer-assets.emergentagent.com/job_paydash-11/artifacts/4uwmilgf_Kontoumsaetze_209_5294483_00_20251113_154009.csv'
  
  try {
    const csvResponse = await fetch(csvUrl)
    const csvBuffer = await csvResponse.buffer()
    
    // Erstelle FormData
    const formData = new FormData()
    formData.append('file', csvBuffer, {
      filename: 'postbank.csv',
      contentType: 'text/csv'
    })
    
    // Sende zum Import
    const response = await fetch(`${baseUrl}/api/fibu/bank-import`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    })
    
    const result = await response.json()
    
    if (result.ok) {
      console.log(`   ✅ Import erfolgreich!`)
      console.log(`   📊 Importiert: ${result.imported} von ${result.total}`)
      console.log(`   📦 Format: ${result.format}`)
      
      if (result.errors && result.errors.length > 0) {
        console.log(`   ⚠️ Fehler: ${result.errors.length}`)
        result.errors.slice(0, 3).forEach(err => console.log(`      - ${err}`))
      }
    } else {
      console.log(`   ❌ Import fehlgeschlagen: ${result.error}`)
    }
    
  } catch (error) {
    console.log(`   ❌ Fehler: ${error.message}`)
  }
  
  // 3. Prüfe importierte Daten
  console.log('\n3️⃣ Prüfe importierte Transaktionen...')
  try {
    const response = await fetch(`${baseUrl}/api/fibu/bank-import?limit=10`)
    const data = await response.json()
    
    if (data.ok && data.transaktionen) {
      console.log(`   ✅ ${data.transaktionen.length} Transaktionen gefunden\n`)
      
      // Zeige erste 3
      data.transaktionen.slice(0, 3).forEach((tx, i) => {
        console.log(`   ${i+1}. ${new Date(tx.datum).toLocaleDateString('de-DE')}`)
        console.log(`      Betrag: ${tx.betrag?.toFixed(2) || 0}€`)
        console.log(`      Von/An: ${tx.auftraggeber || 'N/A'}`)
        console.log(`      Hinweis: ${tx.verwendungszweck?.substring(0, 60) || 'N/A'}...`)
        console.log(`      Quelle: ${tx.quelle}`)
        console.log('')
      })
    }
  } catch (error) {
    console.log(`   ❌ Fehler: ${error.message}`)
  }
  
  // 4. Prüfe ob in Zahlungen-Modul sichtbar
  console.log('4️⃣ Prüfe Zahlungen-Modul...')
  try {
    const response = await fetch(`${baseUrl}/api/fibu/zahlungen?from=2025-10-01&to=2025-11-30&limit=500`)
    const data = await response.json()
    
    if (data.ok && data.zahlungen) {
      const postbankZahlungen = data.zahlungen.filter(z => 
        z.zahlungsanbieter === 'Postbank' || z.quelle === 'postbank'
      )
      
      if (postbankZahlungen.length > 0) {
        console.log(`   ✅ ${postbankZahlungen.length} Postbank-Zahlungen im Zahlungen-Modul sichtbar`)
      } else {
        console.log(`   ⚠️ Keine Postbank-Zahlungen im Zahlungen-Modul gefunden`)
        console.log(`   Möglicher Grund: Bank-Import und Zahlungen sind getrennte Collections`)
      }
    }
  } catch (error) {
    console.log(`   ❌ Fehler: ${error.message}`)
  }
}

testPostbankImport()
