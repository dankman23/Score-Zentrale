/**
 * Kreditor-Matching Utilities
 * Automatisches Matching von Lieferanten-Namen zu Kreditoren
 */

import { getDb } from './db/mongodb'

export interface KreditorMatch {
  kreditorenNummer: string
  name: string
  confidence: number // 0-100
  method: 'exact' | 'alias' | 'fuzzy' | 'manual'
}

/**
 * Normalisiert einen Lieferanten-Namen für besseres Matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Entferne Rechtsformen
    .replace(/\s+(gmbh|ag|kg|ohg|gbr|e\.?k\.|ug)\b/gi, '')
    .replace(/\s+&\s+co\.?\s*/gi, '')
    // Entferne Sonderzeichen
    .replace(/[^\w\s]/g, ' ')
    // Mehrfache Leerzeichen
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Berechnet Ähnlichkeit zwischen zwei Strings (Levenshtein Distance)
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 100
  
  const editDistance = levenshteinDistance(longer, shorter)
  return ((longer.length - editDistance) / longer.length) * 100
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

/**
 * Findet den besten Kreditor für einen Lieferanten-Namen
 */
export async function findKreditor(lieferantName: string): Promise<KreditorMatch | null> {
  try {
    const db = await getDb()
    const collection = db.collection('kreditoren')
    
    const normalized = normalizeName(lieferantName)
    
    // 1. Exakte Übereinstimmung (normalisiert)
    const kreditoren = await collection.find({}).toArray()
    
    for (const k of kreditoren) {
      // Exakte Übereinstimmung (100%)
      if (normalizeName(k.name) === normalized) {
        return {
          kreditorenNummer: k.kreditorenNummer,
          name: k.name,
          confidence: 100,
          method: 'exact'
        }
      }
      
      // Alias-Übereinstimmung (95%)
      if (k.aliases && k.aliases.length > 0) {
        for (const alias of k.aliases) {
          if (alias === normalized) {
            return {
              kreditorenNummer: k.kreditorenNummer,
              name: k.name,
              confidence: 95,
              method: 'alias'
            }
          }
        }
      }
    }
    
    // 2. Fuzzy Matching (wenn > 80% Ähnlichkeit)
    let bestMatch: KreditorMatch | null = null
    let bestSimilarity = 0
    
    for (const k of kreditoren) {
      const sim = similarity(normalized, normalizeName(k.name))
      
      if (sim > bestSimilarity && sim >= 80) {
        bestSimilarity = sim
        bestMatch = {
          kreditorenNummer: k.kreditorenNummer,
          name: k.name,
          confidence: sim,
          method: 'fuzzy'
        }
      }
      
      // Auch Teiltreffer prüfen (z.B. "Amazon" in "Amazon Payment")
      const nameParts = normalized.split(' ')
      const kNameParts = normalizeName(k.name).split(' ')
      
      for (const part of nameParts) {
        if (part.length >= 4) { // Nur aussagekräftige Wörter
          for (const kPart of kNameParts) {
            if (kPart.includes(part) || part.includes(kPart)) {
              const partSim = Math.max(
                (part.length / kPart.length) * 100,
                (kPart.length / part.length) * 100
              )
              
              if (partSim > bestSimilarity && partSim >= 70) {
                bestSimilarity = partSim
                bestMatch = {
                  kreditorenNummer: k.kreditorenNummer,
                  name: k.name,
                  confidence: partSim,
                  method: 'fuzzy'
                }
              }
            }
          }
        }
      }
    }
    
    return bestMatch
  } catch (error) {
    console.error('[Kreditor Matching] Error:', error)
    return null
  }
}

/**
 * Speichert eine manuelle Zuordnung als Lernfall
 */
export async function learnKreditorMapping(
  lieferantName: string,
  kreditorenNummer: string
): Promise<boolean> {
  try {
    const db = await getDb()
    const collection = db.collection('kreditoren')
    
    const normalized = normalizeName(lieferantName)
    
    // Füge normalisierten Namen als Alias hinzu
    await collection.updateOne(
      { kreditorenNummer },
      {
        $addToSet: { aliases: normalized },
        $set: { updatedAt: new Date() }
      }
    )
    
    console.log(`[Kreditor Learn] Mapping gespeichert: "${lieferantName}" → ${kreditorenNummer}`)
    return true
  } catch (error) {
    console.error('[Kreditor Learn] Error:', error)
    return false
  }
}

/**
 * Extrahiert Belegnummer aus verschiedenen Formaten
 * - Standard: RE2025-12345, GS2025-123
 * - Amazon: XRE-5561, XRK-203 (mit Bindestrich)
 */
export function extractBelegnummer(text: string): string | null {
  // Amazon-Format: XRE-XXXX oder XRK-XXX
  const amazonMatch = text.match(/X[RK][EK]-\d+/i)
  if (amazonMatch) {
    return amazonMatch[0]
  }
  
  // Standard-Format: RE2025-XXXXX, GS2025-XXX
  const standardMatch = text.match(/[A-Z]{2}\d{4}-\d+/i)
  if (standardMatch) {
    return standardMatch[0]
  }
  
  // Fallback: Erste Zahl-Kombination
  const fallbackMatch = text.match(/\d{4,}/i)
  if (fallbackMatch) {
    return fallbackMatch[0]
  }
  
  return null
}
