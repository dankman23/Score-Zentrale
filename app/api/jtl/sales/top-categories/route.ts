export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { hasColumn, pickFirstExisting } from '../../../../lib/sql/utils'
import sql from 'mssql'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const limit = parseInt(searchParams.get('limit') || '20')

    const pool = await getMssqlPool()
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const articleTable = 'dbo.tArtikel'
    const warenGruppeTable = 'dbo.tWarengruppe'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    // Filter: Only "Aufträge" (AU...), not "Angebote" (AN...)
    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? '(op.nPosTyp = 1 OR op.nPosTyp = 3)' : `1=1`  // Alle Positionen einbeziehen

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const netTotalExpr = `(op.${netField} * op.${qtyField})`

    const query = `
      SELECT TOP ${limit}
        ISNULL(wg.cName, 'Ohne Warengruppe') AS category,
        COUNT(DISTINCT op.kAuftragPosition) AS items,
        SUM(${netTotalExpr}) AS revenue
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN ${articleTable} a ON op.kArtikel = a.kArtikel
      LEFT JOIN ${warenGruppeTable} wg ON a.kWarengruppe = wg.kWarengruppe
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
      GROUP BY wg.cName
      ORDER BY SUM(${netTotalExpr}) DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const rows = (result.recordset || []).map(r => ({
      category: r.category || 'Unbekannt',
      items: r.items || 0,
      revenue: parseFloat(r.revenue || 0).toFixed(2)
    }))

    return NextResponse.json({ ok: true, period: { from, to }, rows })
  } catch (error: any) {
    console.error('[/api/jtl/sales/top-categories] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
