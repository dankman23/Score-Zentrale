export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

/**
 * GET /api/fibu/explore
 * Erkundet JTL-Datenbank für FIBU-relevante Daten
 */
export async function GET() {
  try {
    const pool = await getMssqlPool()
    const result: any = {}

    // 1. VK-Rechnungen
    const rechnungen = await pool.request().query(`
      SELECT TOP 5 
        kRechnung, cRechnungsnummer, dErstellt, fGesamtsumme, 
        cStatus, kKunde, kWaehrung
      FROM tRechnung 
      ORDER BY dErstellt DESC
    `)
    result.rechnungen = {
      count: rechnungen.recordset.length,
      columns: Object.keys(rechnungen.recordset[0] || {}),
      sample: rechnungen.recordset
    }

    // 2. Zahlungen
    const zahlungen = await pool.request().query(`
      SELECT TOP 5 * FROM tZahlung ORDER BY dZeit DESC
    `)
    result.zahlungen = {
      count: zahlungen.recordset.length,
      columns: Object.keys(zahlungen.recordset[0] || {}),
      sample: zahlungen.recordset.map(z => ({
        ...z,
        // Konvertiere Buffer zu String falls vorhanden
        dZeit: z.dZeit?.toISOString()
      }))
    }

    // 3. Zahlungsarten
    const zahlungsarten = await pool.request().query(`
      SELECT kZahlungsart, cName, cModulId, nSort
      FROM tZahlungsart
      ORDER BY nSort
    `)
    result.zahlungsarten = zahlungsarten.recordset

    // 4. Marketplace-Tabellen finden
    const marketplaceTables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%amazon%' 
        OR TABLE_NAME LIKE '%ebay%' 
        OR TABLE_NAME LIKE '%payment%'
        OR TABLE_NAME LIKE '%mollie%'
      ORDER BY TABLE_NAME
    `)
    result.marketplaceTables = marketplaceTables.recordset.map(t => t.TABLE_NAME)

    // 5. Lieferanten/EK-Tabellen
    const ekTables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%Lieferant%' 
        OR TABLE_NAME LIKE '%Kreditor%'
        OR TABLE_NAME LIKE '%Eingang%'
      ORDER BY TABLE_NAME
    `)
    result.ekTables = ekTables.recordset.map(t => t.TABLE_NAME)

    // 6. Rechnungspositionen
    const rechnungsPos = await pool.request().query(`
      SELECT TOP 3 * FROM tRechnungPosition ORDER BY kRechnungPosition DESC
    `)
    result.rechnungsPositionen = {
      columns: Object.keys(rechnungsPos.recordset[0] || {}),
      sample: rechnungsPos.recordset
    }

    return NextResponse.json({
      ok: true,
      data: result
    })
  } catch (error: any) {
    console.error('[FIBU Explore] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
