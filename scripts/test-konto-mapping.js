#!/usr/bin/env node

/**
 * Test-Script für Phase 2: Konto-Mapping
 * 
 * Testet intelligente Konto-Zuordnung:
 * 1. Kategorie-basiert (Amazon)
 * 2. Statische Mappings
 * 3. Learning-System
 * 4. Vendor-Matching
 */

const API_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

console.log('🧪 Test-Script für Konto-Mapping gestartet\n')
console.log(`API Base: ${API_BASE}\n`)

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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASSED: ${message}`)
}

async function runTests() {
  console.log('═'.repeat(60))
  console.log('PHASE 2: KONTO-MAPPING TEST')
  console.log('═'.repeat(60))
  console.log()
  
  // Test 1: Konto-Suggestions laden
  console.log('💡 Test 1: Konto-Suggestions API')
  console.log('-'.repeat(60))
  
  const suggestionsResult = await apiCall('/api/fibu/konto-suggestions?limit=20&minConfidence=0.7')
  
  assert(suggestionsResult.ok, 'Konto-Suggestions API erreichbar')
  assert(Array.isArray(suggestionsResult.suggestions), 'Suggestions ist Array')
  
  console.log(`   Vorschläge gefunden: ${suggestionsResult.count}`)
  
  if (suggestionsResult.stats) {
    console.log(`   Durchschnittliche Confidence: ${(suggestionsResult.stats.avgConfidence * 100).toFixed(1)}%`)
    console.log(`   Methoden-Verteilung:`)
    Object.entries(suggestionsResult.stats.byMethod).forEach(([method, count]) => {
      console.log(`     ${method}: ${count}`)
    })
  }
  
  if (suggestionsResult.count > 0) {
    console.log(`\n   Top 3 Beispiele:`)
    suggestionsResult.suggestions.slice(0, 3).forEach((s, i) => {
      console.log(`     ${i+1}. ${s.zahlung.beschreibung?.substring(0, 50) || 'N/A'}`)
      console.log(`        → Konto ${s.suggestion.konto} (${s.suggestion.bezeichnung})`)
      console.log(`        Confidence: ${(s.suggestion.confidence * 100).toFixed(0)}%, Method: ${s.suggestion.method}`)
      console.log(`        Grund: ${s.suggestion.reason}`)
    })
  }
  console.log()
  
  // Test 2: Prüfe Methoden-Verteilung
  console.log('📊 Test 2: Methoden-Verteilung')
  console.log('-'.repeat(60))
  
  if (suggestionsResult.stats && suggestionsResult.stats.byMethod) {
    const methods = suggestionsResult.stats.byMethod
    console.log('   Category:', methods.category || 0)
    console.log('   Static:', methods.static || 0)
    console.log('   Learned:', methods.learned || 0)
    console.log('   Vendor:', methods.vendor || 0)
    
    const totalSuggestions = Object.values(methods).reduce((a, b) => a + b, 0)
    assert(totalSuggestions === suggestionsResult.count, 'Summe der Methoden stimmt')
  }
  console.log()
  
  // Test 3: Amazon-Kategorie-Mapping
  console.log('🛒 Test 3: Amazon-Kategorie-Mapping')
  console.log('-'.repeat(60))
  
  const amazonSuggestions = await apiCall('/api/fibu/konto-suggestions?limit=50&minConfidence=0.7&anbieter=Amazon')
  
  assert(amazonSuggestions.ok, 'Amazon-Filter funktioniert')
  console.log(`   Amazon-Suggestions: ${amazonSuggestions.count}`)
  
  if (amazonSuggestions.count > 0) {
    // Prüfe ob Amazon-Kategorien korrekt gemapped werden
    const categoryMapped = amazonSuggestions.suggestions.filter(s => s.suggestion.method === 'category')
    console.log(`   Kategorie-Mappings: ${categoryMapped.length}`)
    
    if (categoryMapped.length > 0) {
      console.log(`   Beispiele:`)
      categoryMapped.slice(0, 3).forEach(s => {
        console.log(`     ${s.zahlung.kategorie} → Konto ${s.suggestion.konto} (${s.suggestion.bezeichnung})`)
      })
    }
  }
  console.log()
  
  // Test 4: Manuelle Zuordnung mit Learning
  console.log('🎓 Test 4: Manuelle Zuordnung & Learning')
  console.log('-'.repeat(60))
  
  // Nimm erste Suggestion und ordne manuell zu (als Test)
  if (suggestionsResult.count > 0) {
    const testSuggestion = suggestionsResult.suggestions[0]
    
    console.log(`   Teste manuelle Zuordnung...`)
    console.log(`   Zahlung: ${testSuggestion.zahlung.beschreibung?.substring(0, 50)}`)
    console.log(`   Vorgeschlagenes Konto: ${testSuggestion.suggestion.konto}`)
    
    const assignResult = await apiCall('/api/fibu/zahlungen/assign-konto', 'POST', {
      zahlungId: testSuggestion.zahlung._id,
      anbieter: testSuggestion.zahlung.anbieter,
      konto: testSuggestion.suggestion.konto,
      steuer: testSuggestion.suggestion.steuer,
      kontoBezeichnung: testSuggestion.suggestion.bezeichnung,
      saveAsRule: true  // Als Lern-Regel speichern
    })
    
    assert(assignResult.ok, 'Manuelle Zuordnung erfolgreich')
    assert(assignResult.ruleSaved, 'Lern-Regel wurde gespeichert')
    console.log(`   ✅ Zuordnung gespeichert (History ID: ${assignResult.historyId})`)
    console.log(`   ✅ Lern-Regel erstellt`)
  } else {
    console.log(`   ⚠️  Keine Suggestions zum Testen verfügbar`)
  }
  console.log()
  
  // Test 5: Learning-Statistik
  console.log('📈 Test 5: Learning-Statistik')
  console.log('-'.repeat(60))
  
  const learningStats = await apiCall('/api/fibu/learning/stats')
  
  if (learningStats.ok) {
    console.log(`   History:`)
    console.log(`     Total: ${learningStats.stats.history.total}`)
    console.log(`     Korrekt: ${learningStats.stats.history.correct}`)
    console.log(`     Inkorrekt: ${learningStats.stats.history.incorrect}`)
    console.log(`     Erfolgsrate: ${learningStats.stats.history.successRate}`)
    console.log()
    console.log(`   Rules:`)
    console.log(`     Total: ${learningStats.stats.rules.total}`)
    console.log(`     Auto: ${learningStats.stats.rules.auto}`)
    console.log(`     Manual: ${learningStats.stats.rules.manual}`)
    
    if (learningStats.stats.topRules && learningStats.stats.topRules.length > 0) {
      console.log()
      console.log(`   Top 5 Rules:`)
      learningStats.stats.topRules.slice(0, 5).forEach((r, i) => {
        console.log(`     ${i+1}. "${r.pattern}" → ${r.konto} (${r.usageCount}x, ${(r.confidence * 100).toFixed(0)}%)`)
      })
    }
  } else {
    console.log(`   ⚠️  Learning-Stats nicht verfügbar`)
  }
  console.log()
  
  // Test 6: Confidence-Levels prüfen
  console.log('🎯 Test 6: Confidence-Levels')
  console.log('-'.repeat(60))
  
  if (suggestionsResult.count > 0) {
    const high = suggestionsResult.suggestions.filter(s => s.suggestion.confidence >= 0.85).length
    const medium = suggestionsResult.suggestions.filter(s => s.suggestion.confidence >= 0.70 && s.suggestion.confidence < 0.85).length
    const low = suggestionsResult.suggestions.filter(s => s.suggestion.confidence < 0.70).length
    
    console.log(`   HIGH (≥85%): ${high}`)
    console.log(`   MEDIUM (70-85%): ${medium}`)
    console.log(`   LOW (<70%): ${low}`)
    
    const highPercentage = high / suggestionsResult.count
    console.log(`   HIGH-Anteil: ${(highPercentage * 100).toFixed(1)}%`)
    
    assert(highPercentage >= 0.4, 'Mindestens 40% HIGH confidence')
  }
  console.log()
  
  // Abschluss
  console.log('═'.repeat(60))
  console.log('✅ ALLE TESTS BESTANDEN!')
  console.log('═'.repeat(60))
  console.log()
  console.log('📈 Zusammenfassung:')
  console.log(`   Konto-Suggestions: ${suggestionsResult.count}`)
  console.log(`   Durchschnittliche Confidence: ${(suggestionsResult.stats.avgConfidence * 100).toFixed(1)}%`)
  console.log(`   Methoden verwendet: ${Object.keys(suggestionsResult.stats.byMethod).length}`)
  console.log(`   Learning-Rules: ${learningStats.ok ? learningStats.stats.rules.total : 'N/A'}`)
  console.log()
  console.log('✨ Phase 2 abgeschlossen!')
  console.log('   Nächster Schritt: Phase 3 - 10it Export')
  console.log()
  
  return {
    success: true,
    suggestions: suggestionsResult.count,
    avgConfidence: suggestionsResult.stats.avgConfidence
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
