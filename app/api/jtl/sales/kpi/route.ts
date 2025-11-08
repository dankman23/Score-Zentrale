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
    const articleFilter = hasNPosTyp
      ? 'op.nPosTyp = 1'
      : `op.kArtikel > 0 AND ISNULL(op.cName,'') NOT LIKE 'Versand%'`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'
    const grossField = await pickFirstExisting(pool, orderPosTable, ['fVKBrutto', 'fPreisBrutto']) || 'fVKBrutto'

    const netTotalExpr = `(op.${netField} * op.${qtyField})`
    const grossTotalExpr = `(op.${grossField} * op.${qtyField})`

    const query = `
      SELECT 
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netTotalExpr}) AS net,
        SUM(${grossTotalExpr}) AS gross
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND ${articleFilter}
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const row = result.recordset?.[0] || {}

    return NextResponse.json({
      ok: true,
      period: { from, to },
      orders: row.orders || 0,
      net: parseFloat(row.net || 0).toFixed(2),
      gross: parseFloat(row.gross || 0).toFixed(2)
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/kpi] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
