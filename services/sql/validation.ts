/**
 * JTL-Wawi Schema-Validierung
 * Prüft kritische Tabellen und Spalten für Score Zentrale
 */

import { getMssqlPool } from '@/lib/db/mssql'
import { tableExists, hasColumn, firstExistingTable } from '@/lib/sql/utils'

export interface SchemaRequirement {
  category: string
  table_candidates: string[]
  required_columns: string[]
  optional_columns?: string[]
  critical: boolean
}

export interface ValidationResult {
  ok: boolean
  timestamp: string
  critical_issues: string[]
  warnings: string[]
  details: Array<{
    category: string
    table_found: string | null
    missing_required: string[]
    missing_optional: string[]
    status: 'OK' | 'WARNING' | 'CRITICAL'
  }>
}

/**
 * Definition der kritischen Schema-Anforderungen für Score Zentrale
 */
const SCHEMA_REQUIREMENTS: SchemaRequirement[] = [
  {
    category: 'Orders (Aufträge)',
    table_candidates: ['Verkauf.tAuftrag', 'dbo.tAuftrag'],
    required_columns: ['kAuftrag', 'dErstellt'],
    optional_columns: ['nStorno', 'cStatus', 'cBestellNr', 'kPlattform'],
    critical: true
  },
  {
    category: 'Order Positions (Auftragspositionen)',
    table_candidates: ['Verkauf.tAuftragPosition', 'dbo.tAuftragPosition'],
    required_columns: ['kAuftrag', 'kArtikel'],
    optional_columns: ['nPosTyp', 'fVKNetto', 'fVKBrutto', 'fAnzahl', 'fEKNetto'],
    critical: true
  },
  {
    category: 'Articles (Artikel)',
    table_candidates: ['dbo.tArtikel'],
    required_columns: ['kArtikel'],
    optional_columns: ['cArtNr', 'cName', 'fVKNetto', 'fEKNetto'],
    critical: true
  },
  {
    category: 'Customers (Kunden)',
    table_candidates: ['dbo.tKunde'],
    required_columns: ['kKunde'],
    optional_columns: ['cFirma', 'cName', 'cMail', 'dErstellt', 'dGeaendert'],
    critical: true
  },
  {
    category: 'Invoices (Rechnungen)',
    table_candidates: ['Verkauf.tRechnung', 'dbo.tRechnung'],
    required_columns: ['kRechnung'],
    optional_columns: ['kAuftrag', 'dErstellt', 'fGesamtNetto', 'fGesamtBrutto'],
    critical: false
  },
  {
    category: 'Purchase Orders (Bestellungen)',
    table_candidates: ['Beschaffung.tBestellung', 'dbo.tBestellung'],
    required_columns: ['kBestellung'],
    optional_columns: ['dErstellt', 'dBestelldatum', 'nStatus'],
    critical: false
  },
  {
    category: 'Purchase Order Positions',
    table_candidates: ['Beschaffung.tBestellungPos', 'dbo.tBestellungPos'],
    required_columns: ['kBestellung'],
    optional_columns: ['fMenge', 'fEKPreis', 'fGesamtNetto'],
    critical: false
  },
  {
    category: 'Supplier Invoices (Eingangsrechnungen)',
    table_candidates: ['Einkauf.tEingangsrechnung', 'dbo.tEingangsrechnung'],
    required_columns: ['kEingangsrechnung'],
    optional_columns: ['dBelegDatum', 'dErstellt', 'nVerbucht'],
    critical: false
  }
]

/**
 * Validiert das gesamte DB-Schema gegen Anforderungen
 */
