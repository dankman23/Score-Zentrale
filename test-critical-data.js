/**
 * KRITISCHER DATEN-TEST
 * 
 * Prüft ob alle wichtigen Daten noch vorhanden sind.
 * MUSS VOR UND NACH JEDER ÄNDERUNG AN FIBU-APIs AUSGEFÜHRT WERDEN!
 * 
 * Usage: node test-critical-data.js
 */

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

// Erwartete Mindest-Anzahlen (basierend auf aktuellem Stand)
const EXPECTED_MINIMUMS = {
  vkRechnungen: 1000,    // VK-Rechnungen (Oktober + November 2025)
  externeRechnungen: 40, // Externe Amazon Rechnungen (Oktober 2025)
  ekRechnungen: 20,      // EK-Rechnungen (verifiziert mit Kreditor)
  zahlungen: 200,        // Zahlungen (Oktober + November 2025)
  kreditoren: 50         // Kreditoren (Lieferanten)
}

async function testCriticalData() {
  console.log('🔒 KRITISCHER DATEN-TEST 🔒')
  console.log('=' .repeat(60))
  console.log('Prüfe ob alle wichtigen Daten noch vorhanden sind...\n')
  
  let allePassed = true
  const errors = []
  
  // 1. VK-Rechnungen
  try {
    console.log('1️⃣ VK-Rechnungen (Verkaufsrechnungen)...')
    const response = await fetch(`${baseUrl}/api/fibu/rechnungen/vk?from=2025-10-01&to=2025-11-30`)
    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(`API Fehler: ${data.error}`)
    }
    
    const anzahl = data.rechnungen.length
    if (anzahl >= EXPECTED_MINIMUMS.vkRechnungen) {
      console.log(`   ✅ OK: ${anzahl} Rechnungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.vkRechnungen})`)
    } else {
      console.log(`   ❌ FEHLER: Nur ${anzahl} Rechnungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.vkRechnungen})`)
      errors.push(`VK-Rechnungen: ${anzahl} < ${EXPECTED_MINIMUMS.vkRechnungen}`)
      allePassed = false
    }
  } catch (error) {
    console.log(`   ❌ KRITISCHER FEHLER: ${error.message}`)
    errors.push(`VK-Rechnungen: API nicht erreichbar`)
    allePassed = false
  }
  
  // 2. Externe Rechnungen
  try {
    console.log('\n2️⃣ Externe Amazon Rechnungen...')
    const response = await fetch(`${baseUrl}/api/fibu/rechnungen/extern?from=2025-10-01&to=2025-10-31&limit=100`)
    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(`API Fehler: ${data.error}`)
    }
    
    const anzahl = data.total || data.rechnungen.length
    if (anzahl >= EXPECTED_MINIMUMS.externeRechnungen) {
      console.log(`   ✅ OK: ${anzahl} Rechnungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.externeRechnungen})`)
      
      // Prüfe auch ob alle als "Bezahlt" markiert sind
      const offen = data.rechnungen.filter(r => r.status !== 'Bezahlt').length
      if (offen === 0) {
        console.log(`   ✅ BONUS: Alle ${anzahl} Rechnungen sind als "Bezahlt" markiert`)
      } else {
        console.log(`   ⚠️ WARNUNG: ${offen} Rechnungen sind NICHT als "Bezahlt" markiert`)
      }
    } else {
      console.log(`   ❌ FEHLER: Nur ${anzahl} Rechnungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.externeRechnungen})`)
      errors.push(`Externe Rechnungen: ${anzahl} < ${EXPECTED_MINIMUMS.externeRechnungen}`)
      allePassed = false
    }
  } catch (error) {
    console.log(`   ❌ KRITISCHER FEHLER: ${error.message}`)
    errors.push(`Externe Rechnungen: API nicht erreichbar`)
    allePassed = false
  }
  
  // 3. EK-Rechnungen
  try {
    console.log('\n3️⃣ EK-Rechnungen (Einkaufsrechnungen)...')
    const response = await fetch(`${baseUrl}/api/fibu/ek-rechnungen/list?from=2025-01-01&to=2025-12-31&limit=100`)
    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(`API Fehler: ${data.error}`)
    }
    
    const anzahl = data.total || data.rechnungen.length
    if (anzahl >= EXPECTED_MINIMUMS.ekRechnungen) {
      console.log(`   ✅ OK: ${anzahl} Rechnungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.ekRechnungen})`)
    } else {
      console.log(`   ⚠️ INFO: ${anzahl} Rechnungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.ekRechnungen})`)
      console.log(`   (EK-Rechnungen können schwanken, daher nur Warnung)`)
    }
  } catch (error) {
    console.log(`   ❌ KRITISCHER FEHLER: ${error.message}`)
    errors.push(`EK-Rechnungen: API nicht erreichbar`)
    allePassed = false
  }
  
  // 4. Zahlungen
  try {
    console.log('\n4️⃣ Zahlungen...')
    const response = await fetch(`${baseUrl}/api/fibu/zahlungen?from=2025-10-01&to=2025-11-30&limit=500`)
    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(`API Fehler: ${data.error}`)
    }
    
    const anzahl = data.total || data.zahlungen.length
    if (anzahl >= EXPECTED_MINIMUMS.zahlungen) {
      console.log(`   ✅ OK: ${anzahl} Zahlungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.zahlungen})`)
    } else {
      console.log(`   ⚠️ INFO: ${anzahl} Zahlungen gefunden (erwartet: min. ${EXPECTED_MINIMUMS.zahlungen})`)
    }
  } catch (error) {
    console.log(`   ❌ KRITISCHER FEHLER: ${error.message}`)
    errors.push(`Zahlungen: API nicht erreichbar`)
    allePassed = false
  }
  
  // 5. Kreditoren
  try {
    console.log('\n5️⃣ Kreditoren (Lieferanten)...')
    const response = await fetch(`${baseUrl}/api/fibu/kreditoren?limit=500`)
    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(`API Fehler: ${data.error}`)
    }
    
    const anzahl = data.kreditoren.length
    if (anzahl >= EXPECTED_MINIMUMS.kreditoren) {
      console.log(`   ✅ OK: ${anzahl} Kreditoren gefunden (erwartet: min. ${EXPECTED_MINIMUMS.kreditoren})`)
    } else {
      console.log(`   ❌ FEHLER: Nur ${anzahl} Kreditoren gefunden (erwartet: min. ${EXPECTED_MINIMUMS.kreditoren})`)
      errors.push(`Kreditoren: ${anzahl} < ${EXPECTED_MINIMUMS.kreditoren}`)
      allePassed = false
    }
  } catch (error) {
    console.log(`   ❌ KRITISCHER FEHLER: ${error.message}`)
    errors.push(`Kreditoren: API nicht erreichbar`)
    allePassed = false
  }
  
  // Zusammenfassung
  console.log('\n' + '='.repeat(60))
  if (allePassed) {
    console.log('✅ ALLE TESTS BESTANDEN!')
    console.log('Alle kritischen Daten sind vorhanden.')
    process.exit(0)
  } else {
    console.log('❌ TESTS FEHLGESCHLAGEN!')
    console.log('\nFehler:')
    errors.forEach(err => console.log(`   - ${err}`))
    console.log('\n⚠️ ACHTUNG: Daten sind verschwunden oder APIs sind kaputt!')
    console.log('Siehe /app/docs/CRITICAL_APIS_DO_NOT_BREAK.md für Rollback-Anleitung')
    process.exit(1)
  }
}

// Ausführen
testCriticalData().catch(error => {
  console.error('❌ KRITISCHER FEHLER:', error)
  process.exit(1)
})
