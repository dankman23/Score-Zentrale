/**
 * Dual-Matcher: Findet BELEG + KONTO gleichzeitig
 * Erweitert die bestehende Auto-Match-Logik
 */

import { Db } from 'mongodb'
import { classifyKonto } from './konto-classifier'
import { extractAuNummer, extractRechnungsNr, extractAmazonOrderId } from './matching-engine'

export interface DualMatchResult {
  beleg: {
    found: boolean
    rechnungId?: string
    rechnungsNr?: string
    confidence?: 'high' | 'medium' | 'low'
    method?: string
  }
  konto: {
    found: boolean
    konto?: string
    steuer?: number
    bezeichnung?: string
    confidence?: number
    method?: string
  }
}

/**
 * Findet BELEG + KONTO für eine Zahlung
 */
export async function findDualMatch(
  zahlung: any,
  alleRechnungen: any[],
  vkRechnungen: any[],
  db: Db,
  anbieter: string
): Promise<DualMatchResult> {
  const result: DualMatchResult = {
    beleg: { found: false },
    konto: { found: false }
  }
  
  // === TEIL 1: BELEG SUCHEN ===
  
  // Strategie 1: AU-Nummer (PayPal, Mollie)
  if (anbieter === 'PayPal' || anbieter === 'Mollie') {
    const auNr = zahlung.rechnungsNr || extractAuNummer(
      zahlung.verwendungszweck || zahlung.beschreibung
    )
    
    if (auNr) {
      const match = alleRechnungen.find(r => {
        const bestellnr = r.cBestellNr || ''
        return bestellnr.includes(auNr) || auNr.includes(bestellnr)
      })
      
      if (match) {
        result.beleg = {
          found: true,
          rechnungId: match.uniqueId || match._id.toString(),
          rechnungsNr: match.belegnummer || match.cRechnungsNr,
          confidence: 'high',
          method: 'au_nummer'
        }
      }
    }
  }
  
  // Strategie 2: RE-Nummer (Bank)
  if (!result.beleg.found && (anbieter === 'Commerzbank' || anbieter === 'Postbank')) {
    const reNr = extractRechnungsNr(zahlung.verwendungszweck || '')
    
    if (reNr) {
      const match = vkRechnungen.find(r => {
        const belegnr = r.cRechnungsNr || r.rechnungsNr || ''
        return belegnr.includes(reNr) || reNr.includes(belegnr)
      })
      
      if (match) {
        result.beleg = {
          found: true,
          rechnungId: match._id.toString(),
          rechnungsNr: match.cRechnungsNr || match.rechnungsNr,
          confidence: 'high',
          method: 're_nummer'
        }
      }
    }
  }
  
  // Strategie 3: Amazon Order-ID
  if (!result.beleg.found && anbieter === 'Amazon') {
    const orderId = zahlung.orderId || zahlung.merchantOrderId
    
    if (orderId) {
      const match = alleRechnungen.find(r => {
        const bestellnr = r.cBestellNr || ''
        return bestellnr.includes(orderId)
      })
      
      if (match) {
        result.beleg = {
          found: true,
          rechnungId: match.uniqueId || match._id.toString(),
          rechnungsNr: match.belegnummer || match.cRechnungsNr,
          confidence: 'high',
          method: 'amazon_order_id'
        }
      }
    }
  }
  
  // Strategie 4: Betrag + Datum (Fallback)
  if (!result.beleg.found) {
    const zahlungDatum = zahlung.datumDate || zahlung.datum
    
    if (zahlungDatum) {
      const candidates = vkRechnungen
        .filter(r => {
          const betragMatch = Math.abs((r.brutto || 0) - Math.abs(zahlung.betrag)) < 0.50
          if (!betragMatch) return false
          
          const rechnungDatum = new Date(r.rechnungsdatum)
          const zahlungDate = new Date(zahlungDatum)
          const diffMs = zahlungDate.getTime() - rechnungDatum.getTime()
          const diffDays = diffMs / (1000 * 60 * 60 * 24)
          
          return diffDays >= -7 && diffDays <= 3
        })
        .sort((a, b) => {
          const aDiff = Math.abs((a.brutto || 0) - Math.abs(zahlung.betrag))
          const bDiff = Math.abs((b.brutto || 0) - Math.abs(zahlung.betrag))
          return aDiff - bDiff
        })
      
      if (candidates.length > 0 && candidates[0]) {
        const best = candidates[0]
        const betragDiff = Math.abs((best.brutto || 0) - Math.abs(zahlung.betrag))
        
        if (betragDiff < 0.25) {
          result.beleg = {
            found: true,
            rechnungId: best._id.toString(),
            rechnungsNr: best.cRechnungsNr || best.rechnungsNr,
            confidence: 'medium',
            method: 'betrag_datum'
          }
        }
      }
    }
  }
  
  // === TEIL 2: KONTO SUCHEN ===
  
  // Wenn Zahlung eine Rechnung hat → Konto für diese Rechnung ermitteln
  if (result.beleg.found && result.beleg.rechnungId) {
    // Finde Rechnung
    const rechnung = alleRechnungen.find(r => 
      (r.uniqueId === result.beleg.rechnungId) || 
      (r._id?.toString() === result.beleg.rechnungId)
    )
    
    if (rechnung) {
      // VK-Rechnung → Erlöskonto (abhängig von Land/USt-ID)
      if (rechnung.belegnummer?.startsWith('RE')) {
        const land = rechnung.land || 'DE'
        const ustId = rechnung.ustId
        
        // Erlöskonto ermitteln
        const erlösKonto = getErlöskontoForRechnung(land, ustId)
        
        result.konto = {
          found: true,
          konto: erlösKonto.konto,
          steuer: erlösKonto.steuer,
          bezeichnung: erlösKonto.bezeichnung,
          confidence: 0.95,
          method: 'rechnung_erlös'
        }
      }
      // XRE (Externe Rechnung) → Erlöskonto
      else if (rechnung.quelle === 'EXTERN') {
        const land = rechnung.land || 'DE'
        const ustId = rechnung.ustId
        
        const erlösKonto = getErlöskontoForRechnung(land, ustId)
        
        result.konto = {
          found: true,
          konto: erlösKonto.konto,
          steuer: erlösKonto.steuer,
          bezeichnung: erlösKonto.bezeichnung,
          confidence: 0.90,
          method: 'externe_rechnung_erlös'
        }
      }
    }
  }
  
  // Wenn kein Konto über Rechnung gefunden → Klassifikator verwenden
  if (!result.konto.found) {
    // Debug: Log Zahlung-Felder
    console.log(`[Dual-Matcher] Klassifiziere Zahlung: betrag=${zahlung.betrag}, kategorie=${zahlung.kategorie}, verwendungszweck=${zahlung.verwendungszweck}`)
    
    const suggestion = await classifyKonto(zahlung, db)
    
    if (suggestion) {
      result.konto = {
        found: true,
        konto: suggestion.konto,
        steuer: suggestion.steuer,
        bezeichnung: suggestion.bezeichnung,
        confidence: suggestion.confidence,
        method: suggestion.method
      }
    }
  }
  
  return result
}

/**
 * Hilfsfunktion: Ermittle Erlöskonto für Rechnung
 */
function getErlöskontoForRechnung(land: string, ustId?: string): {
  konto: string
  steuer: number
  bezeichnung: string
} {
  const landUpper = land.toUpperCase()
  
  // Deutschland
  if (landUpper === 'DE') {
    return {
      konto: '8400',
      steuer: 19,
      bezeichnung: 'Erlöse 19% USt'
    }
  }
  
  // EU-Länder
  const euLaender = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']
  
  if (euLaender.includes(landUpper)) {
    // Mit USt-ID → steuerfrei (§13b UStG)
    if (ustId && ustId.trim().length > 0) {
      return {
        konto: '8338',
        steuer: 0,
        bezeichnung: 'Steuerfreie innergemeinschaftliche Lieferungen'
      }
    }
    // Ohne USt-ID → wie Inland
    return {
      konto: '8400',
      steuer: 19,
      bezeichnung: 'Erlöse 19% USt (EU ohne USt-ID)'
    }
  }
  
  // Drittland (CH, GB, US, etc.)
  return {
    konto: '8120',
    steuer: 0,
    bezeichnung: 'Erlöse Ausfuhrlieferungen'
  }
}
