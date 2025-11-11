#!/usr/bin/env node

/**
 * JTL-Artikel Import Fortsetzungs-Skript
 * 
 * Führt den Import in Batches fort bis alle Artikel importiert sind
 * Mit automatischem Retry bei Fehlern
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const MAX_RETRIES = 3
const RETRY_DELAY = 5000

async function continueImport() {
  console.log('🔄 JTL-Artikel Import wird fortgesetzt...\n')
  
  // Aktuellen Status abrufen
  const statusResponse = await fetch(`${BASE_URL}/api/jtl/articles/import/status`)
  const statusData = await statusResponse.json()
  const currentCount = statusData.imported || 0
  
  console.log(`📊 Aktuell importiert: ${currentCount} Artikel`)
  console.log(`🎯 Ziel: Alle aktiven Artikel ohne Stückliste (~166.854)\n`)
  
  let offset = currentCount // Start ab aktuellem Stand
  let totalImported = 0
  let batchCount = 0
  const batchSize = 5000 // Größere Batches für schnelleren Import
  let consecutiveErrors = 0
  const MAX_CONSECUTIVE_ERRORS = 5
  
  while (true) {
    batchCount++
    console.log(`\n📦 Batch ${batchCount}: Importiere ab Offset ${offset}...`)
    
    let retryCount = 0
    let success = false
    
    // Retry-Loop für diesen Batch
    while (retryCount < MAX_RETRIES && !success) {
      try {
        const response = await fetch(`${BASE_URL}/api/jtl/articles/import/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchSize,
            offset,
            fullImport: false
          }),
          signal: AbortSignal.timeout(120000) // 2 Minuten Timeout
        })
        
        const data = await response.json()
        
        if (!data.ok) {
          console.error('❌ API-Fehler:', data.error)
          retryCount++
          if (retryCount < MAX_RETRIES) {
            console.log(`⏳ Retry ${retryCount}/${MAX_RETRIES} in ${RETRY_DELAY/1000}s...`)
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          }
          continue
        }
        
        totalImported += data.imported
        console.log(`✅ ${data.imported} Artikel importiert (Gesamt: ${data.total})`)
        
        if (data.finished || data.imported === 0) {
          console.log(`\n🎉 Import abgeschlossen!`)
          console.log(`📊 Insgesamt ${data.total} Artikel importiert`)
          return
        }
        
        offset = data.nextOffset
        consecutiveErrors = 0 // Reset Fehlerzähler
        success = true
        
        // Kurze Pause zwischen Batches
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        retryCount++
        consecutiveErrors++
        console.error(`❌ Fehler (${retryCount}/${MAX_RETRIES}):`, error.message)
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`\n🛑 Zu viele aufeinanderfolgende Fehler (${MAX_CONSECUTIVE_ERRORS}). Import abgebrochen.`)
          return
        }
        
        if (retryCount < MAX_RETRIES) {
          console.log(`⏳ Retry ${retryCount}/${MAX_RETRIES} in ${RETRY_DELAY/1000}s...`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        }
      }
    }
    
    if (!success) {
      console.error(`\n❌ Batch ${batchCount} fehlgeschlagen nach ${MAX_RETRIES} Versuchen.`)
      console.log(`💾 Import pausiert bei Offset ${offset}. Neustart möglich.`)
      return
    }
  }
}

continueImport().catch(console.error)
