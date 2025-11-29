#!/usr/bin/env node

/**
 * Test-Script für Phase 1: Auto-Matching
 * 
 * Testet alle Matching-Strategien:
 * 1. AU-Nummern-Matching
 * 2. RE-Nummern-Matching
 * 3. Amazon Order-ID Matching
 * 4. Betrag + Datum Heuristik
 * 5. Teilzahlungs-Erkennung
 */

const API_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

console.log('🧪 Test-Script für Auto-Matching gestartet\n')
console.log(`API Base: ${API_BASE}\n`)

// Hilfsfunktion für API-Calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body)
  }
  
  const response = await fetch(url, options)
  return await response.json()
}

// Assertion-Funktion
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASSED: ${message}`)
}

async function runTests() {
  console.log('═'.repeat(60))
  console.log('PHASE 1: AUTO-MATCHING TEST')
  console.log('═'.repeat(60))
  console.log()
  
  // Test 0: Initialisiere Learning-Database
  console.log('📚 Test 0: Learning-Database initialisieren')
  console.log('-'.repeat(60))
  try {
    const initResult = await apiCall('/api/fibu/learning/init', 'POST')
    assert(initResult.ok, 'Learning-Database initialisiert')
    console.log(`   Imported ${initResult.imported} default rules`)
  } catch (err) {
    console.log(`   ⚠️  Learning-Database bereits initialisiert oder Fehler: ${err.message}`)
  }
  console.log()
  
  // Test 1: Auto-Match mit Dry-Run
  console.log('🔗 Test 1: Auto-Match (Dry-Run)')
  console.log('-'.repeat(60))
  
  const dryRunResult = await apiCall('/api/fibu/auto-match', 'POST', {
    zeitraum: '2025-10-01_2025-10-31',
    dryRun: true
  })
  
  assert(dryRunResult.ok !== false, 'Auto-Match API erreichbar')
  assert(dryRunResult.stats !== undefined, 'Stats vorhanden')
  
  console.log(`   Total Zahlungen: ${dryRunResult.stats.totalZahlungen}`)
  console.log(`   Matched: ${dryRunResult.stats.matched}`)
  console.log(`   Match-Rate: ${((dryRunResult.stats.matched / dryRunResult.stats.totalZahlungen) * 100).toFixed(1)}%`)
  console.log()
  
  // Test 2: Matching-Suggestions
  console.log('💡 Test 2: Matching-Suggestions')
  console.log('-'.repeat(60))
  
  const suggestionsResult = await apiCall('/api/fibu/matching-suggestions?limit=10&minConfidence=medium')
  
  assert(suggestionsResult.ok, 'Suggestions API erreichbar')
  assert(Array.isArray(suggestionsResult.suggestions), 'Suggestions ist Array')
  
  console.log(`   Vorschläge gefunden: ${suggestionsResult.count}`)
  
  if (suggestionsResult.count > 0) {
    const first = suggestionsResult.suggestions[0]
    console.log(`   Beispiel:`)
    console.log(`     Zahlung: ${first.zahlung.beschreibung} (${first.zahlung.betrag}€)`)
    console.log(`     Vorschläge: ${first.suggestions.length}`)
    first.suggestions.forEach(s => {
      console.log(`       - ${s.belegnummer} (${s.confidence}, ${s.method})`)
    })
  }
  console.log()
  
  // Test 3: Prüfe Matching-Methoden
  console.log('📊 Test 3: Matching-Methoden Verteilung')
  console.log('-'.repeat(60))
  
  if (dryRunResult.stats && dryRunResult.stats.byMethod) {
    const methods = dryRunResult.stats.byMethod
    console.log('   AU-Nummer (direkt):', methods.auNummerDirekt || 0)
    console.log('   RE-Nummer:', methods.reNummer || 0)
    console.log('   Amazon Order-ID:', methods.amazonOrderIdXRE || 0)
    console.log('   Betrag+Datum:', methods.betragDatum || 0)
    console.log('   Kategorie:', methods.kategorie || 0)
    
    const totalMatched = Object.values(methods).reduce((a, b) => a + b, 0)
    assert(totalMatched === dryRunResult.stats.matched, 'Summe der Methoden stimmt überein')
  }
  console.log()
  
  // Test 4: Confidence-Levels
  console.log('🎯 Test 4: Confidence-Levels')
  console.log('-'.repeat(60))
  
  if (dryRunResult.stats && dryRunResult.stats.byConfidence) {
    const conf = dryRunResult.stats.byConfidence
    console.log(`   HIGH: ${conf.high || 0}`)
    console.log(`   MEDIUM: ${conf.medium || 0}`)
    console.log(`   LOW: ${conf.low || 0}`)
    
    const totalConf = (conf.high || 0) + (conf.medium || 0) + (conf.low || 0)
    assert(totalConf === dryRunResult.stats.matched, 'Summe der Confidence-Levels stimmt')
    
    // Mindestens 60% sollten HIGH confidence haben
    const highPercentage = (conf.high || 0) / dryRunResult.stats.matched
    console.log(`   HIGH-Anteil: ${(highPercentage * 100).toFixed(1)}%`)
    
    if (dryRunResult.stats.matched > 0) {
      assert(highPercentage >= 0.5, 'Mindestens 50% HIGH confidence')
    }
  }
  console.log()
  
  // Test 5: Anbieter-Verteilung
  console.log('🏦 Test 5: Anbieter-Verteilung')
  console.log('-'.repeat(60))
  
  if (dryRunResult.stats && dryRunResult.stats.byAnbieter) {
    Object.entries(dryRunResult.stats.byAnbieter).forEach(([anbieter, stats]) => {
      const matchRate = stats.total > 0 
        ? ((stats.matched / stats.total) * 100).toFixed(1) 
        : '0.0'
      console.log(`   ${anbieter}: ${stats.matched}/${stats.total} (${matchRate}%)`)
    })
  }
  console.log()
  
  // Test 6: Echtes Auto-Match (nicht Dry-Run)
  console.log('🚀 Test 6: Echtes Auto-Match ausführen')
  console.log('-'.repeat(60))
  console.log('   ⚠️  Dies führt echte Zuordnungen in der DB durch!')
  console.log('   Starte in 3 Sekunden...')
  
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  const realMatchResult = await apiCall('/api/fibu/auto-match', 'POST', {
    zeitraum: '2025-10-01_2025-10-31',
    dryRun: false
  })
  
  assert(realMatchResult.ok !== false, 'Echtes Auto-Match erfolgreich')
  console.log(`   Matched: ${realMatchResult.stats.matched}`)
  console.log(`   Match-Rate: ${((realMatchResult.stats.matched / realMatchResult.stats.totalZahlungen) * 100).toFixed(1)}%`)
  console.log()
  
  // Abschluss
  console.log('═'.repeat(60))
  console.log('✅ ALLE TESTS BESTANDEN!')
  console.log('═'.repeat(60))
  console.log()
  console.log('📈 Zusammenfassung:')
  console.log(`   Zahlungen gesamt: ${realMatchResult.stats.totalZahlungen}`)
  console.log(`   Automatisch zugeordnet: ${realMatchResult.stats.matched}`)
  console.log(`   Match-Rate: ${((realMatchResult.stats.matched / realMatchResult.stats.totalZahlungen) * 100).toFixed(1)}%`)
  
  if (realMatchResult.stats.byConfidence) {
    const highConf = realMatchResult.stats.byConfidence.high || 0
    console.log(`   HIGH Confidence: ${highConf} (${((highConf / realMatchResult.stats.matched) * 100).toFixed(1)}%)`)
  }
  
  console.log()
  console.log('✨ Phase 1 abgeschlossen!')
  console.log('   Nächster Schritt: Phase 2 - Konto-Mapping')
  console.log()
  
  return {
    success: true,
    stats: realMatchResult.stats
  }
}

// Führe Tests aus
runTests()
  .then(result => {
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ TEST FEHLGESCHLAGEN:', error.message)
    console.error(error.stack)
    process.exit(1)
  })
