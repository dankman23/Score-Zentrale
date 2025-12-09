export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/../lib/sql/utils'
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

    // Try to get platform names from tPlattform table
    let platformNameQuery = ''
    const hasTPlattform = await hasColumn(pool, 'dbo.tPlattform', 'kPlattform')
    
    if (hasTPlattform) {
      platformNameQuery = 'LEFT JOIN dbo.tPlattform p ON o.kPlattform = p.kPlattform'
    }
    
    const platformSelect = hasTPlattform 
      ? 'ISNULL(p.cName, CAST(o.kPlattform AS VARCHAR(50)))'
      : 'CAST(o.kPlattform AS VARCHAR(50))'

    const query = `
      SELECT TOP ${limit}
        ${platformSelect} AS platform,
        o.kPlattform AS platform_id,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netExpr}) AS revenue,
        SUM(${costExpr}) AS cost,
        SUM(${netExpr}) - SUM(${costExpr}) AS margin
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      ${platformNameQuery}
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
      GROUP BY o.kPlattform${hasTPlattform ? ', p.cName' : ''}
      ORDER BY revenue DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const platforms = result.recordset.map(row => {
      const revenue = parseFloat(row.revenue || 0)
      const margin = parseFloat(row.margin || 0)
      const marginPct = revenue > 0 ? ((margin / revenue) * 100).toFixed(1) : '0.0'
      
      return {
        platform: row.platform || 'Unbekannt',
        orders: row.orders || 0,
        revenue: revenue.toFixed(2),
        cost: parseFloat(row.cost || 0).toFixed(2),
        margin: margin.toFixed(2),
        marginPct
      }
    })

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
