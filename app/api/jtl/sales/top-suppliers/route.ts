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
    
    // Lieferantenbestellungen Tabellen
    const purchaseOrderTable = 'dbo.tLieferantenBestellung'
    const posTable = 'dbo.tLieferantenBestellungPos'
    const supplierTable = 'dbo.tLieferant'

    // Prüfe verfügbare Felder für Datum
    const dateField = await pickFirstExisting(pool, purchaseOrderTable, ['dErstellt', 'dBestelldatum']) || 'dErstellt'
    
    // Status-Filter (optional) - Stornierte Bestellungen ausschließen
    const hasNStorno = await hasColumn(pool, purchaseOrderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (b.nStorno IS NULL OR b.nStorno = 0)' : ''

    // Positionsfelder für Mengen und Preise
    const qtyField = await pickFirstExisting(pool, posTable, ['fMenge', 'nMenge', 'fAnzahl']) || 'fMenge'
    const ekField = await pickFirstExisting(pool, posTable, ['fEKPreis', 'fEKNetto', 'fPreis']) || 'fEKPreis'
    
    // Netto-Summe berechnen (entweder direkt aus Spalte oder berechnet)
    const hasGesamtNetto = await hasColumn(pool, posTable, 'fGesamtNetto')
    let netExpr: string
    
    if (hasGesamtNetto) {
      netExpr = 'COALESCE(p.fGesamtNetto, 0)'
    } else {
      netExpr = `COALESCE(p.${ekField} * COALESCE(p.${qtyField}, 1), 0)`
    }

    // Foreign Key zu Header (kLieferantenBestellung in Pos-Tabelle)
    const fkField = 'kLieferantenBestellung'

    // Query: Aggregiere Bestellungen nach Lieferant
    const query = `
      SELECT 
        l.kLieferant,
        ISNULL(l.cFirma, 'Unbekannt') AS supplier_name,
        COUNT(DISTINCT b.kLieferantenBestellung) AS orders,
        SUM(${netExpr}) AS revenue
      FROM ${purchaseOrderTable} b
      INNER JOIN ${posTable} p ON b.kLieferantenBestellung = p.${fkField}
      INNER JOIN ${supplierTable} l ON b.kLieferant = l.kLieferant
      WHERE CAST(b.${dateField} AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
      GROUP BY l.kLieferant, l.cFirma
      ORDER BY revenue DESC
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    // Zusammenfassen der Lieferanten gemäß Vorgabe
    // User-Vorgabe: Zusammenfassung nach ähnlichen Namen
    // Klingspor AG + Klingspor AG Konfektion -> Klingspor AG
    // VSM Deutschland + VSM Deutschland Konfektion -> VSM Deutschland
    // Starcke GmbH & Co. KG + Starcke GmbH & Co. KG Konfektion -> Starcke GmbH & Co. KG
    // AWUKO ABRASIVES (alle Varianten) -> AWUKO ABRASIVES
    
    const supplierMap = new Map()
    
    const normalizeSupplierName = (name: string): { groupKey: string, display: string } => {
      const lower = name.toLowerCase()
      
      // Klingspor-Gruppe
      if (lower.includes('klingspor')) {
        return { groupKey: 'klingspor', display: 'Klingspor AG' }
      }
      // VSM-Gruppe
      if (lower.includes('vsm')) {
        return { groupKey: 'vsm', display: 'VSM Deutschland' }
      }
      // Starcke-Gruppe
      if (lower.includes('starcke')) {
        return { groupKey: 'starcke', display: 'Starcke GmbH & Co. KG' }
      }
      // AWUKO-Gruppe
      if (lower.includes('awuko')) {
        return { groupKey: 'awuko', display: 'AWUKO ABRASIVES' }
      }
      
      // Alle anderen: Original-Name verwenden
      return { groupKey: name, display: name }
    }

    // Aggregiere die Daten
    result.recordset.forEach(row => {
      const { groupKey, display } = normalizeSupplierName(row.supplier_name)
      
      if (!supplierMap.has(groupKey)) {
        supplierMap.set(groupKey, {
          supplier: display,
          orders: 0,
          revenue: 0
        })
      }
      
      const existing = supplierMap.get(groupKey)
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
