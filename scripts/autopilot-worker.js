#!/usr/bin/env node

/**
 * Autopilot Worker - Läuft als unabhängiger Backend-Prozess
 * 
 * Dieser Worker läuft kontinuierlich im Hintergrund und triggert
 * den Autopilot alle 60 Sekunden, unabhängig davon ob jemand
 * auf der Website ist.
 */

const TICK_INTERVAL = 60000 // 60 Sekunden
const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

console.log('[Autopilot Worker] Starting...')
console.log(`[Autopilot Worker] API Base URL: ${API_BASE_URL}`)
console.log(`[Autopilot Worker] Tick Interval: ${TICK_INTERVAL}ms (${TICK_INTERVAL/1000}s)`)

let isProcessing = false
let tickCount = 0
let lastTickTime = null

async function executeTick() {
  // Verhindere überlappende Ticks
  if (isProcessing) {
    console.log('[Autopilot Worker] Previous tick still processing, skipping...')
    return
  }
  
  isProcessing = true
  tickCount++
  lastTickTime = new Date()
  
  const startTime = Date.now()
  console.log(`\n[Autopilot Worker] ====== TICK #${tickCount} ====== ${lastTickTime.toISOString()}`)
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/coldleads/autopilot/tick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AutopilotWorker/1.0'
      },
      timeout: 120000 // 2 Minuten Timeout
    })
    
    const duration = Date.now() - startTime
    
    if (!response.ok) {
      const text = await response.text()
      console.error(`[Autopilot Worker] HTTP ${response.status}: ${text}`)
      return
    }
    
    const result = await response.json()
    
    // Log basierend auf Action
    switch (result.action) {
      case 'skip':
        console.log(`[Autopilot Worker] ⏸️  ${result.reason}`)
        break
      
      case 'limit_reached':
        console.log(`[Autopilot Worker] 🛑 Limit erreicht: ${result.dailyCount}/${result.dailyLimit}`)
        break
      
      case 'email_sent':
        console.log(`[Autopilot Worker] ✅ Email versendet: ${result.prospect.company_name}`)
        console.log(`[Autopilot Worker]    Count: ${result.dailyCount}/${result.dailyLimit}`)
        console.log(`[Autopilot Worker]    Duration: ${result.duration}ms`)
        break
      
      case 'search_no_results':
        console.log(`[Autopilot Worker] 🔍 Keine neuen Firmen gefunden`)
        break
      
      case 'analyzed_but_no_email':
        console.log(`[Autopilot Worker] 📧 Firmen analysiert, aber keine E-Mail gefunden`)
        break
      
      case 'email_failed_continue':
        console.log(`[Autopilot Worker] ⚠️  Email fehlgeschlagen: ${result.prospect}`)
        console.log(`[Autopilot Worker]    Fehler: ${result.error}`)
        break
      
      case 'error':
        console.error(`[Autopilot Worker] ❌ Fehler: ${result.error}`)
        break
      
      default:
        console.log(`[Autopilot Worker] Unknown action: ${result.action}`, result)
    }
    
    console.log(`[Autopilot Worker] Tick completed in ${duration}ms`)
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Autopilot Worker] ❌ Request failed after ${duration}ms:`, error.message)
    
    // Bei Netzwerkfehlern: Prüfe ob der Server überhaupt erreichbar ist
    if (error.code === 'ECONNREFUSED') {
      console.error(`[Autopilot Worker] ⚠️  Next.js Server nicht erreichbar unter ${API_BASE_URL}`)
      console.error(`[Autopilot Worker]    Warte auf Server-Start...`)
    }
  } finally {
    isProcessing = false
  }
}

// Graceful Shutdown Handler
function shutdown() {
  console.log('\n[Autopilot Worker] Shutting down gracefully...')
  console.log(`[Autopilot Worker] Total ticks executed: ${tickCount}`)
  console.log(`[Autopilot Worker] Last tick: ${lastTickTime ? lastTickTime.toISOString() : 'never'}`)
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Health Check Log (alle 10 Minuten)
setInterval(() => {
  const uptime = process.uptime()
  const hours = Math.floor(uptime / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  console.log(`\n[Autopilot Worker] ❤️  Health Check:`)
  console.log(`[Autopilot Worker]    Uptime: ${hours}h ${minutes}m`)
  console.log(`[Autopilot Worker]    Total Ticks: ${tickCount}`)
  console.log(`[Autopilot Worker]    Last Tick: ${lastTickTime ? lastTickTime.toISOString() : 'never'}`)
  console.log(`[Autopilot Worker]    Processing: ${isProcessing ? 'Yes' : 'No'}`)
}, 10 * 60 * 1000)

// Starte ersten Tick nach 10 Sekunden (damit Next.js Zeit hat hochzufahren)
console.log('[Autopilot Worker] Waiting 10s for Next.js to start...')
setTimeout(() => {
  console.log('[Autopilot Worker] Starting tick loop...')
  
  // Führe ersten Tick sofort aus
  executeTick()
  
  // Dann alle 60 Sekunden
  setInterval(executeTick, TICK_INTERVAL)
}, 10000)

console.log('[Autopilot Worker] ✅ Worker initialized and waiting...')
