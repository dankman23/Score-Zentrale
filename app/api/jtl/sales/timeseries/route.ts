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

    const pool = await getMssqlPool()
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? 'op.nPosTyp = 1' : `op.kArtikel > 0`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const netTotalExpr = `(op.${netField} * op.${qtyField})`

    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000
    const dateGroup = days <= 60 ? "CAST(o.dErstellt AS DATE)" : "DATEFROMPARTS(YEAR(o.dErstellt), MONTH(o.dErstellt), 1)"

    const query = `
      SELECT 
        ${dateGroup} AS date,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netTotalExpr}) AS net
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND ${articleFilter}
      GROUP BY ${dateGroup}
      ORDER BY date
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const rows = (result.recordset || []).map(r => ({
      date: r.date.toISOString().slice(0, 10),
      orders: r.orders || 0,
      net: parseFloat(r.net || 0).toFixed(2)
    }))

    return NextResponse.json({ ok: true, period: { from, to }, rows })
  } catch (error: any) {
    console.error('[/api/jtl/sales/timeseries] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
