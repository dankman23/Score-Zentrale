/**
 * JTL-Glossar Normalisierung
 * Konvertiert geparste Daten in einheitliches Schema
 */

export interface GlossaryColumn {
  name: string
  type: string
  nullable: boolean
  default_value?: string | null
  description?: string
}

export interface GlossaryRelation {
  to: string
  via: string
  type: 'one-to-many' | 'many-to-one' | 'one-to-one'
}

export interface GlossarySampleQuery {
  title: string
  sql: string
  description?: string
  params?: Record<string, string>
}

export interface GlossaryTable {
  name: string
  schema?: string
  description?: string
  primary_key?: string | null
  columns: GlossaryColumn[]
  foreign_keys: Array<{
    column: string
    references_table: string
    references_column: string
  }>
  relations: GlossaryRelation[]
  sample_queries: GlossarySampleQuery[]
  best_practices: string[]
  indexes?: Array<{
    name: string
    columns: string[]
    unique: boolean
  }>
}

export interface GlossarySchema {
  version: string
  generated_at: string
  table_count: number
  tables: GlossaryTable[]
}

/**
 * Normalisiert geparste Tabellendaten
 */
export function normalizeTable(rawTable: any, tableName: string): GlossaryTable {
  const [schema, name] = tableName.includes('.') 
    ? tableName.split('.', 2) 
    : ['dbo', tableName]

  const normalized: GlossaryTable = {
    name: tableName,
    schema,
    description: rawTable.description || `JTL-Wawi Tabelle: ${tableName}`,
    primary_key: rawTable.primary_key || null,
    columns: (rawTable.columns || []).map((col: any) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable !== false,
      default_value: col.default_value || null,
      description: col.description
    })),
    foreign_keys: rawTable.foreign_keys || [],
    relations: inferRelations(rawTable.foreign_keys || [], tableName),
    sample_queries: generateSampleQueries(tableName, rawTable),
    best_practices: generateBestPractices(tableName, rawTable)
  }

  return normalized
}

/**
 * Leitet Relationen aus Foreign Keys ab
 */
function inferRelations(foreignKeys: any[], tableName: string): GlossaryRelation[] {
  return foreignKeys.map(fk => ({
    to: fk.references_table,
    via: fk.column,
    type: 'many-to-one' as const
  }))
}

/**
 * Generiert Beispiel-Queries für gängige Use-Cases
 */
function generateSampleQueries(tableName: string, table: any): GlossarySampleQuery[] {
  const queries: GlossarySampleQuery[] = []
  const pk = table.primary_key || 'id'

  // Basis-SELECT
  queries.push({
    title: `Alle Einträge aus ${tableName}`,
    sql: `SELECT TOP 100 * FROM ${tableName}`,
    description: 'Zeigt die ersten 100 Einträge'
  })

  // Zeitfilter (wenn dErstellt/dGeaendert vorhanden)
  const hasDateColumn = table.columns?.some((c: any) => 
    ['dErstellt', 'dGeaendert', 'dDatum', 'dBelegDatum'].includes(c.name)
  )
  
  if (hasDateColumn) {
    const dateCol = table.columns.find((c: any) => 
      ['dErstellt', 'dGeaendert', 'dDatum', 'dBelegDatum'].includes(c.name)
    )?.name || 'dErstellt'

    queries.push({
      title: `${tableName} - Letzte 30 Tage`,
      sql: `SELECT * FROM ${tableName} WHERE CAST(${dateCol} AS DATE) >= DATEADD(day, -30, CAST(GETDATE() AS DATE))`,
      description: 'Filtert Einträge der letzten 30 Tage',
      params: { days: '30' }
    })
  }

  // COUNT
  queries.push({
    title: `Anzahl Einträge in ${tableName}`,
    sql: `SELECT COUNT(*) AS total FROM ${tableName}`,
    description: 'Zählt alle Einträge'
  })

  return queries
}

/**
 * Generiert Best-Practice-Hinweise
 */
function generateBestPractices(tableName: string, table: any): string[] {
  const practices: string[] = []

  // Zeitfilter-Empfehlung
  const hasDateColumn = table.columns?.some((c: any) => 
    ['dErstellt', 'dGeaendert', 'dDatum'].includes(c.name)
  )
  
  if (hasDateColumn) {
    practices.push('Immer Zeitfilter auf dErstellt/dGeaendert setzen für Performance')
  }

  // Index-Hinweis bei großen Tabellen
  if (['tAuftrag', 'tRechnung', 'tArtikel', 'tKunde'].some(t => tableName.includes(t))) {
    practices.push('Große Tabelle - verwende LIMIT/TOP für Tests')
    practices.push('Nutze EXISTS statt COUNT(*) für Existenz-Checks')
  }

  // JOIN-Hinweise
  if (table.foreign_keys?.length > 0) {
    practices.push('Bevorzuge INNER JOIN über WHERE-Klausel für bessere Lesbarkeit')
  }

  // Allgemeine Hinweise
  practices.push('Verwende parametrisierte Queries (niemals String-Konkatenation)')
  practices.push('Nur SELECT - keine INSERT/UPDATE/DELETE in Analytics')

  return practices
}

/**
 * Erstellt vollständiges Glossar-Schema
 */
export function createGlossarySchema(tables: GlossaryTable[], version: string): GlossarySchema {
  return {
    version,
    generated_at: new Date().toISOString(),
    table_count: tables.length,
    tables: tables.sort((a, b) => a.name.localeCompare(b.name))
  }
}
