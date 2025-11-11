#!/usr/bin/env node

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function importSmallBatches() {
  console.log('🔄 Cursor-Import (kleine Batches)...\n')
  
  let batch = 0
  const BATCH_SIZE = 1000 // Kleinere Batches
  
  while (true) {
    batch++
    console.log(`\n📦 Batch ${batch}...`)
    
    try {
      const res = await fetch(`${BASE_URL}/api/jtl/articles/import/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: BATCH_SIZE }),
        signal: AbortSignal.timeout(90000)
      })
      
      const data = await res.json()
      
      if (!data.ok || data.imported === 0) {
        console.log('\n🎉 Fertig! Total:', data.totalInDb || 'unbekannt')
        break
      }
      
      console.log(`✅ ${data.imported} importiert → Total: ${data.totalInDb}`)
      
      await new Promise(r => setTimeout(r, 3000)) // 3s Pause
      
    } catch (e) {
      console.error('❌', e.message)
      await new Promise(r => setTimeout(r, 10000))
    }
  }
}

importSmallBatches()
