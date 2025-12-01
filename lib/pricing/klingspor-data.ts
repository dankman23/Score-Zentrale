/**
 * Klingspor Data Loader
 * Lädt JSON-Daten aus /app/data/klingspor/
 */

import validEntriesData from '../../data/klingspor/valid_entries.json'
import availableGritsData from '../../data/klingspor/available_grits.json'
import definitionPhData from '../../data/klingspor/definition_ph.json'
import backingData from '../../data/klingspor/backing.json'
import zpqgData from '../../data/klingspor/zpqg.json'
import zpsdData from '../../data/klingspor/zpsd.json'
import zsc2Data from '../../data/klingspor/zsc2.json'
import zsg1Data from '../../data/klingspor/zsg1.json'
import zms2Data from '../../data/klingspor/zms2.json'
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
export const definitionPh: DefinitionPH[] = definitionPhData as DefinitionPH[]
export const backing: Backing[] = backingData as Backing[]
export const zpqg: ZPQG[] = zpqgData as ZPQG[]
export const zpsd: ZPSD[] = zpsdData as ZPSD[]
export const zsc2: ZSC2[] = zsc2Data as ZSC2[]
export const zsg1: ZSG1[] = zsg1Data as ZSG1[]
export const zms2: ZMS2[] = zms2Data as ZMS2[]
export const exchangeRates: ExchangeRate[] = exchangeRatesData as ExchangeRate[]

// Helper: Typen Liste
export function getAvailableTypes(): string[] {
  const uniqueTypes = new Set(validEntries.map(e => e['SaU Type']))
  return Array.from(uniqueTypes).sort()
}

// Helper: Körnungen für Typ
export function getGritsForType(type: string): number[] {
  return availableGrits
    .filter(g => g['SaU Type'] === type)
    .map(g => g.Korn)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b)
}

// Helper: Backing-Typ
export function getBackingType(type: string): string {
  const entry = backing.find(b => b.Typ === type)
  return entry ? entry.UNTERLAGENART : 'Unbekannt'
}

// Helper: Product Hierarchy
export function getProductHierarchy(type: string): number | null {
  const entry = validEntries.find(e => e['SaU Type'] === type)
  return entry ? entry.PH : null
}
