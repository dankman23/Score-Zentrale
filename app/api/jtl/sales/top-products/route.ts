export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const limit = parseInt(searchParams.get('limit') || '20')
    const hersteller = searchParams.get('hersteller') || null
    const warengruppe = searchParams.get('warengruppe') || null

    const pool = await getMssqlPool()
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const articleTable = 'dbo.tArtikel'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? '(op.nPosTyp = 1 OR op.nPosTyp = 3)' : `1=1`  // Alle Positionen einbeziehen

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const netTotalExpr = `(op.${netField} * op.${qtyField})`

    // Use name from order position (cName field in tAuftragPosition)
    const posNameField = await pickFirstExisting(pool, orderPosTable, ['cName', 'cArtikelName', 'cBezeichnung']) || null
    
    // Filter: Only count "Aufträge" (AU...), not "Angebote" (AN...)
    // Use cAuftragsNr to distinguish (AU = Auftrag, AN = Angebot)
    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''
    
    // Zusätzliche Filter für Hersteller und Warengruppe
    let additionalFilters = ''
    let needsHerstellerJoin = false
    
    if (hersteller) {
      // Check if we need to filter via tHersteller table
      const hasKHersteller = await hasColumn(pool, articleTable, 'kHersteller')
      if (hasKHersteller) {
        needsHerstellerJoin = true
        additionalFilters += ' AND h.cName = @hersteller'
      }
    }
    if (warengruppe) {
      // Warengruppe könnte in verschiedenen Feldern sein
      const hasWarengruppe = await hasColumn(pool, articleTable, 'cWarengruppe')
      if (hasWarengruppe) {
        additionalFilters += ' AND a.cWarengruppe = @warengruppe'
      }
    }
    
    // Check if we need to join with tHersteller table
    const herstellerTable = 'dbo.tHersteller'
    const hasKHersteller = await hasColumn(pool, articleTable, 'kHersteller')
    const hasTHersteller = hasKHersteller ? await hasColumn(pool, herstellerTable, 'kHersteller') : false
    
    // Always join if Hersteller table exists OR if we need to filter by hersteller
    const herstellerJoin = (hasTHersteller || needsHerstellerJoin)
      ? `LEFT JOIN ${herstellerTable} h ON a.kHersteller = h.kHersteller`
      : ''
    
    const herstellerSelect = (hasTHersteller || needsHerstellerJoin)
      ? 'MAX(h.cName)'
      : 'NULL'
    
    const query = `
      SELECT TOP ${limit}
        a.cArtNr AS sku,
        ${posNameField ? `MAX(op.${posNameField})` : `a.cArtNr`} AS name,
        ${herstellerSelect} AS hersteller,
        SUM(op.${qtyField}) AS quantity,
        SUM(${netTotalExpr}) AS revenue
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN ${articleTable} a ON op.kArtikel = a.kArtikel
      ${herstellerJoin}
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND ${articleFilter}
        ${orderTypeFilter}
        ${additionalFilters}
      GROUP BY a.cArtNr
      ORDER BY SUM(${netTotalExpr}) DESC
    `

    const requestObj = pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
    
    if (hersteller) {
      requestObj.input('hersteller', sql.NVarChar, hersteller)
    }
    if (warengruppe) {
      requestObj.input('warengruppe', sql.NVarChar, warengruppe)
    }
    
    const result = await requestObj.query(query)

    const rows = (result.recordset || []).map(r => ({
      sku: r.sku || 'N/A',
      name: r.name || 'Unbekannt',
      hersteller: r.hersteller || '-',
      quantity: parseFloat(r.quantity || 0).toFixed(2),
      revenue: parseFloat(r.revenue || 0).toFixed(2)
    }))

    return NextResponse.json({ ok: true, period: { from, to }, rows })
  } catch (error: any) {
    console.error('[/api/jtl/sales/top-products] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
