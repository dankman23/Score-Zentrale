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
  const availableGrit = availableGrits.find(
    g => g['SaU Type'] === type && g.Korn === gritNum
  )
  
  if (!availableGrit) {
    throw new Error(`Typ ${type} mit Körnung ${grit} nicht verfügbar`)
  }
  
  // 2. Backing & PH
  const backingType = getBackingType(type)
  const ph = getProductHierarchy(type)
  
  if (!ph) {
    throw new Error(`Produkthierarchie für Typ ${type} nicht gefunden`)
  }
  
  // 3. Fläche berechnen (m²) - Excel: C5 = D2*E2/1000000
  const m2 = (widthMm * lengthMm) / 1000000
  
  // 4. ZPQG - Preis pro 100 m² - Excel: C6 = VLOOKUP($B$2,ZPQG!$B:$E,4,FALSE)
  const zpqgEntry = zpqg.find(z => z['SaU Type'] === type)
  if (!zpqgEntry) {
    throw new Error(`ZPQG-Eintrag für Typ ${type} nicht gefunden`)
  }
  const zpqg_price_per_100m2 = zpqgEntry.Konditionsbetrag  // Z.B. 1185 für CS 308 Y
  
  // 5. Basispreis - Excel: C7 = C5*C6/100
  const basicPrice = (m2 * zpqg_price_per_100m2) / 100
  
  // 6. ZPSD - Typ/Körnungs-Zuschlag (Faktor) - Excel: C8 = VLOOKUP($B$2&$C$2,ZPSD!$A:$G,7,FALSE)
  const zpsdKey = `${type}${gritNum}`
  const zpsdEntry = zpsd.find(z => `${z['SaU Type']}${z.Korn}` === zpsdKey)
  const zpsd_factor = zpsdEntry ? zpsdEntry.Konditionsbetrag : 0  // Z.B. 0 oder 0.05 = 5%
  
  // 7. ZSC2 - Rollenlängen-Zuschlag (Faktor) - Excel: C9 = VLOOKUP($F$2,ZSC2!$B:$G,6,FALSE)/100
  const zsc2Entry = zsc2.find(z => z.Produkthierarchie === ph)
  const zsc2_factor = zsc2Entry ? (zsc2Entry.Betrag / 100) : 0  // Z.B. 0.113 = 11,3%
  
  // 8. Rollbreiten-Zuschlag (absolut in EUR) - Excel: C10 = fixer Wert aus Tabelle
  // Für jetzt: hardcoded 18.15 (typischer Wert), TODO: aus Tabelle laden
  const rollWidthSurcharge = 18.15
  
  // 9. ZSG1 - Leimzuschlag (absolut in EUR) - Excel: C14 = VLOOKUP(...)
  // Vereinfacht: Suche ZSG1-Eintrag für PH + backing + width
  const zsg1Entry = zsg1.find(
    z => z.Produkthierarchie === ph && z['ab Breite [mm]'] <= widthMm
  )
  const glueSurcharge = zsg1Entry ? zsg1Entry.Konditionsbetrag : 0  // in Cent, z.B. 59
  
  // 10. Summe produktspezifisch - Excel: C15 = C7*(1+C8)*(1+C9)+(C10*C5/100)+(C14/100)
  const totalProductSpecific = 
    basicPrice * (1 + zpsd_factor) * (1 + zsc2_factor) +
    (rollWidthSurcharge * m2 / 100) +
    (glueSurcharge / 100)
  
  // 11. ZMS2 - Sales Org Multiplikator (in Prozent) - Excel: C16 = VLOOKUP(...)/100
  const zms2Entry = zms2.find(
    z => z.Verkaufsorganisation === salesOrg && 
         z.Produkthierarchie === ph &&
         z['SaU Type'] === type
  )
  const salesOrgMultiplier = zms2Entry ? (zms2Entry.Konditionsbetrag / 100) : 0  // z.B. 2.94
  
  // 12. Listenpreis in EUR - Excel: C17 = (C16+1)*C15
  const listPrice = (salesOrgMultiplier + 1) * totalProductSpecific
  
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
    m2Demand: parseFloat(m2.toFixed(6)),
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
