export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { hasColumn, pickFirstExisting, firstExistingTable } from '../../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/by-platform
 * Umsatz nach Plattform aggregieren
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)

    const pool = await getMssqlPool()
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'

    // Check if kPlattform exists in tAuftrag
    const hasKPlattform = await hasColumn(pool, orderTable, 'kPlattform')
    
    if (!hasKPlattform) {
      return NextResponse.json({
        ok: false,
        error: 'kPlattform column not found in tAuftrag'
      }, { status: 404 })
    }

    // Check available fields
    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? 'op.nPosTyp = 1' : `op.kArtikel > 0`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const netTotalExpr = `(op.${netField} * op.${qtyField})`

    // Use kPlattform from tAuftrag table directly
    const query = `
      SELECT 
        ISNULL(CAST(o.kPlattform AS VARCHAR(50)), 'Unbekannt') AS platform,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netTotalExpr}) AS revenue_net
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND ${articleFilter}
      GROUP BY o.kPlattform
      ORDER BY SUM(${netTotalExpr}) DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const rows = (result.recordset || []).map(r => ({
      platform: r.platform || 'Unbekannt',
      orders: r.orders || 0,
      revenue_net: parseFloat(r.revenue_net || 0).toFixed(2)
    }))

    return NextResponse.json({
      ok: true,
      period: { from, to },
      rows
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/by-platform] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
