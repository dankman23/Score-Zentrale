/**
 * FIBU Utilities
 * Hilfsfunktionen für die Buchhaltungs-Logik
 */

const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'XI'
]

const DRITTLAND_COUNTRIES = [
  'CH', 'GB', 'NO', 'US', 'CA', 'AU', 'JP', 'CN', 'RU', 'TR', 'IN'
  // Erweitere bei Bedarf
]

export interface KontozuordnungRegel {
  sachkonto: string
  bezeichnung: string
  firmenLand: string  // z.B. 'DE', 'PL', 'CZ'
  kundenLand: string  // z.B. 'DE', 'EU', 'Drittl.'
  zielLand: string    // z.B. 'DE', 'AT', 'FR'
  mitUstId: boolean
  mwstSatz?: number
}

export interface Rechnung {
  kRechnung: number
  cRechnungsNr: string
  dErstellt: string
  fGesamtsumme: number
  fWarensumme: number
  fMwSt: number
  cStatus: string
  kKunde: number
  kundenName: string
  kundenLand: string
  kundenUstId?: string
  zahlungsart: string
  kZahlungsart: number
  // Berechnete Felder
  debitorKonto?: string
  sachkonto?: string
  istInnerg?: boolean
}

export interface Zahlung {
  kZahlung: number
  kRechnung: number
  fBetrag: number
  dZeit: string
  cHinweis: string
  zahlungsart: string
}

/**
 * Bestimmt ob ein Land in der EU ist
 */
export function isEUCountry(land: string): boolean {
  return EU_COUNTRIES.includes(land.toUpperCase())
}

/**
 * Bestimmt ob ein Land ein Drittland ist
 */
export function isDrittland(land: string): boolean {
  if (!land) return false
  const upperLand = land.toUpperCase()
  return !isEUCountry(upperLand) && upperLand !== 'DE'
}

/**
 * Bestimmt das Debitor-Sammelkonto basierend auf Zahlungsart
 * 
 * @param kZahlungsart JTL Zahlungsart-ID
 * @param kundenLand Kundenland
 * @param hatUstId Hat Kunde eine USt-ID?
 * @returns Debitor-Kontonummer
 */
export function getDebitorKonto(
  kZahlungsart: number,
  kundenLand: string,
  hatUstId: boolean
): string {
  // Innergemeinschaftliche Lieferungen mit USt-ID → Einzeldebitor ab 70000
  if (hatUstId && isEUCountry(kundenLand) && kundenLand !== 'DE') {
    // Einzeldebitor - wird später mit kKunde verknüpft
    return '70000' // Platzhalter, wird später um kKunde-ID erweitert
  }
  
  // Sammeldebitoren nach Zahlungsart (aus Screenshot)
  const zahlungsartMapping: { [key: number]: string } = {
    2: '69018',   // Überweisung / Vorkasse
    20: '69018',  // Vorkasse
    1: '69002',   // Bar
    3: '69017',   // Scheck
    4: '69008',   // Kreditkarte
    5: '69004',   // eBay Rechnungskauf
    6: '69012',   // PayPal
    7: '69003',   // eBay Managed Payments
    8: '69001',   // Amazon Payment
    10: '69013',  // PayPal Express
    11: '69007',  // Kaufland.de
    12: '69014',  // Ratepay
    13: '69010',  // Nachnahme
    14: '69011',  // Otto.de
    15: '69006',  // GiroPay
    16: '69005',  // EPS
    17: '69019',  // Überweisung / Vorkasse mit 2% Skonto
    18: '69015',  // Rechnung
    19: '69020',  // Mollie
    22: '69002',  // Apple Pay
  }
  
  return zahlungsartMapping[kZahlungsart] || '69015' // Default: Rechnung
}

/**
 * Bestimmt das Erlöskonto (Sachkonto) basierend auf Kundenland und USt-ID
 * 
 * @param kundenLand Kundenland (ISO-Code)
 * @param hatUstId Hat Kunde eine USt-ID?
 * @param mwstSatz MwSt-Satz (7, 19, etc.)
 * @param firmenLand Firmenland (Standard: 'DE')
 * @returns Sachkonto-Nummer
 */
export function getSachkonto(
  kundenLand: string,
  hatUstId: boolean,
  mwstSatz: number = 19,
  firmenLand: string = 'DE'
): string {
  const land = kundenLand.toUpperCase()
  
  // Drittland (Nicht-EU) → 4120
  if (isDrittland(land)) {
    return '4120'
  }
  
  // EU mit USt-ID (Innergemeinschaftlich B2B) → 4125
  if (hatUstId && isEUCountry(land) && land !== 'DE') {
    return '4125'
  }
  
  // Deutschland (Inland)
  if (land === 'DE') {
    if (mwstSatz === 0) return '4100'  // Keine USt
    if (mwstSatz === 7) return '4300'   // Ermäßigte USt
    if (mwstSatz === 19) return '4400'  // Volle USt
    return '4340' // Sonstige USt
  }
  
  // EU ohne USt-ID (B2C) → OSS-Konten 4310/4315/4320/4330
  if (isEUCountry(land) && !hatUstId) {
    // Vereinfachung: Verwende 4320 für Standard-Steuer
    // In Realität müsste hier der länderspezifische Steuersatz geprüft werden
    if (mwstSatz === 0) return '4100'  // Keine USt
    if (mwstSatz <= 7) return '4310'   // Ermäßigte USt EU
    if (mwstSatz >= 19) return '4315'  // Volle USt EU
    return '4330' // Sonstige USt EU
  }
  
  // Fallback
  return '4400'
}

/**
 * Berechnet MwSt-Satz aus Beträgen
 */
export function calculateMwStSatz(brutto: number, netto: number): number {
  if (netto === 0) return 0
  const satz = ((brutto - netto) / netto) * 100
  
  // Runde auf Standard-Steuersätze
  if (satz < 3) return 0
  if (satz >= 6 && satz <= 8) return 7
  if (satz >= 18 && satz <= 20) return 19
  
  return Math.round(satz)
}

/**
 * Formatiert Datum für SQL-Queries
 */
export function formatDateForSQL(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

/**
 * Prüft ob eine Rechnung eine Gutschrift ist
 */
export function isGutschrift(rechnungsNr: string): boolean {
  return rechnungsNr.startsWith('GS') || rechnungsNr.includes('Gutschrift')
}
