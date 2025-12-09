export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { hasColumn, pickFirstExisting } from '../../../lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/orders/kpi/shipping-split
 * Umsatz (Orders-Basis) mit/ohne Versandkosten
 * Unterstützt ?month=YYYY-MM oder ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Month oder from/to
    let from: string, to: string
    const month = searchParams.get('month')
    if (month) {
      const [y, m] = month.split('-').map(x => parseInt(x, 10))
      from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
      to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    } else {
      from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    }

    const pool = await getMssqlPool()

    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'

    // Storno-Filter
    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    // Filter: Only "Aufträge" (AU...), not "Angebote" (AN...)
    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    // Artikel-Filter
    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp
      ? 'op.nPosTyp = 1'
      : `op.kArtikel > 0 
         AND ISNULL(op.cName,'') NOT LIKE 'Versand%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Gutschein%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Rabatt%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Pfand%'`

    const shippingFilter = hasNPosTyp
      ? 'op.nPosTyp = 3'  // Typ 3 = Versand
      : `(op.kArtikel = 0 OR op.kArtikel IS NULL)`  // Keine Artikelnummer = Versand

    // Positionsfelder
    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'
    const grossField = await pickFirstExisting(pool, orderPosTable, ['fVKBrutto', 'fPreisBrutto']) || 'fVKBrutto'
    const mwstField = await pickFirstExisting(pool, orderPosTable, ['fMwSt', 'fMwst']) || 'fMwSt'

    // Robuste Total-Expr
    let netTotalExpr = `(op.${netField} * op.${qtyField})`
    let grossTotalExpr = `(op.${grossField} * op.${qtyField})`

    // Fallback wenn keine Brutto-Spalte
    if (!(await hasColumn(pool, orderPosTable, grossField))) {
      grossTotalExpr = `(${netTotalExpr} * (1 + op.${mwstField} / 100.0))`
    }

    const query = `
      WITH Articles AS (
        SELECT 
          o.kAuftrag,
          SUM(${netTotalExpr}) AS net_articles,
          SUM(${grossTotalExpr}) AS gross_articles
        FROM ${orderTable} o
        INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
          ${stornoFilter}
          ${orderTypeFilter}
          AND ${articleFilter}
        GROUP BY o.kAuftrag
      ),
      Shipping AS (
        SELECT 
          o.kAuftrag,
          SUM(${netTotalExpr}) AS net_shipping,
          SUM(${grossTotalExpr}) AS gross_shipping
        FROM ${orderTable} o
        INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
          ${stornoFilter}
          ${orderTypeFilter}
          AND ${shippingFilter}
        GROUP BY o.kAuftrag
      ),
      Combined AS (
        SELECT 
          o.kAuftrag,
          ISNULL(a.net_articles, 0) AS net_articles,
          ISNULL(a.gross_articles, 0) AS gross_articles,
          ISNULL(s.net_shipping, 0) AS net_shipping,
          ISNULL(s.gross_shipping, 0) AS gross_shipping
        FROM ${orderTable} o
        LEFT JOIN Articles a ON o.kAuftrag = a.kAuftrag
        LEFT JOIN Shipping s ON o.kAuftrag = s.kAuftrag
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
          ${stornoFilter}
          ${orderTypeFilter}
          AND (a.net_articles > 0 OR s.net_shipping > 0)
      )
      SELECT 
        COUNT(*) AS orders,
        SUM(net_articles) AS net_without_shipping,
        SUM(net_articles + net_shipping) AS net_with_shipping,
        SUM(gross_articles) AS gross_without_shipping,
        SUM(gross_articles + gross_shipping) AS gross_with_shipping
      FROM Combined
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const row = result.recordset[0] || {}

    return NextResponse.json({
      ok: true,
      period: { from, to },
      orders: row.orders || 0,
      net_without_shipping: parseFloat(row.net_without_shipping || 0).toFixed(2),
      net_with_shipping: parseFloat(row.net_with_shipping || 0).toFixed(2),
      gross_without_shipping: parseFloat(row.gross_without_shipping || 0).toFixed(2),
      gross_with_shipping: parseFloat(row.gross_with_shipping || 0).toFixed(2)
    })

  } catch (error: any) {
    console.error('[/api/jtl/orders/kpi/shipping-split] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
