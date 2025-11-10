export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { hasColumn, pickFirstExisting } from '../../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/top-platforms
 * Top 5 Plattformen nach Umsatz und Marge
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

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp 
      ? '(op.nPosTyp = 1 OR op.nPosTyp = 3)'  // Artikel (1) UND Versand (3)
      : `1=1`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'
    const costField = await pickFirstExisting(pool, orderPosTable, ['fEKNetto', 'fEK']) || 'fEKNetto'

    // Check if kPlattform exists
    const hasKPlattform = await hasColumn(pool, orderTable, 'kPlattform')
    
    if (!hasKPlattform) {
      return NextResponse.json({
        ok: false,
        error: 'kPlattform column not found in tAuftrag'
      }, { status: 404 })
    }

    const netExpr = `(op.${netField} * op.${qtyField})`
    const costExpr = `(op.${costField} * op.${qtyField})`

    const query = `
      SELECT TOP ${limit}
        ISNULL(p.cName, CAST(o.kPlattform AS VARCHAR(50))) AS platform,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netExpr}) AS revenue,
        SUM(${costExpr}) AS cost,
        SUM(${netExpr}) - SUM(${costExpr}) AS margin
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN dbo.tPlattform p ON o.kPlattform = p.kPlattform
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
      GROUP BY o.kPlattform, p.cName
      ORDER BY revenue DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const platforms = result.recordset.map(row => ({
      platform: row.platform || 'Unbekannt',
      orders: row.orders || 0,
      revenue: parseFloat(row.revenue || 0).toFixed(2),
      cost: parseFloat(row.cost || 0).toFixed(2),
      margin: parseFloat(row.margin || 0).toFixed(2)
    }))

    return NextResponse.json({
      ok: true,
      period: { from, to },
      platforms
    })

  } catch (error: any) {
    console.error('[/api/jtl/sales/top-platforms] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
