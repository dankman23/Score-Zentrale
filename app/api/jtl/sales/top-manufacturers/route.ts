export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../../lib/db/mssql'
import { hasColumn, pickFirstExisting } from '../../../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/top-manufacturers
 * Top 5 Hersteller nach Umsatz und Marge
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const limit = parseInt(searchParams.get('limit') || '5')

    const pool = await getMssqlPool()
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const articleTable = 'dbo.tArtikel'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp 
      ? 'op.nPosTyp = 1'  // Nur Artikel (keine Versandkosten für Hersteller)
      : `op.kArtikel > 0`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'
    const costField = await pickFirstExisting(pool, orderPosTable, ['fEKNetto', 'fEK']) || 'fEKNetto'

    // Hersteller-Feld
    const manufacturerField = await pickFirstExisting(pool, articleTable, ['cHersteller', 'cMarke']) || 'cHersteller'

    const netExpr = `(op.${netField} * op.${qtyField})`
    const costExpr = `(op.${costField} * op.${qtyField})`

    const query = `
      SELECT TOP ${limit}
        ISNULL(a.${manufacturerField}, 'Unbekannt') AS manufacturer,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netExpr}) AS revenue,
        SUM(${costExpr}) AS cost,
        SUM(${netExpr}) - SUM(${costExpr}) AS margin
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN ${articleTable} a ON op.kArtikel = a.kArtikel
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
      GROUP BY a.${manufacturerField}
      ORDER BY revenue DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const manufacturers = result.recordset.map(row => ({
      manufacturer: row.manufacturer || 'Unbekannt',
      orders: row.orders || 0,
      revenue: parseFloat(row.revenue || 0).toFixed(2),
      cost: parseFloat(row.cost || 0).toFixed(2),
      margin: parseFloat(row.margin || 0).toFixed(2)
    }))

    return NextResponse.json({
      ok: true,
      period: { from, to },
      manufacturers
    })

  } catch (error: any) {
    console.error('[/api/jtl/sales/top-manufacturers] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
