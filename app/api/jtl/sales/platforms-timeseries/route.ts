export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/platforms-timeseries
 * Zeitreihen-Daten für Plattform-Umsätze
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const platforms = searchParams.get('platforms')?.split(',') || []

    if (platforms.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Plattformen ausgewählt'
      }, { status: 400 })
    }

    const pool = await getMssqlPool()
    
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const platformTable = 'dbo.tPlattform'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? 'op.nPosTyp = 1' : `op.kArtikel > 0`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const netExpr = `(op.${netField} * op.${qtyField})`

    // Berechne Zeitraum für Gruppierung
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    
    let groupByExpr: string
    let groupByLabel: string
    
    if (daysDiff <= 31) {
      groupByExpr = `CAST(o.dErstellt AS DATE)`
      groupByLabel = 'day'
    } else if (daysDiff <= 90) {
      groupByExpr = `DATEADD(week, DATEDIFF(week, 0, o.dErstellt), 0)`
      groupByLabel = 'week'
    } else {
      groupByExpr = `DATEADD(month, DATEDIFF(month, 0, o.dErstellt), 0)`
      groupByLabel = 'month'
    }

    // WHERE-Klausel für Plattformen
    const platformConditions = platforms.map((_, idx) => {
      return `LOWER(p.cName) LIKE '%' + LOWER(@platform${idx}) + '%'`
    }).join(' OR ')

    const query = `
      SELECT 
        ${groupByExpr} AS period,
        p.cName AS platform_name,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netExpr}) AS revenue
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN ${platformTable} p ON o.kPlattform = p.kPlattform
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
        AND p.kPlattform IS NOT NULL
        AND (${platformConditions})
      GROUP BY ${groupByExpr}, p.cName
      ORDER BY period ASC, platform_name ASC
    `

    const sqlRequest = pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
    
    platforms.forEach((name, idx) => {
      sqlRequest.input(`platform${idx}`, sql.NVarChar, name)
    })

    const result = await sqlRequest.query(query)

    const timeseries = result.recordset.map(row => ({
      period: row.period.toISOString().split('T')[0],
      platform: row.platform_name,
      orders: parseInt(row.orders || 0),
      revenue: parseFloat(row.revenue || 0).toFixed(2)
    }))

    return NextResponse.json({
      ok: true,
      period: { from, to },
      grouping: groupByLabel,
      timeseries
    })

  } catch (error: any) {
    console.error('[/api/jtl/sales/platforms-timeseries] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
