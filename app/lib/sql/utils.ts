import sql from 'mssql'

type MssqlPool = Awaited<ReturnType<typeof sql.connect>>

/**
 * SQL-Utilitys für dynamische Schema-Erkennung
 * Macht SQL-Queries robust gegen Tabellen-/Spaltenvariationen in JTL-Wawi
 */

/**
 * Prüft, ob eine Tabelle existiert
 * @param pool MSSQL Connection Pool
 * @param fullName Voller Tabellenname (z.B. "Einkauf.tEingangsrechnung" oder "dbo.tArtikel")
 * @returns true wenn Tabelle existiert
 */
export async function tableExists(pool: MssqlPool, fullName: string): Promise<boolean> {
  try {
    const r = await pool.request()
      .input('name', sql.NVarChar, fullName)
      .query("SELECT CASE WHEN OBJECT_ID(@name) IS NULL THEN 0 ELSE 1 END AS ok")
    return ((r?.recordset?.[0]?.ok ?? 0) > 0)
  } catch {
    return false
  }
}

/**
 * Findet die erste existierende Tabelle aus einer Liste von Kandidaten
 * @param pool MSSQL Connection Pool
 * @param candidates Array von Tabellennamen (z.B. ["Einkauf.tEingangsrechnung", "dbo.tEingangsrechnung"])
 * @returns Name der ersten gefundenen Tabelle oder null
 */
export async function firstExistingTable(pool: MssqlPool, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (await tableExists(pool, candidate)) {
      return candidate
    }
  }
  return null
}

/**
 * Prüft, ob eine Spalte in einer Tabelle existiert
 * @param pool MSSQL Connection Pool
 * @param fullName Voller Tabellenname
 * @param col Spaltenname
 * @returns true wenn Spalte existiert
 */
export async function hasColumn(pool: ConnectionPool, fullName: string, col: string): Promise<boolean> {
  try {
    const r = await pool.request()
      .input('tbl', sql.NVarChar, fullName)
      .input('col', sql.NVarChar, col)
      .query('SELECT COUNT(*) AS ok FROM sys.columns WHERE object_id = OBJECT_ID(@tbl) AND name = @col')
    return ((r?.recordset?.[0]?.ok ?? 0) > 0)
  } catch {
    return false
  }
}

/**
 * Erstellt eine inklusive Datums-WHERE-Klausel mit Priorität über mehrere mögliche Datumsspalten
 * @param alias Tabellen-Alias (z.B. "h")
 * @param from Start-Datum (ISO String YYYY-MM-DD)
 * @param to End-Datum (ISO String YYYY-MM-DD)
 * @param colPref Array von Spalten in Prioritätsreihenfolge (z.B. ["dBelegDatum", "dErstellt", "dEingang"])
 * @returns SQL WHERE-Klausel String
 */
export function inclusiveDateWhere(alias: string, from: string, to: string, colPref: string[]): string {
  // Baut COALESCE mit Fallback-Logik
  const coalesceFields = colPref.map(c => `${alias}.${c}`).join(', ')
  return `CAST(COALESCE(${coalesceFields}) AS DATE) BETWEEN '${from}' AND '${to}'`
}

/**
 * Holt die erste existierende Spalte aus einer Liste von Kandidaten
 * @param pool MSSQL Connection Pool
 * @param table Tabellenname
 * @param candidates Array von Spaltennamen
 * @returns Name der ersten gefundenen Spalte oder null
 */
export async function pickFirstExisting(pool: ConnectionPool, table: string, candidates: string[]): Promise<string | null> {
  for (const c of candidates) {
    if (await hasColumn(pool, table, c)) {
      return c
    }
  }
  return null
}
