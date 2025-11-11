#!/usr/bin/env node

/**
 * JTL-Artikel Import mit CURSOR-basierter Pagination
 * Nutzt kArtikel > lastKArtikel statt OFFSET
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function cursorBasedImport() {
  console.log('🔄 JTL-Artikel Import (CURSOR-basiert)...\n')
  
  let batchCount = 0
  const batchSize = 5000
  
  while (true) {
    batchCount++
    console.log(`\n📦 Batch ${batchCount}: Importiere Artikel (cursor-basiert)...`)
    
    try {
      const response = await fetch(`${BASE_URL}/api/jtl/articles/import/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize }),
        signal: AbortSignal.timeout(120000)
      })
      
      if (!response.ok) {
        console.error('❌ HTTP-Fehler:', response.status)
        break
      }
      
      const data = await response.json()
      
      if (!data.ok) {
        console.error('❌ API-Fehler:', data.error)
        break
      }
      
      console.log(`✅ ${data.imported} Artikel importiert`)
      console.log(`📊 Gesamt in DB: ${data.totalInDb}`)
      console.log(`🎯 Ziel: ${data.totalInJtl}`)
      
      // Stoppen wenn keine Artikel mehr importiert wurden
      if (data.imported === 0 || data.finished) {
        console.log(`\n🎉 Import abgeschlossen!`)
        console.log(`📊 ${data.totalInDb} Artikel in MongoDB`)
        console.log(`🎯 ${data.totalInJtl} Artikel in JTL`)
        break
      }
      
      // Pause zwischen Batches
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error) {
      console.error('❌ Fehler:', error.message)
      console.log('⏳ Warte 10s und versuche es erneut...')
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
}

cursorBasedImport().catch(console.error)
