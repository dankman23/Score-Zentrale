/**
 * Enhanced Auto-Matching Engine
 * Erweitert die bestehende Auto-Match-Logik um zusätzliche Strategien
 * WICHTIG: Ergänzt bestehende Route, ersetzt sie NICHT!
 */

import { Db } from 'mongodb'

export interface MatchResult {
  zahlungId: string
  match: {
    type: 'rechnung' | 'konto'
    rechnungId?: string
    rechnungsNr?: string
    konto?: string
    confidence: 'high' | 'medium' | 'low'
  } | null
  method: string
  details?: any
}

export interface Zahlung {
  _id: any
  betrag: number
  datum?: Date
  datumDate?: Date
  verwendungszweck?: string
  beschreibung?: string
  rechnungsNr?: string
  referenz?: string
  kategorie?: string
  gegenpartei?: string
  anbieter?: string
}

export interface VKRechnung {
  _id: any
  cRechnungsNr?: string
  rechnungsNr?: string
  cBestellNr?: string
  brutto?: number
  rechnungsdatum: Date
}

/**
 * Erweiterte Regex-Patterns für Rechnungsnummer-Matching
 */
export const RECHNUNG_PATTERNS = [
  // Bestehende Patterns
  /RE\s*(\d{4})[\/\-](\d+)/i,
  /Rechnung\s+(\d+)/i,
  /Invoice\s+([A-Z0-9\-]+)/i,
  
  // Neue erweiterte Patterns
  /RE[-\s]?(\d{4})[-\/](\d{2})[-\/](\d+)/i,  // RE-2025/01-2596
  /R[NR]\s*[-:]?\s*(\d+)/i,                   // RN: 12345, RR-12345
  /Rg\.?\s*[-:]?\s*(\d+)/i,                   // Rg. 12345, Rg: 12345
  /Bill\s+No\.?\s*(\d+)/i                     // Bill No. 12345
]

/**
 * AU-Nummer Patterns (erweitert)
 */
export const AU_PATTERNS = [
  /AU[_-\s]?(\d+)[_-\s]?([A-Z0-9]+)?/i,      // AU-18279-S, AU_12345_SW6
  /AU(\d{4})[_-](\d+)/i,                      // AU2025-62889
  /Auftrag[_-\s]?(\d+)/i                      // Auftrag 12345
]

/**
 * Amazon Order-ID Pattern
 */
export const AMAZON_ORDER_PATTERN = /(\d{3})-(\d{7})-(\d{7})/

/**
 * Extrahiert AU-Nummer aus Text mit allen Patterns
 */
export function extractAuNummer(text: string | null | undefined): string | null {
  if (!text) return null
  
  for (const pattern of AU_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      // Gebe die komplette AU-Nummer zurück
      return match[0]
    }
  }
  
  return null
}

/**
 * Extrahiert Rechnungsnummer aus Text mit allen Patterns
 */
export function extractRechnungsNr(text: string | null | undefined): string | null {
  if (!text) return null
  
  for (const pattern of RECHNUNG_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }
  
  return null
}

/**
 * Extrahiert Amazon Order-ID
 */
export function extractAmazonOrderId(text: string | null | undefined): string | null {
  if (!text) return null
  
  const match = text.match(AMAZON_ORDER_PATTERN)
  return match ? match[0] : null
}

/**
 * Berechnet Confidence-Score für Betrag-Datum-Matching
 */
export function calculateBetragDatumScore(
  zahlungBetrag: number,
  rechnungBetrag: number,
  zahlungDatum: Date,
  rechnungDatum: Date
): { score: number; confidence: 'high' | 'medium' | 'low' } {
  const betragDiff = Math.abs(zahlungBetrag - rechnungBetrag)
  const dateDiff = Math.abs(zahlungDatum.getTime() - rechnungDatum.getTime())
  const daysDiff = dateDiff / (1000 * 60 * 60 * 24)
  
  // Score: Betragsdifferenz + gewichtete Datumsdifferenz
  const score = betragDiff + (daysDiff * 0.1)
  
  // Confidence-Levels
  let confidence: 'high' | 'medium' | 'low'
  if (score < 0.25) {
    confidence = 'high'    // < 25 Cent Diff + max 2-3 Tage
  } else if (score < 1.0) {
    confidence = 'medium'  // < 1€ Diff + max 10 Tage
  } else {
    confidence = 'low'     // > 1€ Diff oder > 10 Tage
  }
  
  return { score, confidence }
}

/**
 * Erkennt Teilzahlungen
 */
export function detectPartialPayment(
  zahlungBetrag: number,
  rechnungBetrag: number,
  tolerance: number = 0.05  // 5% Toleranz
): { isPartial: boolean; percentage: number } {
  const absoluteZahlung = Math.abs(zahlungBetrag)
  const absoluteRechnung = Math.abs(rechnungBetrag)
  
  const percentage = absoluteZahlung / absoluteRechnung
  const isPartial = percentage < (1 - tolerance) && percentage > 0
  
  return { isPartial, percentage }
}

