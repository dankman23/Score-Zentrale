export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/suppliers-timeseries
 * Zeitreihen-Daten für Lieferanten-Bestellungen
 * Gruppierung nach Tagen, Wochen oder Monaten
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const supplierNames = searchParams.get('suppliers')?.split(',') || []

    if (supplierNames.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Lieferanten ausgewählt'
      }, { status: 400 })
    }

    const pool = await getMssqlPool()
    
    // Tabellen
    const purchaseOrderTable = 'dbo.tLieferantenBestellung'
    const posTable = 'dbo.tLieferantenBestellungPos'
    const supplierTable = 'dbo.tLieferant'

    // Prüfe verfügbare Felder
    const dateField = await pickFirstExisting(pool, purchaseOrderTable, ['dErstellt', 'dBestelldatum']) || 'dErstellt'
    
    const hasNStorno = await hasColumn(pool, purchaseOrderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (b.nStorno IS NULL OR b.nStorno = 0)' : ''

    // Positionsfelder
    const qtyField = await pickFirstExisting(pool, posTable, ['fMenge', 'nMenge', 'fAnzahl']) || 'fMenge'
    const ekField = await pickFirstExisting(pool, posTable, ['fEKPreis', 'fEKNetto', 'fPreis']) || 'fEKPreis'
    
    const hasGesamtNetto = await hasColumn(pool, posTable, 'fGesamtNetto')
    let netExpr: string
    
    if (hasGesamtNetto) {
      netExpr = 'COALESCE(p.fGesamtNetto, 0)'
    } else {
      netExpr = `COALESCE(p.${ekField} * COALESCE(p.${qtyField}, 1), 0)`
    }

    // Berechne Zeitraum-Differenz für intelligente Gruppierung
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    
    let groupByExpr: string
    let groupByLabel: string
    
    if (daysDiff <= 31) {
      // Bis zu 31 Tage: Gruppierung nach Tag
      groupByExpr = `CAST(b.${dateField} AS DATE)`
      groupByLabel = 'day'
    } else if (daysDiff <= 90) {
      // Bis zu 90 Tage: Gruppierung nach Woche
      groupByExpr = `DATEADD(week, DATEDIFF(week, 0, b.${dateField}), 0)`
      groupByLabel = 'week'
    } else {
      // Mehr als 90 Tage: Gruppierung nach Monat
      groupByExpr = `DATEADD(month, DATEDIFF(month, 0, b.${dateField}), 0)`
      groupByLabel = 'month'
    }

    // WHERE-Klausel für Lieferanten-Namen (mit Normalisierung)
    const supplierConditions = supplierNames.map((_, idx) => {
      return `(
        LOWER(l.cFirma) LIKE '%' + LOWER(@supplier${idx}) + '%'
      )`
    }).join(' OR ')

    const query = `
      SELECT 
        ${groupByExpr} AS period,
        l.cFirma AS supplier_name,
        COUNT(DISTINCT b.kLieferantenBestellung) AS orders,
        SUM(${netExpr}) AS revenue
      FROM ${purchaseOrderTable} b
      INNER JOIN ${posTable} p ON b.kLieferantenBestellung = p.kLieferantenBestellung
      INNER JOIN ${supplierTable} l ON b.kLieferant = l.kLieferant
      WHERE CAST(b.${dateField} AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND (${supplierConditions})
      GROUP BY ${groupByExpr}, l.cFirma
      ORDER BY period ASC, supplier_name ASC
    `

    const sqlRequest = pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
    
    // Füge Supplier-Parameter hinzu
    supplierNames.forEach((name, idx) => {
      sqlRequest.input(`supplier${idx}`, sql.NVarChar, name)
    })

    const result = await sqlRequest.query(query)

    // Normalisiere Lieferanten-Namen (wie in der anderen API)
    const normalizeSupplierName = (name: string): string => {
      const lower = name.toLowerCase()
      if (lower.includes('klingspor')) return 'Klingspor AG'
      if (lower.includes('vsm')) return 'VSM Deutschland'
      if (lower.includes('starcke')) return 'Starcke GmbH & Co. KG'
      if (lower.includes('awuko')) return 'AWUKO ABRASIVES'
      return name
    }

    // Aggregiere Daten nach normalisiertem Namen und Periode
    const aggregatedData = new Map<string, Map<string, { orders: number, revenue: number }>>()

    result.recordset.forEach(row => {
      const normalizedName = normalizeSupplierName(row.supplier_name)
      const periodStr = row.period.toISOString().split('T')[0]
      
      if (!aggregatedData.has(normalizedName)) {
        aggregatedData.set(normalizedName, new Map())
      }
      
      const supplierData = aggregatedData.get(normalizedName)!
      
      if (!supplierData.has(periodStr)) {
        supplierData.set(periodStr, { orders: 0, revenue: 0 })
      }
      
      const periodData = supplierData.get(periodStr)!
      periodData.orders += parseInt(row.orders || 0)
      periodData.revenue += parseFloat(row.revenue || 0)
    })

    // Konvertiere zu Array-Format
    const timeseries: any[] = []
    
    aggregatedData.forEach((periods, supplierName) => {
      periods.forEach((data, period) => {
        timeseries.push({
          period,
          supplier: supplierName,
          orders: data.orders,
          revenue: data.revenue.toFixed(2)
        })
      })
    })

    return NextResponse.json({
      ok: true,
      period: { from, to },
      grouping: groupByLabel,
      timeseries: timeseries.sort((a, b) => a.period.localeCompare(b.period))
    })

  } catch (error: any) {
    console.error('[/api/jtl/sales/suppliers-timeseries] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
