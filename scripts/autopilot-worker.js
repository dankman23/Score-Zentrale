#!/usr/bin/env node

/**
 * Autopilot Worker - Läuft als unabhängiger Backend-Prozess
 * 
 * Dieser Worker läuft kontinuierlich im Hintergrund und triggert
 * den Autopilot alle 60 Sekunden, unabhängig davon ob jemand
 * auf der Website ist.
 * 
 * Features:
 * - Automatisches Retry bei Fehlern
 * - Health-Check des Next.js Servers
 * - Exponentieller Backoff bei wiederholten Fehlern
 * - Automatisches Wiederverbinden nach Server-Neustarts
 */

const TICK_INTERVAL = 60000 // 60 Sekunden
const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const MAX_RETRIES = 3
const HEALTH_CHECK_INTERVAL = 30000 // 30 Sekunden zwischen Health-Checks bei Problemen

console.log('[Autopilot Worker] Starting...')
console.log(`[Autopilot Worker] API Base URL: ${API_BASE_URL}`)
console.log(`[Autopilot Worker] Tick Interval: ${TICK_INTERVAL}ms (${TICK_INTERVAL/1000}s)`)

let isProcessing = false
let tickCount = 0
let lastTickTime = null
let consecutiveErrors = 0
let serverHealthy = false
let lastHealthCheck = null

async function executeTick() {
  // Verhindere überlappende Ticks
  if (isProcessing) {
    console.log('[Autopilot Worker] Previous tick still processing, skipping...')
    return
  }
  
  // Wenn Server unhealthy ist, überspringe Tick
  if (!serverHealthy && consecutiveErrors > 2) {
    console.log('[Autopilot Worker] Server unhealthy, skipping tick until server recovers...')
    return
  }
  
  // Warte bei wiederholten Fehlern (exponentieller Backoff)
  const backoffDelay = getBackoffDelay()
  if (backoffDelay > 0) {
    console.log(`[Autopilot Worker] Waiting ${backoffDelay/1000}s before next attempt (backoff)...`)
    await new Promise(resolve => setTimeout(resolve, backoffDelay))
  }
  
  isProcessing = true
  tickCount++
  lastTickTime = new Date()
  
  const startTime = Date.now()
  console.log(`\n[Autopilot Worker] ====== TICK #${tickCount} ====== ${lastTickTime.toISOString()}`)
  
  let retryCount = 0
  let success = false
  
  while (retryCount < MAX_RETRIES && !success) {
    try {
      if (retryCount > 0) {
        console.log(`[Autopilot Worker] Retry attempt ${retryCount}/${MAX_RETRIES}...`)
      }
      
      const response = await fetch(`${API_BASE_URL}/api/coldleads/autopilot/tick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AutopilotWorker/1.0'
        },
        timeout: 120000 // 2 Minuten Timeout
      })
      
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API returned error ${response.status}: ${text}`)
      }
      
      const result = await response.json()
      const duration = Date.now() - startTime
      
      // Erfolg! Reset error counter
      consecutiveErrors = 0
      serverHealthy = true
      success = true
      
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
      retryCount++
      const duration = Date.now() - startTime
      
      // Bei Netzwerkfehlern: Prüfe ob der Server überhaupt erreichbar ist
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.message.includes('ECONNREFUSED')) {
        console.error(`[Autopilot Worker] ⚠️  Next.js Server nicht erreichbar unter ${API_BASE_URL}`)
        serverHealthy = false
        
        // Versuche Health-Check
        await checkServerHealth()
        
        if (retryCount < MAX_RETRIES) {
          console.log(`[Autopilot Worker]    Warte 10s vor erneutem Versuch...`)
          await new Promise(resolve => setTimeout(resolve, 10000))
        }
      } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        console.error(`[Autopilot Worker] ⏱️  Request Timeout nach ${duration}ms`)
        console.error(`[Autopilot Worker]    Dies kann bei langsamen API-Anfragen oder Server-Überlastung passieren.`)
        
        if (retryCount < MAX_RETRIES) {
          console.log(`[Autopilot Worker]    Warte 5s vor erneutem Versuch...`)
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      } else {
        console.error(`[Autopilot Worker] ❌ Request failed after ${duration}ms:`, error.message)
        
        if (retryCount < MAX_RETRIES) {
          console.log(`[Autopilot Worker]    Warte 3s vor erneutem Versuch...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
      
      // Letzter Retry-Versuch fehlgeschlagen
      if (retryCount >= MAX_RETRIES) {
        console.error(`[Autopilot Worker] ❌ Alle ${MAX_RETRIES} Retry-Versuche fehlgeschlagen`)
        consecutiveErrors++
        console.error(`[Autopilot Worker]    Consecutive Errors: ${consecutiveErrors}`)
        
        if (consecutiveErrors >= 3) {
          console.error(`[Autopilot Worker] ⚠️  WARNUNG: ${consecutiveErrors} aufeinanderfolgende Fehler!`)
          console.error(`[Autopilot Worker]    Worker pausiert bis Server wieder erreichbar ist.`)
        }
      }
    }
  }
  
  isProcessing = false
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

/**
 * Health-Check: Prüft ob der Next.js Server erreichbar ist
 */
async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      timeout: 5000
    })
    
    if (response.ok) {
      if (!serverHealthy) {
        console.log('[Autopilot Worker] ✅ Server ist wieder erreichbar!')
      }
      serverHealthy = true
      consecutiveErrors = 0
      lastHealthCheck = new Date()
      return true
    } else {
      console.log(`[Autopilot Worker] ⚠️  Server antwortet mit Status: ${response.status}`)
      serverHealthy = false
      return false
    }
  } catch (error) {
    if (serverHealthy) {
      console.error(`[Autopilot Worker] ⚠️  Server Health-Check fehlgeschlagen: ${error.message}`)
    }
    serverHealthy = false
    return false
  }
}

/**
 * Wartet mit exponentiellen Backoff bei wiederholten Fehlern
 */
function getBackoffDelay() {
  if (consecutiveErrors === 0) return 0
  // Exponentieller Backoff: 5s, 10s, 20s, 40s, max 60s
  const delay = Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 60000)
  return delay
}

// Warte 10 Sekunden, damit Next.js hochfahren kann
console.log('[Autopilot Worker] Waiting 10s for Next.js to start...')
setTimeout(async () => {
  console.log('[Autopilot Worker] Performing initial health check...')
  
  // Versuche Health-Check bis zu 5 Mal
  let healthCheckAttempts = 0
  while (!serverHealthy && healthCheckAttempts < 5) {
    await checkServerHealth()
    if (!serverHealthy) {
      healthCheckAttempts++
      console.log(`[Autopilot Worker] Health-Check Versuch ${healthCheckAttempts}/5 fehlgeschlagen, warte 5s...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
  
  if (!serverHealthy) {
    console.log('[Autopilot Worker] ⚠️  Server ist nach 5 Versuchen nicht erreichbar')
    console.log('[Autopilot Worker]    Worker läuft trotzdem weiter und versucht es periodisch erneut...')
  }
  
  console.log('[Autopilot Worker] ✅ Worker initialized and waiting...')
  console.log('[Autopilot Worker] Starting tick loop...')
  
  // Führe den ersten Tick sofort aus
  executeTick()
  
  // Dann alle 60 Sekunden
  setInterval(executeTick, TICK_INTERVAL)
  
  // Health-Check alle 30 Sekunden wenn Server als unhealthy markiert ist
  setInterval(async () => {
    if (!serverHealthy || consecutiveErrors > 0) {
      await checkServerHealth()
    }
  }, HEALTH_CHECK_INTERVAL)
}, 10000)
