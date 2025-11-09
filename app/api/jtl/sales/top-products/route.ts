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
    const limit = parseInt(searchParams.get('limit') || '20')

    const pool = await getMssqlPool()
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const articleTable = 'dbo.tArtikel'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? 'op.nPosTyp = 1' : `op.kArtikel > 0`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const netTotalExpr = `(op.${netField} * op.${qtyField})`

    // Check which name column exists in article table
    const nameField = await pickFirstExisting(pool, articleTable, ['cName_DE', 'cName', 'cBeschreibung', 'cKurzBeschreibung']) || 'cArtNr'
    
    const query = `
      SELECT TOP ${limit}
        a.cArtNr AS sku,
        a.${nameField} AS name,
        SUM(op.${qtyField}) AS quantity,
        SUM(${netTotalExpr}) AS revenue
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN ${articleTable} a ON op.kArtikel = a.kArtikel
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND ${articleFilter}
      GROUP BY a.cArtNr, a.${nameField}
      ORDER BY SUM(${netTotalExpr}) DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const rows = (result.recordset || []).map(r => ({
      sku: r.sku || 'N/A',
      name: r.name || 'Unbekannt',
      quantity: parseFloat(r.quantity || 0).toFixed(2),
      revenue: parseFloat(r.revenue || 0).toFixed(2)
    }))

    return NextResponse.json({ ok: true, period: { from, to }, rows })
  } catch (error: any) {
    console.error('[/api/jtl/sales/top-products] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
