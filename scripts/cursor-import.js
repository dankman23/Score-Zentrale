#!/usr/bin/env node

/**
 * JTL-Artikel Import mit CURSOR-basierter Pagination
 * Nutzt kArtikel > lastKArtikel statt OFFSET
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const MAX_RETRIES = 3
const RETRY_DELAY = 5000

async function cursorBasedImport() {
  console.log('🔄 JTL-Artikel Import (CURSOR-basiert)...\n')
  
  let batchCount = 0
  const batchSize = 5000
  let consecutiveErrors = 0
  const MAX_CONSECUTIVE_ERRORS = 5
  
  while (true) {
    batchCount++
    console.log(`\n📦 Batch ${batchCount}: Importiere Artikel (cursor-basiert)...`)
    
    let retryCount = 0
    let success = false
    
    while (retryCount < MAX_RETRIES && !success) {
      try {
        const response = await fetch(`${BASE_URL}/api/jtl/articles/import/continue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize }),
          signal: AbortSignal.timeout(120000)
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
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
        
        console.log(`✅ ${data.imported} Artikel importiert`)
        console.log(`📊 Gesamt in DB: ${data.totalInDb || data.total}`)
        console.log(`🎯 Ziel (JTL): ${data.totalInJtl || 166854}`)
        if (data.lastKArtikel) {
          console.log(`   Letzter kArtikel: ${data.lastKArtikel}`)
        }
        
        // Stoppen wenn keine Artikel mehr importiert wurden
        if (data.imported === 0 || data.finished) {
          console.log(`\n🎉 Import abgeschlossen!`)
          console.log(`📊 ${data.totalInDb || data.total} Artikel in MongoDB`)
          console.log(`🎯 ${data.totalInJtl || 166854} Artikel in JTL (importierbar)`)
          return
        }
        
        consecutiveErrors = 0
        success = true
        
        // Pause zwischen Batches
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        retryCount++
        consecutiveErrors++
        console.error(`❌ Fehler (${retryCount}/${MAX_RETRIES}):`, error.message)
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`\n🛑 Zu viele Fehler (${MAX_CONSECUTIVE_ERRORS}). Import abgebrochen.`)
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
      console.log(`💾 Import kann jederzeit neu gestartet werden (cursor-basiert).`)
      return
    }
  }
}

cursorBasedImport().catch(console.error)
