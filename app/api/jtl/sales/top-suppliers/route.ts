export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { firstExistingTable, hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/top-suppliers
 * Top Lieferanten nach Einkaufsbestellsumme (Purchase Orders)
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
    
    // Beschaffung (Purchase Orders) Tabellen - probiere beide Varianten
    const headerCandidates = [
      'Beschaffung.tBestellung',
      'dbo.tBestellung'
    ]
    const posCandidates = [
      'Beschaffung.tBestellungPos',
      'dbo.tBestellungPos'
    ]

    const purchaseOrderTable = await firstExistingTable(pool, headerCandidates)
    const posTable = await firstExistingTable(pool, posCandidates)
    const supplierTable = 'dbo.tLieferant'

    if (!purchaseOrderTable || !posTable) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Bestellungstabellen gefunden'
      }, { status: 404 })
    }

    // Prüfe verfügbare Felder
    const dateField = await pickFirstExisting(pool, purchaseOrderTable, ['dErstellt', 'dBestelldatum']) || 'dErstellt'
    
    const hasNStorno = await hasColumn(pool, purchaseOrderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (b.nStorno IS NULL OR b.nStorno = 0)' : ''

    // Positionsfelder
    const qtyField = await pickFirstExisting(pool, posTable, ['fMenge', 'nMenge']) || 'fMenge'
    const ekField = await pickFirstExisting(pool, posTable, ['fEKPreis', 'fEKNetto']) || 'fEKPreis'
    
    // Netto-Summe berechnen
    const hasGesamtNetto = await hasColumn(pool, posTable, 'fGesamtNetto')
    let netExpr: string
    
    if (hasGesamtNetto) {
      netExpr = 'COALESCE(p.fGesamtNetto, 0)'
    } else {
      netExpr = `COALESCE(p.${ekField} * COALESCE(p.${qtyField}, 1), 0)`
    }

    // Foreign Key zu Header
    const fkField = await pickFirstExisting(pool, posTable, ['kBestellung', 'tBestellung_kBestellung']) || 'kBestellung'

    // Query: Aggregiere Bestellungen nach Lieferant
    const query = `
      SELECT 
        l.kLieferant,
        ISNULL(l.cName, 'Unbekannt') AS supplier_name,
        COUNT(DISTINCT b.kBestellung) AS orders,
        SUM(${netExpr}) AS revenue
      FROM ${purchaseOrderTable} b
      INNER JOIN ${posTable} p ON b.kBestellung = p.${fkField}
      INNER JOIN ${supplierTable} l ON b.kLieferant = l.kLieferant
      WHERE CAST(b.${dateField} AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
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
