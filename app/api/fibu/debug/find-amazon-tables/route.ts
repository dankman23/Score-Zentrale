import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '@/../lib/db/mssql'

export const runtime = 'nodejs'
export const maxDuration = 180

/**
 * Durchsucht JTL-Datenbank nach Amazon-Auszahlungs-Tabellen
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getJTLConnection()
    
    const results: any = {
      amazon_tables: [],
      payment_tables: [],
      table_details: []
    }
    
    // 1. Alle Tabellen mit "Amazon" im Namen
    const amazonTables = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%Amazon%'
      ORDER BY TABLE_NAME
    `)
    
    results.amazon_tables = amazonTables.recordset
    
    // 2. Tabellen mit "Payout", "Settlement", "Zahlung"
    const paymentTables = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%Payout%'
         OR TABLE_NAME LIKE '%Settlement%'
         OR TABLE_NAME LIKE '%Zahlung%'
         OR TABLE_NAME LIKE '%Abrechnung%'
      ORDER BY TABLE_NAME
    `)
    
    results.payment_tables = paymentTables.recordset
    
    // 3. Für jede Amazon-Tabelle: Spalten und Daten prüfen
    for (const table of amazonTables.recordset.slice(0, 10)) { // Limitiere auf erste 10
      const tableInfo: any = {
        name: table.TABLE_NAME,
        columns: [],
        row_count: 0,
        oktober_count: 0,
        sample_data: []
      }
      
      // Spalten
      const columns = await pool.request().query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table.TABLE_NAME}'
        ORDER BY ORDINAL_POSITION
      `)
      
      tableInfo.columns = columns.recordset.map(c => ({
        name: c.COLUMN_NAME,
        type: c.DATA_TYPE,
        length: c.CHARACTER_MAXIMUM_LENGTH
      }))
      
      // Zeilen zählen
      try {
        const count = await pool.request().query(`
          SELECT COUNT(*) as cnt FROM dbo.${table.TABLE_NAME}
        `)
        tableInfo.row_count = count.recordset[0].cnt
        
        // Suche nach Datums-Spalten
        const dateColumns = columns.recordset.filter(c => 
          c.DATA_TYPE.includes('date') || 
          c.DATA_TYPE.includes('time') ||
          c.COLUMN_NAME.toLowerCase().includes('date') ||
          c.COLUMN_NAME.toLowerCase().includes('datum')
        )
        
        tableInfo.date_columns = dateColumns.map(c => c.COLUMN_NAME)
        
        // Prüfe auf Oktober 2025 Daten
        if (dateColumns.length > 0) {
          for (const dateCol of dateColumns.slice(0, 3)) { // Nur erste 3 Datums-Spalten
            try {
              const oktData = await pool.request().query(`
                SELECT COUNT(*) as cnt 
                FROM dbo.${table.TABLE_NAME}
                WHERE ${dateCol.COLUMN_NAME} >= '2025-10-01' 
                  AND ${dateCol.COLUMN_NAME} < '2025-11-01'
              `)
              if (oktData.recordset[0].cnt > 0) {
                tableInfo.oktober_count = oktData.recordset[0].cnt
                tableInfo.oktober_date_column = dateCol.COLUMN_NAME
                
                // Hole Sample-Daten
                const sample = await pool.request().query(`
                  SELECT TOP 5 * 
                  FROM dbo.${table.TABLE_NAME}
                  WHERE ${dateCol.COLUMN_NAME} >= '2025-10-01' 
                    AND ${dateCol.COLUMN_NAME} < '2025-11-01'
                `)
                tableInfo.sample_data = sample.recordset
                
                break
              }
            } catch (e) {
              // Ignoriere Fehler
            }
          }
        }
        
        // Suche nach Betrags-Spalten
        const amountColumns = columns.recordset.filter(c => 
          c.COLUMN_NAME.toLowerCase().includes('amount') ||
          c.COLUMN_NAME.toLowerCase().includes('betrag') ||
          c.COLUMN_NAME.toLowerCase().includes('summe') ||
          c.COLUMN_NAME.toLowerCase().includes('total')
        )
        
        tableInfo.amount_columns = amountColumns.map(c => c.COLUMN_NAME)
        
      } catch (e: any) {
        tableInfo.error = e.message
      }
      
      results.table_details.push(tableInfo)
    }
    
    await pool.close()
    
    return NextResponse.json({
      ok: true,
      results
    })
    
  } catch (error: any) {
    console.error('[Find Amazon Tables] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
