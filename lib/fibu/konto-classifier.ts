/**
 * Intelligenter Konto-Klassifikator
 * 4-Stufen-Algorithmus: Statisch → Learned → Keyword → Vendor
 */

import { Db } from 'mongodb'
import { findMappingByText, AMAZON_MAPPINGS, PAYMENT_PROVIDER_MAPPINGS, KontoMapping } from './konto-mappings'
import { findLearnedRule, findVendorPattern } from './learning-database'

export interface KontoSuggestion {
  konto: string
  steuer: number
  bezeichnung: string
  confidence: number  // 0.0 - 1.0
  method: 'static' | 'learned' | 'keyword' | 'vendor' | 'category'
  reason: string
}

export interface Zahlung {
  _id?: any
  betrag: number
  datum?: Date
  datumDate?: Date
  verwendungszweck?: string
  beschreibung?: string
  gegenpartei?: string
  anbieter?: string
  kategorie?: string
  referenz?: string
}

/**
 * Haupt-Klassifikationsfunktion
 * Versucht nacheinander verschiedene Strategien
 */
export async function classifyKonto(
  zahlung: Zahlung,
  db: Db
): Promise<KontoSuggestion | null> {
  const text = [
    zahlung.verwendungszweck,
    zahlung.beschreibung,
    zahlung.gegenpartei,
    zahlung.referenz
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
  
  // Kategorie hat Priorität (auch ohne Text)
  if (zahlung.kategorie) {
    const categoryMatch = await classifyByCategory(zahlung, db)
    if (categoryMatch) {
      console.log(`[Konto Classifier] ✅ Kategorie-Match: ${categoryMatch.konto} (${zahlung.kategorie})`)
      return categoryMatch
    }
  }
  
  // Wenn kein Text UND keine Kategorie → null
  if (!text) {
    console.log('[Konto Classifier] Keine Text-Informationen und keine Kategorie')
    return null
  }
  
  console.log(`[Konto Classifier] Klassifiziere: "${text.substring(0, 80)}"`)
  
  // Stufe 1: Kategorie-basiert wurde bereits oben geprüft
  
  // Stufe 2: Statische Mappings (Text-basiert)
  const staticMatch = await classifyByStaticMapping(text)
  if (staticMatch) {
    console.log(`[Konto Classifier] ✅ Statisch-Match: ${staticMatch.konto}`)
    return staticMatch
  }
  
  // Stufe 3: Gelernte Patterns
  const learnedMatch = await classifyByLearnedPattern(text, db)
  if (learnedMatch) {
    console.log(`[Konto Classifier] ✅ Learned-Match: ${learnedMatch.konto}`)
    return learnedMatch
  }
  
  // Stufe 4: Vendor-basiert (gleicher Lieferant wie früher)
  if (zahlung.gegenpartei) {
    const vendorMatch = await classifyByVendor(zahlung.gegenpartei, db)
    if (vendorMatch) {
      console.log(`[Konto Classifier] ✅ Vendor-Match: ${vendorMatch.konto}`)
      return vendorMatch
    }
  }
  
  console.log('[Konto Classifier] ❌ Kein Match gefunden')
  return null
}

/**
 * Stufe 1: Kategorie-basiertes Mapping
 * Für Amazon, PayPal, etc. wo kategorie-Feld vorhanden ist
 */
async function classifyByCategory(
  zahlung: Zahlung,
  db: Db
): Promise<KontoSuggestion | null> {
  if (!zahlung.kategorie) return null
  
  const kategorie = zahlung.kategorie.trim()
  
  // Amazon-Kategorien
  if (zahlung.anbieter?.toLowerCase().includes('amazon') || 
      zahlung.verwendungszweck?.toLowerCase().includes('amazon')) {
    
    const mapping = AMAZON_MAPPINGS[kategorie]
    if (mapping) {
      return {
        konto: mapping.konto,
        steuer: mapping.steuer,
        bezeichnung: mapping.bezeichnung,
        confidence: 0.95,
        method: 'category',
        reason: `Amazon Kategorie "${kategorie}"`
      }
    }
  }
  
  // PayPal/Mollie Gebühren
  if (kategorie.toLowerCase().includes('fee') || 
      kategorie.toLowerCase().includes('gebühr')) {
    
    const text = `${zahlung.anbieter || ''} ${kategorie}`.toLowerCase()
    
    for (const [provider, mapping] of Object.entries(PAYMENT_PROVIDER_MAPPINGS)) {
      if (text.includes(provider.toLowerCase())) {
        return {
          konto: mapping.konto,
          steuer: mapping.steuer,
          bezeichnung: mapping.bezeichnung,
          confidence: 0.90,
          method: 'category',
          reason: `Payment Provider Gebühr: ${provider}`
        }
      }
    }
  }
  
  return null
}

/**
 * Stufe 2: Statisches Text-Mapping
 */
async function classifyByStaticMapping(text: string): Promise<KontoSuggestion | null> {
  const mapping = findMappingByText(text)
  
  if (mapping) {
    return {
      konto: mapping.konto,
      steuer: mapping.steuer,
      bezeichnung: mapping.bezeichnung,
      confidence: 0.85,
      method: 'static',
      reason: 'Statisches Mapping gefunden'
    }
  }
  
  return null
}

/**
 * Stufe 3: Gelernte Patterns aus Learning-Database
 */
async function classifyByLearnedPattern(
  text: string,
  db: Db
): Promise<KontoSuggestion | null> {
  // Prüfe exakte Matches
  const exactRule = await findLearnedRule(db, text, 'exact')
  if (exactRule) {
    return {
      konto: exactRule.targetKonto,
      steuer: exactRule.targetSteuersatz,
      bezeichnung: exactRule.kontoBezeichnung || `Konto ${exactRule.targetKonto}`,
      confidence: exactRule.confidence,
      method: 'learned',
      reason: `Gelernt: Pattern "${exactRule.pattern}" (${exactRule.usageCount}x verwendet)`
    }
  }
  
  // Prüfe Keyword-Matches
  const keywordRule = await findLearnedRule(db, text, 'keyword')
  if (keywordRule) {
    return {
      konto: keywordRule.targetKonto,
      steuer: keywordRule.targetSteuersatz,
      bezeichnung: keywordRule.kontoBezeichnung || `Konto ${keywordRule.targetKonto}`,
      confidence: keywordRule.confidence * 0.9,  // Leicht reduzierte Confidence
      method: 'learned',
      reason: `Gelernt: Keyword "${keywordRule.pattern}"`
    }
  }
  
  // Prüfe alle gelernten Rules (fuzzy)
  const anyRule = await findLearnedRule(db, text)
  if (anyRule) {
    return {
      konto: anyRule.targetKonto,
      steuer: anyRule.targetSteuersatz,
      bezeichnung: anyRule.kontoBezeichnung || `Konto ${anyRule.targetKonto}`,
      confidence: anyRule.confidence * 0.8,  // Weiter reduzierte Confidence
      method: 'learned',
      reason: `Gelernt: Ähnliches Pattern "${anyRule.pattern}"`
    }
  }
  
  return null
}

/**
 * Stufe 4: Vendor-basiertes Mapping
 * Findet häufigste Konto-Zuordnung für gleichen Lieferanten
 */
async function classifyByVendor(
  vendor: string,
  db: Db
): Promise<KontoSuggestion | null> {
  const vendorRule = await findVendorPattern(db, vendor)
  
  if (vendorRule) {
    return {
      konto: vendorRule.targetKonto,
      steuer: vendorRule.targetSteuersatz,
      bezeichnung: vendorRule.kontoBezeichnung || `Konto ${vendorRule.targetKonto}`,
      confidence: vendorRule.confidence * 0.75,  // Vendor-Match ist weniger sicher
      method: 'vendor',
      reason: `Vendor "${vendor}" → Konto ${vendorRule.targetKonto} (${vendorRule.usageCount}x)`
    }
  }
  
  return null
}

/**
 * Bulk-Klassifikation für mehrere Zahlungen
 */
export async function classifyKontoBulk(
  zahlungen: Zahlung[],
  db: Db,
  options: {
    minConfidence?: number
    parallel?: boolean
  } = {}
): Promise<Array<{ zahlung: Zahlung; suggestion: KontoSuggestion | null }>> {
  const { minConfidence = 0.7, parallel = true } = options
  
  if (parallel) {
    // Parallel-Verarbeitung (schneller)
    const results = await Promise.all(
      zahlungen.map(async (zahlung) => {
        const suggestion = await classifyKonto(zahlung, db)
        
        // Filter nach Mindest-Confidence
        if (suggestion && suggestion.confidence < minConfidence) {
          return { zahlung, suggestion: null }
        }
        
        return { zahlung, suggestion }
      })
    )
    
    return results
  } else {
    // Sequentielle Verarbeitung (für Debugging)
    const results: Array<{ zahlung: Zahlung; suggestion: KontoSuggestion | null }> = []
    
    for (const zahlung of zahlungen) {
      const suggestion = await classifyKonto(zahlung, db)
      
      if (!suggestion || suggestion.confidence < minConfidence) {
        results.push({ zahlung, suggestion: null })
      } else {
        results.push({ zahlung, suggestion })
      }
    }
    
    return results
  }
}

/**
 * Statistik: Klassifikations-Erfolgsrate
 */
export async function getClassificationStats(
  zahlungen: Zahlung[],
  db: Db
): Promise<{
  total: number
  classified: number
  byMethod: Record<string, number>
  byConfidence: { high: number; medium: number; low: number }
  avgConfidence: number
}> {
  const results = await classifyKontoBulk(zahlungen, db, { minConfidence: 0 })
  
  const stats = {
    total: results.length,
    classified: results.filter(r => r.suggestion !== null).length,
    byMethod: {} as Record<string, number>,
    byConfidence: { high: 0, medium: 0, low: 0 },
    avgConfidence: 0
  }
  
  let sumConfidence = 0
  
  results.forEach(r => {
    if (r.suggestion) {
      // Method
      stats.byMethod[r.suggestion.method] = (stats.byMethod[r.suggestion.method] || 0) + 1
      
      // Confidence
      if (r.suggestion.confidence >= 0.85) {
        stats.byConfidence.high++
      } else if (r.suggestion.confidence >= 0.70) {
        stats.byConfidence.medium++
      } else {
        stats.byConfidence.low++
      }
      
      sumConfidence += r.suggestion.confidence
    }
  })
  
  stats.avgConfidence = stats.classified > 0 
    ? sumConfidence / stats.classified 
    : 0
  
  return stats
}
