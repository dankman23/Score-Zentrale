export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/categories-timeseries
 * Zeitreihen-Daten für Warengruppen-Umsätze
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const categories = searchParams.get('categories')?.split(',') || []

    if (categories.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Warengruppen ausgewählt'
      }, { status: 400 })
    }

    const pool = await getMssqlPool()
    
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const articleTable = 'dbo.tArtikel'
    const categoryTable = 'dbo.tWarengruppe'

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

    // WHERE-Klausel für Warengruppen
    const categoryConditions = categories.map((_, idx) => {
      return `LOWER(w.cName) LIKE '%' + LOWER(@category${idx}) + '%'`
    }).join(' OR ')

    const query = `
      SELECT 
        ${groupByExpr} AS period,
        w.cName AS category_name,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netExpr}) AS revenue
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN ${articleTable} a ON op.kArtikel = a.kArtikel
      LEFT JOIN ${categoryTable} w ON a.kWarengruppe = w.kWarengruppe
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
        AND w.kWarengruppe IS NOT NULL
        AND (${categoryConditions})
      GROUP BY ${groupByExpr}, w.cName
      ORDER BY period ASC, category_name ASC
    `

    const sqlRequest = pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
    
    categories.forEach((name, idx) => {
      sqlRequest.input(`category${idx}`, sql.NVarChar, name)
    })

    const result = await sqlRequest.query(query)

    const timeseries = result.recordset.map(row => ({
      period: row.period.toISOString().split('T')[0],
      category: row.category_name,
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
    console.error('[/api/jtl/sales/categories-timeseries] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