/**
 * Verbesserte RE-Nummern-Matching-Funktion
 * Erweitert die bestehende Logik um zusätzliche Patterns
 */
export async function matchByRechnungsNummer(
  zahlung: Zahlung,
  alleRechnungen: any[],
  db: Db
): Promise<MatchResult['match'] | null> {
  const text = zahlung.verwendungszweck || zahlung.beschreibung || ''
  const reNr = extractRechnungsNr(text)
  
  if (!reNr) return null
  
  // Suche in allen Rechnungen
  const match = alleRechnungen.find(r => {
    const belegnr = r.belegnummer || r.cRechnungsNr || ''
    return belegnr.includes(reNr) || reNr.includes(belegnr)
  })
  
  if (match) {
    return {
      type: 'rechnung',
      rechnungId: match.uniqueId || match._id.toString(),
      rechnungsNr: match.belegnummer || match.cRechnungsNr,
      confidence: 'high'
    }
  }
  
  return null
}

/**
 * Verbesserte Amazon-Order-Matching
 */
export async function matchByAmazonOrderId(
  zahlung: Zahlung,
  alleRechnungen: any[],
  db: Db
): Promise<MatchResult['match'] | null> {
  const text = zahlung.verwendungszweck || zahlung.beschreibung || zahlung.referenz || ''
  const orderId = extractAmazonOrderId(text)
  
  if (!orderId) return null
  
  // Suche in externen Rechnungen (XRE)
  const match = alleRechnungen.find(r => {
    const bestellnr = r.cBestellNr || r.orderId || ''
    return bestellnr.includes(orderId)
  })
  
  if (match) {
    return {
      type: 'rechnung',
      rechnungId: match.uniqueId || match._id.toString(),
      rechnungsNr: match.belegnummer || match.cRechnungsNr,
      confidence: 'high'
    }
  }
  
  return null
}

/**
 * Neue Fuzzy-Matching-Funktion für schwierige Fälle
 */
export async function fuzzyMatchByBetragDatum(
  zahlung: Zahlung,
  vkRechnungen: VKRechnung[],
  options: {
    betragTolerance?: number,    // Default: 0.50 €
    tageVorher?: number,          // Default: 7
    tageNachher?: number,         // Default: 3
    minConfidence?: 'high' | 'medium' | 'low'
  } = {}
): Promise<MatchResult['match'] | null> {
  const {
    betragTolerance = 0.50,
    tageVorher = 7,
    tageNachher = 3,
    minConfidence = 'medium'
  } = options
  
  const zahlungDatum = zahlung.datumDate || zahlung.datum
  if (!zahlungDatum) return null
  
  const candidates = vkRechnungen
    .filter(r => {
      // Betrag-Check mit Toleranz
      const betragMatch = Math.abs((r.brutto || 0) - Math.abs(zahlung.betrag)) <= betragTolerance
      if (!betragMatch) return false
      
      // Datum-Check mit Zeitfenster
      const rechnungDatum = new Date(r.rechnungsdatum)
      const zahlungDate = new Date(zahlungDatum)
      
      const diffMs = zahlungDate.getTime() - rechnungDatum.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      
      // Zahlung sollte NACH Rechnung sein (oder max tageVorher davor)
      return diffDays >= -tageVorher && diffDays <= tageNachher
    })
    .map(r => {
      const result = calculateBetragDatumScore(
        Math.abs(zahlung.betrag),
        r.brutto || 0,
        new Date(zahlungDatum),
        new Date(r.rechnungsdatum)
      )
      
      return {
        rechnung: r,
        score: result.score,
        confidence: result.confidence
      }
    })
    .sort((a, b) => a.score - b.score)  // Beste zuerst
  
  if (candidates.length === 0) return null
  
  const best = candidates[0]
  
  // Prüfe Mindest-Confidence
  const confidenceLevels = { high: 3, medium: 2, low: 1 }
  if (confidenceLevels[best.confidence] < confidenceLevels[minConfidence]) {
    return null
  }
  
  return {
    type: 'rechnung',
    rechnungId: best.rechnung._id.toString(),
    rechnungsNr: best.rechnung.cRechnungsNr || best.rechnung.rechnungsNr,
    confidence: best.confidence
  }
}

/**
 * Statistik-Hilfsfunktion
 */
export function initMatchStats() {
  return {
    totalZahlungen: 0,
    matched: 0,
    byMethod: {
      auNummerDirekt: 0,
      auNummerBetragDatum: 0,
      amazonOrderIdXRE: 0,
      reNummer: 0,
      reNummerEnhanced: 0,        // NEU
      amazonOrderId: 0,            // NEU
      fuzzyBetragDatum: 0,         // NEU
      betragDatum: 0,
      kategorie: 0,
      teilzahlung: 0               // NEU
    },
    byAnbieter: {} as Record<string, { total: number; matched: number }>,
    byConfidence: {
      high: 0,
      medium: 0,
      low: 0
    }
  }
}