export async function validateSchema(): Promise<ValidationResult> {
  const result: ValidationResult = {
    ok: true,
    timestamp: new Date().toISOString(),
    critical_issues: [],
    warnings: [],
    details: []
  }

  try {
    const pool = await getMssqlPool()

    for (const requirement of SCHEMA_REQUIREMENTS) {
      const detail = await validateRequirement(pool, requirement)
      result.details.push(detail)

      if (detail.status === 'CRITICAL') {
        result.ok = false
        result.critical_issues.push(
          `${requirement.category}: Tabelle nicht gefunden oder kritische Spalten fehlen`
        )
      } else if (detail.status === 'WARNING') {
        result.warnings.push(
          `${requirement.category}: Optionale Features möglicherweise eingeschränkt`
        )
      }
    }

    // Finaler OK-Status: Keine kritischen Issues
    result.ok = result.critical_issues.length === 0

  } catch (error: any) {
    result.ok = false
    result.critical_issues.push(`Database connection failed: ${error.message}`)
  }

  return result
}

/**
 * Validiert eine einzelne Schema-Anforderung
 */
async function validateRequirement(pool: any, req: SchemaRequirement) {
  const detail = {
    category: req.category,
    table_found: null as string | null,
    missing_required: [] as string[],
    missing_optional: [] as string[],
    status: 'OK' as 'OK' | 'WARNING' | 'CRITICAL'
  }

  // 1. Prüfe ob irgendeine Tabellen-Variante existiert
  const foundTable = await firstExistingTable(pool, req.table_candidates)
  
  if (!foundTable) {
    detail.status = req.critical ? 'CRITICAL' : 'WARNING'
    return detail
  }

  detail.table_found = foundTable

  // 2. Prüfe required Spalten
  for (const col of req.required_columns) {
    const exists = await hasColumn(pool, foundTable, col)
    if (!exists) {
      detail.missing_required.push(col)
    }
  }

  // 3. Prüfe optional Spalten
  if (req.optional_columns) {
    for (const col of req.optional_columns) {
      const exists = await hasColumn(pool, foundTable, col)
      if (!exists) {
        detail.missing_optional.push(col)
      }
    }
  }

  // 4. Status bestimmen
  if (detail.missing_required.length > 0) {
    detail.status = req.critical ? 'CRITICAL' : 'WARNING'
  } else if (detail.missing_optional.length > 0) {
    detail.status = 'WARNING'
  }

  return detail
}

/**
 * Quick-Check: Sind alle kritischen Komponenten OK?
 */
export async function quickHealthCheck(): Promise<{ ok: boolean; message: string }> {
  try {
    const pool = await getMssqlPool()
    
    // Prüfe nur die absolut kritischen Tabellen
    const criticalTables = [
      ['Verkauf.tAuftrag', 'dbo.tAuftrag'],
      ['Verkauf.tAuftragPosition', 'dbo.tAuftragPosition'],
      ['dbo.tArtikel'],
      ['dbo.tKunde']
    ]

    for (const candidates of criticalTables) {
      const found = await firstExistingTable(pool, candidates)
      if (!found) {
        return {
          ok: false,
          message: `Kritische Tabelle fehlt: ${candidates.join(' oder ')}`
        }
      }
    }

    return {
      ok: true,
      message: 'Alle kritischen Tabellen verfügbar'
    }

  } catch (error: any) {
    return {
      ok: false,
      message: `DB-Verbindung fehlgeschlagen: ${error.message}`
    }
  }
}

/**
 * Generiert Empfehlungen basierend auf Validierungsergebnis
 */
export function generateRecommendations(result: ValidationResult): string[] {
  const recommendations: string[] = []

  if (!result.ok) {
    recommendations.push('🔴 KRITISCH: Einige Kernfunktionen sind nicht verfügbar')
  }

  if (result.warnings.length > 0) {
    recommendations.push('⚠️ Optionale Features könnten eingeschränkt sein')
  }

  // Spezifische Empfehlungen
  const missingPurchase = result.details.find(d => 
    d.category.includes('Purchase') && d.table_found === null
  )
  
  if (missingPurchase) {
    recommendations.push(
      '💡 Beschaffungs-Module nicht aktiviert in JTL → Expenses/Purchase Orders nicht verfügbar'
    )
  }

  if (result.ok && result.warnings.length === 0) {
    recommendations.push('✅ Alle Funktionen voll einsatzbereit')
  }

  return recommendations
}
