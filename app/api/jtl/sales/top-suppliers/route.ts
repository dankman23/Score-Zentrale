export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/top-suppliers
 * Top Lieferanten nach Bestellsumme (Umsatz)
 * 
 * Lieferanten-Zusammenfassungen:
 * - 11 + 15: AWUKO ABRASIVES
 * - 13 + 22: Starcke GmbH
 * - 4 + 8: Klingspor AG
 * - 9 + 10: VSM Deutschland
 */
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
    const articleSupplierTable = 'dbo.tArtikelLieferant'
    const supplierTable = 'dbo.tLieferant'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp 
      ? 'op.nPosTyp = 1'  // Nur Artikel (keine Versandkosten)
      : `op.kArtikel > 0`

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const netExpr = `(op.${netField} * op.${qtyField})`

    // Query mit Lieferanten-Gruppierung
    // Wir holen die kLieferant und den Namen aus tLieferant
    const query = `
      SELECT 
        l.kLieferant,
        ISNULL(l.cName, 'Unbekannt') AS supplier_name,
        COUNT(DISTINCT o.kAuftrag) AS orders,
        SUM(${netExpr}) AS revenue
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN ${articleTable} a ON op.kArtikel = a.kArtikel
      LEFT JOIN ${articleSupplierTable} al ON a.kArtikel = al.kArtikel
      LEFT JOIN ${supplierTable} l ON al.kLieferant = l.kLieferant
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${articleFilter}
        AND l.kLieferant IS NOT NULL
      GROUP BY l.kLieferant, l.cName
      ORDER BY revenue DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    // Zusammenfassen der Lieferanten gemäß Vorgabe
    const supplierMap = new Map()
    
    // Mapping: kLieferant -> Gruppe
    const groupMapping: { [key: number]: string } = {
      11: 'AWUKO ABRASIVES',
      15: 'AWUKO ABRASIVES',
      13: 'Starcke GmbH',
      22: 'Starcke GmbH',
      4: 'Klingspor AG',
      8: 'Klingspor AG',
      9: 'VSM Deutschland',
      10: 'VSM Deutschland'
    }

    // Aggregiere die Daten
    result.recordset.forEach(row => {
      const kLieferant = row.kLieferant
      const groupName = groupMapping[kLieferant] || row.supplier_name
      
      if (!supplierMap.has(groupName)) {
        supplierMap.set(groupName, {
          supplier: groupName,
          orders: 0,
          revenue: 0
        })
      }
      
      const existing = supplierMap.get(groupName)
      existing.orders += parseInt(row.orders || 0)
      existing.revenue += parseFloat(row.revenue || 0)
    })

    // Konvertiere Map zu Array und sortiere nach Umsatz
    const suppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(s => ({
        supplier: s.supplier,
        orders: s.orders,
        revenue: s.revenue.toFixed(2)
      }))

    return NextResponse.json({
      ok: true,
      period: { from, to },
      suppliers
    })

  } catch (error: any) {
    console.error('[/api/jtl/sales/top-suppliers] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
