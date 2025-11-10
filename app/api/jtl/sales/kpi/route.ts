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

    // Filter: Only "Aufträge" (AU...), not "Angebote" (AN...)
    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp
      ? '(op.nPosTyp = 1 OR op.nPosTyp = 3)'  // Artikel (1) UND Versand (3)
      : `1=1`  // Alle Positionen einbeziehen

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'
    const costField = await pickFirstExisting(pool, orderPosTable, ['fEKNetto', 'fEK']) || 'fEKNetto'
    
    // MwSt-Satz Feld für Brutto-Berechnung
    const taxField = await pickFirstExisting(pool, orderPosTable, ['fMwSt', 'fMwStSatz', 'fSteuersatz']) || null
    
    // Berechne Umsatz, Kosten und Marge
    const netTotalExpr = `(op.${netField} * op.${qtyField})`
    const grossTotalExpr = taxField 
      ? `(op.${netField} * op.${qtyField} * (1 + op.${taxField}/100))` 
      : `(op.${netField} * op.${qtyField} * 1.19)`  // Fallback: 19% MwSt
    const costTotalExpr = `(op.${costField} * op.${qtyField})`

    const query = `
      SELECT 
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netTotalExpr}) AS net,
        SUM(${grossTotalExpr}) AS gross,
        SUM(${costTotalExpr}) AS cost
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const row = result.recordset?.[0] || {}
    
    const net = parseFloat(row.net || 0)
    const cost = parseFloat(row.cost || 0)
    const margin = net - cost

    return NextResponse.json({
      ok: true,
      period: { from, to },
      orders: row.orders || 0,
      net: net.toFixed(2),
      gross: parseFloat(row.gross || 0).toFixed(2),
      cost: cost.toFixed(2),
      margin: margin.toFixed(2)
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/kpi] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
