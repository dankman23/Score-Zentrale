export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { hasColumn, pickFirstExisting, firstExistingTable } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/orders/kpi/margin
 * Rohertragsmarge berechnen: Umsatz netto (nur Artikel, ohne Versand) - EK netto
 * EK-Cascade: Position-EK → Historischer EK (Eingangsrechnung/Wareneingang) → Artikel-EK
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)

    const pool = await getMssqlPool()

    // Tabellen
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const articleTable = 'dbo.tArtikel'

    // Prüfe ob Tabellen existieren
    const hasOrderTable = await hasColumn(pool, orderTable, 'kAuftrag')
    if (!hasOrderTable) {
      return NextResponse.json({
        ok: false,
        error: 'Verkauf.tAuftrag Tabelle nicht gefunden'
      }, { status: 404 })
    }

    // Storno-Filter
    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    // Filter: Only "Aufträge" (AU...), not "Angebote" (AN...)
    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    // Artikel-Filter (nur Artikel, keine Versandkosten)
    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp 
      ? 'op.nPosTyp = 1'
      : `op.kArtikel > 0 
         AND ISNULL(op.cName,'') NOT LIKE 'Versand%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Gutschein%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Rabatt%' 
         AND ISNULL(op.cName,'') NOT LIKE 'Pfand%'`
    
    // Versand-Filter (Positionen OHNE Artikelnummer = Versandkosten)
    const shippingFilter = hasNPosTyp
      ? 'op.nPosTyp = 3'  // Typ 3 = Versand
      : `(op.kArtikel = 0 OR op.kArtikel IS NULL)`  // Keine Artikelnummer

    // Positionsfelder
    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const vkNettoField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'
    const posEkField = await pickFirstExisting(pool, orderPosTable, ['fEKNetto', 'fEK']) || 'fEKNetto'

    // Historische EK-Tabellen ermitteln
    const invoiceHeaderCandidates = [
      'Einkauf.tEingangsrechnung',
      'dbo.tEingangsrechnung'
    ]
    const invoicePosCandidates = [
      'Einkauf.tEingangsrechnungPos',
      'dbo.tEingangsrechnungPos'
    ]
    const grHeaderCandidates = [
      'Einkauf.tWareneingang',
      'dbo.tWareneingang'
    ]
    const grPosCandidates = [
      'Einkauf.tWareneingangPos',
      'dbo.tWareneingangPos'
    ]

    const invoiceHeader = await firstExistingTable(pool, invoiceHeaderCandidates)
    const invoicePos = await firstExistingTable(pool, invoicePosCandidates)
    const grHeader = await firstExistingTable(pool, grHeaderCandidates)
    const grPos = await firstExistingTable(pool, grPosCandidates)

    // Build historical EK query parts
    let historicalEkQuery = ''
    const historyTables: string[] = []

    if (invoiceHeader && invoicePos) {
      historyTables.push(`${invoicePos}/${invoiceHeader}`)
      const invDateField = await pickFirstExisting(pool, invoiceHeader, ['dBelegDatum', 'dErstellt']) || 'dErstellt'
      const invQtyField = await pickFirstExisting(pool, invoicePos, ['fMenge', 'nMenge']) || 'fMenge'
      const invEkField = await pickFirstExisting(pool, invoicePos, ['fEKNetto', 'fVKNetto']) || 'fEKNetto'
      
      historicalEkQuery += `
        SELECT TOP 1 ip.${invEkField} AS ek
        FROM ${invoicePos} ip
        INNER JOIN ${invoiceHeader} ih ON ip.kEingangsrechnung = ih.kEingangsrechnung
        WHERE ip.kArtikel = op.kArtikel
          AND CAST(ih.${invDateField} AS DATE) < CAST(o.dErstellt AS DATE)
        ORDER BY ih.${invDateField} DESC
      `
    }

    if (grHeader && grPos) {
      historyTables.push(`${grPos}/${grHeader}`)
      const grDateField = await pickFirstExisting(pool, grHeader, ['dErstellt', 'dDatum']) || 'dErstellt'
      const grQtyField = await pickFirstExisting(pool, grPos, ['fMenge', 'nMenge']) || 'fMenge'
      const grEkField = await pickFirstExisting(pool, grPos, ['fEKNetto', 'fEK']) || 'fEKNetto'
      
      if (historicalEkQuery) {
        // Append as UNION fallback
        historicalEkQuery = `
          SELECT TOP 1 ek FROM (
            ${historicalEkQuery}
            UNION ALL
            SELECT TOP 1 gp.${grEkField} AS ek
            FROM ${grPos} gp
            INNER JOIN ${grHeader} gh ON gp.kWareneingang = gh.kWareneingang
            WHERE gp.kArtikel = op.kArtikel
              AND CAST(gh.${grDateField} AS DATE) < CAST(o.dErstellt AS DATE)
            ORDER BY gh.${grDateField} DESC
          ) combined
          ORDER BY ek DESC
        `
      } else {
        historicalEkQuery = `
          SELECT TOP 1 gp.${grEkField} AS ek
          FROM ${grPos} gp
          INNER JOIN ${grHeader} gh ON gp.kWareneingang = gh.kWareneingang
          WHERE gp.kArtikel = op.kArtikel
            AND CAST(gh.${grDateField} AS DATE) < CAST(o.dErstellt AS DATE)
          ORDER BY gh.${grDateField} DESC
        `
      }
    }

    const historicalEkClause = historicalEkQuery 
      ? `OUTER APPLY (${historicalEkQuery}) hist` 
      : ''

    const ekCascade = historicalEkQuery
      ? `COALESCE(op.${posEkField}, hist.ek, a.fEKNetto, 0)`
      : `COALESCE(op.${posEkField}, a.fEKNetto, 0)`

    const costSourceCalc = historicalEkQuery
      ? `
        CASE 
          WHEN op.${posEkField} IS NOT NULL AND op.${posEkField} > 0 THEN 'position'
          WHEN hist.ek IS NOT NULL AND hist.ek > 0 THEN 'history'
          ELSE 'article_current'
        END
      `
      : `
        CASE 
          WHEN op.${posEkField} IS NOT NULL AND op.${posEkField} > 0 THEN 'position'
          ELSE 'article_current'
        END
      `

    // Separate query for shipping costs
    // Versand hat keinen EK (keine Wareneinkaufskosten), also EK = 0
    const shippingQuery = `
      SELECT 
        SUM(op.${vkNettoField} * op.${qtyField}) AS shipping_revenue,
        0 AS shipping_cost
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        ${orderTypeFilter}
        AND ${shippingFilter}
    `

    const query = `
      WITH OrderPositions AS (
        SELECT 
          o.kAuftrag,
          op.${vkNettoField} * op.${qtyField} AS revenue_net,
          (${ekCascade}) * op.${qtyField} AS cost_net,
          ${costSourceCalc} AS cost_source
        FROM ${orderTable} o
        INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
        LEFT JOIN ${articleTable} a ON op.kArtikel = a.kArtikel
        ${historicalEkClause}
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
          ${stornoFilter}
          ${orderTypeFilter}
          AND ${articleFilter}
      )
      SELECT 
        COUNT(DISTINCT kAuftrag) AS orders,
        SUM(revenue_net) AS revenue_net,
        SUM(cost_net) AS cost_net,
        SUM(revenue_net - cost_net) AS margin_net,
        SUM(CASE WHEN cost_source = 'position' THEN cost_net ELSE 0 END) AS cost_from_position,
        SUM(CASE WHEN cost_source = 'history' THEN cost_net ELSE 0 END) AS cost_from_history,
        SUM(CASE WHEN cost_source = 'article_current' THEN cost_net ELSE 0 END) AS cost_from_article,
        SUM(cost_net) AS total_cost
      FROM OrderPositions
    `

    const [result, shippingResult] = await Promise.all([
      pool.request()
        .input('from', sql.Date, from)
        .input('to', sql.Date, to)
        .query(query),
      pool.request()
        .input('from', sql.Date, from)
        .input('to', sql.Date, to)
        .query(shippingQuery)
    ])

    const row = result.recordset[0] || {}
    const shippingRow = shippingResult.recordset[0] || {}

    const totalCost = parseFloat(row.total_cost || 0)
    const costFromPosition = parseFloat(row.cost_from_position || 0)
    const costFromHistory = parseFloat(row.cost_from_history || 0)
    const costFromArticle = parseFloat(row.cost_from_article || 0)

    const positionPct = totalCost > 0 ? ((costFromPosition / totalCost) * 100).toFixed(1) : '0.0'
    const historyPct = totalCost > 0 ? ((costFromHistory / totalCost) * 100).toFixed(1) : '0.0'
    const articlePct = totalCost > 0 ? ((costFromArticle / totalCost) * 100).toFixed(1) : '0.0'

    // Calculate shipping
    const shippingRevenue = parseFloat(shippingRow.shipping_revenue || 0)
    const shippingCost = parseFloat(shippingRow.shipping_cost || 0)
    
    // Total with shipping
    const revenueWithShipping = parseFloat(row.revenue_net || 0) + shippingRevenue
    const costWithShipping = parseFloat(row.cost_net || 0) + shippingCost
    const marginWithShipping = revenueWithShipping - costWithShipping

    return NextResponse.json({
      ok: true,
      period: { from, to },
      orders: row.orders || 0,
      revenue_net_wo_ship: parseFloat(row.revenue_net || 0).toFixed(2),
      cost_net: parseFloat(row.cost_net || 0).toFixed(2),
      margin_net: parseFloat(row.margin_net || 0).toFixed(2),
      // Mit Versand
      shipping_revenue: shippingRevenue.toFixed(2),
      shipping_cost: shippingCost.toFixed(2),
      revenue_net_with_ship: revenueWithShipping.toFixed(2),
      cost_net_with_ship: costWithShipping.toFixed(2),
      margin_net_with_ship: marginWithShipping.toFixed(2),
      cost_source: {
        from: {
          position_pct: parseFloat(positionPct),
          history_pct: parseFloat(historyPct),
          article_current_pct: parseFloat(articlePct)
        }
      },
      debug: {
        historyTables,
        date: 'o.dErstellt inklusiv',
        articleFilter: hasNPosTyp ? 'nPosTyp=1' : 'heuristic'
      }
    })

  } catch (error: any) {
    console.error('[/api/jtl/orders/kpi/margin] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
