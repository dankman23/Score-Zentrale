export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { hasColumn, pickFirstExisting } from '../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/orders/diag/day?date=YYYY-MM-DD
 * Diagnostics für einen bestimmten Tag: Liste aller Orders mit Details
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

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

    // Platform detection (simplified, keine kPlattform/kShop falls nicht vorhanden)
    const hasKPlattform = await hasColumn(pool, orderTable, 'kPlattform')
    const platformExpr = hasKPlattform 
      ? "CASE WHEN o.kPlattform IS NOT NULL THEN CONCAT('Plattform ', o.kPlattform) ELSE 'Direktvertrieb' END"
      : "'Direktvertrieb'"

    const query = `
      WITH OrderTotals AS (
        SELECT 
          o.kAuftrag,
          o.cAuftragsNr,
          o.dErstellt,
          ${platformExpr} AS platform,
          SUM(${netTotalExpr}) AS net,
          SUM(${grossTotalExpr}) AS gross
        FROM ${orderTable} o
        INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
        WHERE CAST(o.dErstellt AS DATE) = @date
          ${stornoFilter}
          AND ${articleFilter}
        GROUP BY o.kAuftrag, o.cAuftragsNr, o.dErstellt, o.kPlattform
      )
      SELECT 
        kAuftrag AS orderId,
        cAuftragsNr AS orderNumber,
        dErstellt AS created,
        platform,
        net,
        gross
      FROM OrderTotals
      ORDER BY dErstellt
    `

    const result = await pool.request()
      .input('date', sql.Date, date)
      .query(query)

    const rows = (result.recordset || []).map(r => ({
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      created: r.created.toISOString(),
      platform: r.platform,
      net: parseFloat(r.net || 0).toFixed(2),
      gross: parseFloat(r.gross || 0).toFixed(2)
    }))

    const totals = {
      orders: rows.length,
      net: rows.reduce((sum, r) => sum + parseFloat(r.net), 0).toFixed(2),
      gross: rows.reduce((sum, r) => sum + parseFloat(r.gross), 0).toFixed(2)
    }

    return NextResponse.json({
      ok: true,
      date,
      totals,
      rows
    })

  } catch (error: any) {
    console.error('[/api/jtl/orders/diag/day] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
