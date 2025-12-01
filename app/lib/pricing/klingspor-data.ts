/**
 * Klingspor Data Loader
 * Lädt JSON-Daten aus /app/data/klingspor/
 */

import validEntriesData from '../../data/klingspor_new/valid_entries.json'
import availableGritsData from '../../data/klingspor_new/available_grits.json'
import backingDataNew from '../../data/klingspor_new/backing.json'
import typesData from '../../data/klingspor_new/types.json'
import definitionPhData from '../../data/klingspor_new/definition_ph.json'
import zms2DataNew from '../../data/klingspor_new/zms2.json'
import zpqgData from '../../data/klingspor/zpqg.json'
import zpsdData from '../../data/klingspor/zpsd.json'
import zsc2Data from '../../data/klingspor/zsc2.json'
import zsg1Data from '../../data/klingspor/zsg1.json'
import exchangeRatesData from '../../data/klingspor/exchange_rates.json'

export interface ValidEntry {
  'SaU Type': string
  Korn: number
  PH: number
  Bezeichnung: string
  Unterlagenart: string
}

export interface AvailableGrit {
  Produktgruppe: string
  'SaU Type': string
  Korn: number
  'Ausführung der SaU Type': string
}

export interface DefinitionPH {
  PH: number
  Bezeichnung: string
  Backing: string | null
  Type: string | null
  Width: string
  Length: string | number
}

export interface Backing {
  Typ: string
  UNTERLAGENART: string
  'UNTERLAGENART EN': string
}

export interface ZPQG {
  Konditionsart: string
  'SaU Type': string
  'Gültig bis': string
  'Gültig ab': string
  Konditionsbetrag: number
  Konditionswährung: string
  Preiseinheit: number
  Mengeneinheit: string
}

export interface ZPSD {
  Match: string
  Konditionsart: string
  'SaU Type': string
  Korn: number
  'Gültig bis': string
  'Gültig ab': string
  Konditionsbetrag: number
}

export interface ZSC2 {
  Konditionsart: string
  Produkthierarchie: number
  'Gültig bis': string
  'Gültig ab': string
  Betrag: number
}

export interface ZSG1 {
  Match2: string
  Match: string
  Produkthierarchie: number
  Unterlagenart: string
  'ab Breite [mm]': number
  Staffelmenge: number
  Konditionsbetrag: number
  Konditionswährung: string
  Preiseinheit: number
  Mengeneinheit: string
}

export interface ZMS2 {
  Match2: string
  Match: string
  Konditionsart: string
  Verkaufsorganisation: string
  Produkthierarchie: string
  'SaU Type': string
  'Gültig bis': string
  'Gültig ab': string
  Konditionsbetrag: number
}

export interface ExchangeRate {
  ZFIX: string | null
  [key: string]: any
}

// Export data
export const validEntries: ValidEntry[] = validEntriesData as ValidEntry[]
export const availableGrits: AvailableGrit[] = availableGritsData as AvailableGrit[]
export const backingMap: Record<string, {de: string, en: string}> = backingDataNew as Record<string, {de: string, en: string}>
export const phMap: Record<string, number> = definitionPhData as Record<string, number>
export const allTypes: string[] = typesData as string[]
export const zpqg: ZPQG[] = zpqgData as ZPQG[]
export const zpsd: ZPSD[] = zpsdData as ZPSD[]
export const zsc2: ZSC2[] = zsc2Data as ZSC2[]
export const zsg1: ZSG1[] = zsg1Data as ZSG1[]
export const zms2: ZMS2[] = zms2Data as ZMS2[]
export const exchangeRates: ExchangeRate[] = exchangeRatesData as ExchangeRate[]

// Helper: Typen Liste (ALLE 55 Typen aus der neuen Excel)
export function getAvailableTypes(): string[] {
  return allTypes
}

// Helper: Körnungen für Typ (aus available_grits)
export function getGritsForType(type: string): number[] {
  const grits = availableGrits
    .filter(g => g['SaU Type'] === type)
    .map(g => g.Korn)
    .filter(k => k !== null && k !== undefined && typeof k === 'number')
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b)
  
  return grits
}

// Helper: Backing-Typ (verwendet neue backing.json)
export function getBackingType(type: string): string {
  const backingInfo = backingMap[type]
  if (backingInfo && backingInfo.de) {
    return backingInfo.de
  }
  
  // Fallback: Regel-basiert
  if (type.startsWith('PS')) return 'Papier'
  if (type.startsWith('NBS') || type.startsWith('NBF')) return 'Vlies'
  return 'Gewebe'
}

// Helper: Product Hierarchy (verwendet definition_ph.json mit Fallback)
export function getProductHierarchy(type: string): number | null {
  // Prüfe phMap zuerst (vollständige Abdeckung aller 55 Typen)
  if (phMap[type]) {
    return phMap[type]
  }
  
  // Fallback: validEntries
  const entry = validEntries.find(e => e['SaU Type'] === type)
  if (entry && entry.PH) {
    return entry.PH
  }
  
  // Letzter Fallback: Standard PH für coat.abras.standard belts
  return 10200101
}
