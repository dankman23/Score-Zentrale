export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { firstExistingTable, hasColumn, pickFirstExisting } from '../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/purchase/orders
 * Einkaufsbestellungen (Beschaffung): Bestellwert summieren
 * Alle Status, da wir Bestellwert zählen (nicht nur gebuchte Rechnungen)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const statusParam = searchParams.get('status') || 'alle' // inBearbeitung|teilgeliefert|abgeschlossen|alle

    const pool = await getMssqlPool()

    // Tabellenkandidaten für Bestellungen (Beschaffung)
    const headerCandidates = [
      'Beschaffung.tBestellung',
      'dbo.tBestellung'
    ]
    const posCandidates = [
      'Beschaffung.tBestellungPos',
      'dbo.tBestellungPos'
    ]

    const headerTable = await firstExistingTable(pool, headerCandidates)
    const posTable = await firstExistingTable(pool, posCandidates)

    if (!headerTable || !posTable) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Bestellungstabellen gefunden (Beschaffung.tBestellung oder dbo.tBestellung)'
      }, { status: 404 })
    }

    // Datumsspalten-Priorität: dErstellt → dBestelldatum
    const dateField = await pickFirstExisting(pool, headerTable, ['dErstellt', 'dBestelldatum']) || 'dErstellt'

    // Status-Filter (optional)
    const hasNStatus = await hasColumn(pool, headerTable, 'nStatus')
    let statusFilter = ''
    if (statusParam !== 'alle' && hasNStatus) {
      // Mapping: inBearbeitung=1, teilgeliefert=2, abgeschlossen=3 (beispielhaft, kann je nach JTL variieren)
      const statusMap: Record<string, number> = {
        'inBearbeitung': 1,
        'teilgeliefert': 2,
        'abgeschlossen': 3
      }
      const statusValue = statusMap[statusParam]
      if (statusValue) {
        statusFilter = `AND b.nStatus = ${statusValue}`
      }
    }

    // Positionsfelder robust ermitteln
    const qtyField = await pickFirstExisting(pool, posTable, ['fMenge', 'nMenge']) || 'fMenge'
    const ekField = await pickFirstExisting(pool, posTable, ['fEKPreis', 'fEKNetto']) || 'fEKPreis'
    const mwstField = await pickFirstExisting(pool, posTable, ['fMwSt', 'fMwst', 'fMwStProzent']) || 'fMwSt'
    
    // Netto- und Brutto-Summen - robuste Ermittlung
    const hasGesamtNetto = await hasColumn(pool, posTable, 'fGesamtNetto')
    const hasGesamtBrutto = await hasColumn(pool, posTable, 'fGesamtBrutto')
    
    let netExpr: string
    let grossExpr: string
    
    if (hasGesamtNetto) {
      netExpr = 'COALESCE(p.fGesamtNetto, 0)'
    } else {
      netExpr = `COALESCE(p.${ekField} * COALESCE(p.${qtyField}, 1), 0)`
    }
    
    if (hasGesamtBrutto) {
      grossExpr = 'COALESCE(p.fGesamtBrutto, 0)'
    } else {
      grossExpr = `(${netExpr}) * (1 + COALESCE(p.${mwstField}, 19) / 100.0)`
    }

    // Foreign Key zu Header
    const fkField = await pickFirstExisting(pool, posTable, ['kBestellung', 'tBestellung_kBestellung']) || 'kBestellung'

    const query = `
      WITH heads AS (
        SELECT
          b.kBestellung,
          COALESCE(CAST(b.${dateField} AS date), CAST(GETDATE() AS date)) AS d
        FROM ${headerTable} b
        WHERE COALESCE(CAST(b.${dateField} AS date), CAST(GETDATE() AS date)) >= @from 
          AND COALESCE(CAST(b.${dateField} AS date), CAST(GETDATE() AS date)) < DATEADD(day, 1, @to)
          ${statusFilter}
      ),
      pos AS (
        SELECT
          p.${fkField} AS kBestellung,
          ${netExpr} AS netTotal,
          ${grossExpr} AS grossTotal
        FROM ${posTable} p
      )
      SELECT
        COUNT(DISTINCT h.kBestellung) AS orders,
        CAST(SUM(n.netTotal) AS float) AS net,
        CAST(SUM(n.grossTotal) AS float) AS gross
      FROM heads h
      JOIN pos n ON n.kBestellung = h.kBestellung
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const row = result.recordset[0] || {}

    return NextResponse.json({
      ok: true,
      period: { from, to },
      orders: row.orders || 0,
      net: parseFloat(row.net || 0).toFixed(2),
      gross: parseFloat(row.gross || 0).toFixed(2),
      debug: {
        headerTable,
        posTable,
        dateFieldUsed: dateField,
        source: 'purchase_orders',
        statusFilter: statusParam
      }
    })

  } catch (error: any) {
    console.error('[/api/jtl/purchase/orders] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
