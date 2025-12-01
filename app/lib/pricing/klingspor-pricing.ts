/**
 * Klingspor Belt Pricing Service
 * Implementiert die Excel-Logik 1:1
 */

import {
  validEntries,
  availableGrits,
  zpqg,
  zpsd,
  zsc2,
  zsg1,
  zms2,
  getBackingType,
  getProductHierarchy,
  getGritsForType
} from './klingspor-data'

export interface KlingsporBeltPriceRequest {
  type: string
  grit: string | number
  widthMm: number
  lengthMm: number
  salesOrg?: string  // default "DE10"
  currency?: string  // default "EUR"
}

export interface KlingsporBeltPriceResult {
  listPrice: number          // Listenpreis C21
  scoreEkPaperVlies: number  // C23 = C21 * 0.36
  scoreEkGewebe: number      // C24 = C21 * 0.26
  ls307xSpecialEk: number | null  // C27 = C21 * 0.177
  backingType: string
  productHierarchy: number | null
  
  // Debug-Felder
  m2Demand: number
  pricePer100m2: number
  basicPrice: number
  zpsdFactor: number
  zsc2Factor: number
  glueSurcharge: number
  totalProductSpecific: number
  salesOrgMultiplier: number | null
}

/**
 * Berechnet Klingspor-Schleifband-Preis
 */
export function calculateKlingsporBeltPrice(
  request: KlingsporBeltPriceRequest
): KlingsporBeltPriceResult {
  const { type, grit, widthMm, lengthMm, salesOrg = 'DE10', currency = 'EUR' } = request
  
  const gritNum = typeof grit === 'string' ? parseInt(grit) : grit
  
  // 1. Validierung - prüfe ob Typ + Körnung existiert
  const validEntry = validEntries.find(
    e => e['SaU Type'] === type && e.Korn === gritNum
  )
  
  if (!validEntry) {
    throw new Error(`Typ ${type} mit Körnung ${grit} nicht verfügbar`)
  }
  
  // 2. Backing & PH
  const backingType = getBackingType(type)
  const ph = getProductHierarchy(type)
  
  if (!ph) {
    throw new Error(`Produkthierarchie für Typ ${type} nicht gefunden`)
  }
  
  // 3. Fläche berechnen (m²)
  const m2Demand = (widthMm * lengthMm) / 1000000
  
  // 4. ZPQG - Preis pro 100 m²
  const zpqgEntry = zpqg.find(z => z['SaU Type'] === type)
  if (!zpqgEntry) {
    throw new Error(`ZPQG-Eintrag für Typ ${type} nicht gefunden`)
  }
  const pricePer100m2 = zpqgEntry.Konditionsbetrag
  
  // 5. Basispreis
  const basicPrice = (m2Demand * pricePer100m2) / 100
  
  // 6. ZPSD - Körnungszuschlag
  const zpsdEntry = zpsd.find(
    z => z['SaU Type'] === type && z.Korn === gritNum
  )
  const zpsdFactor = zpsdEntry ? zpsdEntry.Konditionsbetrag : 0
  const zpsdAmount = basicPrice * zpsdFactor
  
  // 7. ZSC2 - PH-Zuschlag (in %)
  const zsc2Entry = zsc2.find(z => z.Produkthierarchie === ph)
  const zsc2Percent = zsc2Entry ? zsc2Entry.Betrag : 0
  const zsc2Factor = zsc2Percent / 100
  const zsc2Amount = basicPrice * zsc2Factor
  
  // 8. ZSG1 - Leimzuschlag
  const backingShort = backingType.charAt(0).toLowerCase() // 'g' für Gewebe, 'p' für Papier
  const zsg1Entry = zsg1.find(
    z => z.Produkthierarchie === ph &&
         z['ab Breite [mm]'] <= widthMm
  )
  const glueSurcharge = zsg1Entry ? (zsg1Entry.Konditionsbetrag / 100) : 0
  
  // 9. Summe produktspezifisch
  const totalProductSpecific = basicPrice + zpsdAmount + zsc2Amount + glueSurcharge
  
  // 10. ZMS2 - Sales Org Multiplikator
  const zms2Match = `${ph}${type}`
  const zms2Entry = zms2.find(
    z => z.Verkaufsorganisation === salesOrg &&
         z.Match.includes(type)
  )
  const salesOrgMultiplier = zms2Entry ? zms2Entry.Konditionsbetrag : null
  
  // 11. Listenpreis
  let listPrice = totalProductSpecific
  if (salesOrgMultiplier) {
    listPrice = salesOrgMultiplier
  }
  
  // 12. Score-EK-Varianten
  const scoreEkPaperVlies = listPrice * 0.36  // 64% Rabatt
  const scoreEkGewebe = listPrice * 0.26      // 74% Rabatt
  const ls307xSpecialEk = type === 'LS 307 X' ? listPrice * 0.177 : null  // 82,3% Rabatt
  
  return {
    listPrice: parseFloat(listPrice.toFixed(2)),
    scoreEkPaperVlies: parseFloat(scoreEkPaperVlies.toFixed(2)),
    scoreEkGewebe: parseFloat(scoreEkGewebe.toFixed(2)),
    ls307xSpecialEk: ls307xSpecialEk ? parseFloat(ls307xSpecialEk.toFixed(2)) : null,
    backingType,
    productHierarchy: ph,
    
    // Debug
    m2Demand: parseFloat(m2Demand.toFixed(6)),
    pricePer100m2,
    basicPrice: parseFloat(basicPrice.toFixed(2)),
    zpsdFactor,
    zsc2Factor,
    glueSurcharge: parseFloat(glueSurcharge.toFixed(2)),
    totalProductSpecific: parseFloat(totalProductSpecific.toFixed(2)),
    salesOrgMultiplier
  }
}

/**
 * Wählt richtigen Score-EK basierend auf Typ & Unterlagenart
 */
export function selectScoreEk(
  result: KlingsporBeltPriceResult,
  type: string
): number {
  const t = type.replace(/\s+/g, '').toUpperCase()
  
  // Spezialfall LS307X
  if (t === 'LS307X' && result.ls307xSpecialEk != null) {
    return result.ls307xSpecialEk
  }
  
  const backing = result.backingType.toUpperCase()
  
  // Papier/Vlies
  if (backing.includes('PAPIER') || backing.includes('VLIES') || backing.includes('NON WOVEN')) {
    return result.scoreEkPaperVlies
  }
  
  // Gewebe
  if (backing.includes('GEWEBE') || backing.includes('CLOTH')) {
    return result.scoreEkGewebe
  }
  
  // Fallback
  return result.scoreEkPaperVlies
}

/**
 * MBM nach Breite
 */
export function getMinOrderQty(widthMm: number): number {
  if (widthMm >= 3 && widthMm <= 50) return 30
  if (widthMm >= 51 && widthMm <= 60) return 25
  if (widthMm >= 61 && widthMm <= 75) return 20
  if (widthMm >= 76 && widthMm <= 100) return 15
  if (widthMm >= 101 && widthMm <= 150) return 10
  if (widthMm >= 151 && widthMm <= 300) return 10
  if (widthMm >= 301 && widthMm <= 399) return 30
  if (widthMm >= 400) return 10
  return 0
}
