export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { hasColumn, pickFirstExisting } from '../../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/orders/timeseries
 * Zeitreihe für Orders: Umsatz und Anzahl pro Tag/Monat/Jahr
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const userGrain = searchParams.get('grain') || 'auto'

    // Auto-Grain
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000
    const grain = userGrain !== 'auto' ? userGrain : (days <= 60 ? 'day' : (days <= 548 ? 'month' : 'year'))

    const pool = await getMssqlPool()

    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'

    // Storno-Filter
    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    // Artikel-Filter
    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp
      ? 'op.nPosTyp = 1'
      : `op.kArtikel > 0 
         AND ISNULL(op.cName,'') NOT LIKE 'Versand%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Gutschein%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Rabatt%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Pfand%'`

    // Positionsfelder
    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'
    const grossField = await pickFirstExisting(pool, orderPosTable, ['fVKBrutto', 'fPreisBrutto']) || 'fVKBrutto'
    const mwstField = await pickFirstExisting(pool, orderPosTable, ['fMwSt', 'fMwst']) || 'fMwSt'

    let netTotalExpr = `(op.${netField} * op.${qtyField})`
    let grossTotalExpr = `(op.${grossField} * op.${qtyField})`

    if (!(await hasColumn(pool, orderPosTable, grossField))) {
      grossTotalExpr = `(${netTotalExpr} * (1 + op.${mwstField} / 100.0))`
    }

    // Date grouping
    let dateGroup: string
    if (grain === 'day') {
      dateGroup = "CAST(o.dErstellt AS DATE)"
    } else if (grain === 'month') {
      dateGroup = "DATEFROMPARTS(YEAR(o.dErstellt), MONTH(o.dErstellt), 1)"
    } else {
      dateGroup = "DATEFROMPARTS(YEAR(o.dErstellt), 1, 1)"
    }

    const query = `
      SELECT 
        ${dateGroup} AS date,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netTotalExpr}) AS net,
        SUM(${grossTotalExpr}) AS gross
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        AND o.cStatus != 'storno'
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
      net: parseFloat(r.net || 0).toFixed(2),
      gross: parseFloat(r.gross || 0).toFixed(2)
    }))

    return NextResponse.json({
      ok: true,
      grain,
      period: { from, to },
      rows
    })

  } catch (error: any) {
    console.error('[/api/jtl/orders/timeseries] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
