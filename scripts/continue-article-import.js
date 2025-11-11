#!/usr/bin/env node

/**
 * JTL-Artikel Import Fortsetzungs-Skript
 * 
 * Führt den Import in Batches fort bis alle Artikel importiert sind
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function continueImport() {
  console.log('🔄 JTL-Artikel Import wird fortgesetzt...\n')
  
  // Aktuellen Status abrufen
  const statusResponse = await fetch(`${BASE_URL}/api/jtl/articles/import/status`)
  const statusData = await statusResponse.json()
  const currentCount = statusData.imported || 0
  
  console.log(`📊 Aktuell importiert: ${currentCount} Artikel`)
  console.log(`🎯 Ziel: ~166.854 Artikel\n`)
  
  const TARGET_COUNT = 166854 // Maximale Anzahl zu importierender Artikel
  
  if (currentCount >= TARGET_COUNT) {
    console.log(`✅ Import bereits abgeschlossen! ${currentCount} Artikel importiert.`)
    return
  }
  
  let offset = currentCount // Start ab aktuellem Stand
  let totalImported = 0
  let batchCount = 0
  const batchSize = 5000 // Größere Batches für schnelleren Import
  
  while (offset < TARGET_COUNT) {
    batchCount++
    console.log(`\n📦 Batch ${batchCount}: Importiere ab Offset ${offset}...`)
    
    try {
      const response = await fetch(`${BASE_URL}/api/jtl/articles/import/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchSize,
          offset,
          fullImport: false
        })
      })
      
      const data = await response.json()
      
      if (!data.ok) {
        console.error('❌ Fehler:', data.error)
        break
      }
      
      totalImported += data.imported
      console.log(`✅ ${data.imported} Artikel importiert (Gesamt: ${data.total})`)
      
      // Stoppe wenn Ziel erreicht
      if (data.total >= TARGET_COUNT) {
        console.log(`\n🎉 Ziel erreicht! ${data.total} Artikel importiert (Limit: ${TARGET_COUNT})`)
        break
      }
      
      if (data.finished) {
        console.log(`\n🎉 Import abgeschlossen!`)
        console.log(`📊 Insgesamt ${data.total} Artikel importiert`)
        break
      }
      
      offset = data.nextOffset
      
      // Kurze Pause zwischen Batches
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      console.error('❌ Netzwerkfehler:', error.message)
      break
    }
  }
}

continueImport().catch(console.error)
