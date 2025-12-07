#!/usr/bin/env node

/**
 * Nächtlicher JTL-Sync Cron Job
 * Läuft jeden Tag um 2:00 Uhr
 */

const https = require('https')

const API_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function runSync() {
  const startTime = Date.now()
  console.log(`[${new Date().toISOString()}] Starting nightly JTL sync...`)
  
  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/coldleads/jtl-customers/sync-daily`
    
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 3600000 // 1 Stunde Timeout
    }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        
        try {
          const result = JSON.parse(data)
          
          if (result.ok) {
            console.log(`[${new Date().toISOString()}] ✅ Sync successful in ${duration}s`)
            console.log(`  New: ${result.new_customers}`)
            console.log(`  Updated: ${result.updated}`)
            console.log(`  Unchanged: ${result.unchanged}`)
            console.log(`  Total: ${result.total}`)
            resolve(result)
          } else {
            console.error(`[${new Date().toISOString()}] ❌ Sync failed: ${result.error}`)
            reject(new Error(result.error))
          }
        } catch (e) {
          console.error(`[${new Date().toISOString()}] ❌ Failed to parse response:`, e.message)
          reject(e)
        }
      })
    })
    
    req.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] ❌ Request error:`, error.message)
      reject(error)
    })
    
    req.on('timeout', () => {
      req.destroy()
      console.error(`[${new Date().toISOString()}] ❌ Request timeout`)
      reject(new Error('Request timeout'))
    })
    
    req.end()
  })
}

// Führe Sync aus
runSync()
  .then(() => {
    console.log(`[${new Date().toISOString()}] Nightly sync completed successfully`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(`[${new Date().toISOString()}] Nightly sync failed:`, error.message)
    process.exit(1)
  })
