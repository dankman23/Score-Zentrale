export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import sql from 'mssql'

/**
 * GET /api/jtl/debug-sku?sku=145585&from=2024-10-01&to=2025-11-09
 * Debug specific SKU sales
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const sku = searchParams.get('sku') || '145585'
    const from = searchParams.get('from') || '2024-10-01'
    const to = searchParams.get('to') || '2025-11-09'

    const pool = await getMssqlPool()
    
    const query = `
      SELECT 
        a.cArtNr AS sku,
        op.cName AS product_name,
        op.fAnzahl AS quantity,
        op.fVKNetto AS net_price,
        (op.fVKNetto * op.fAnzahl) AS net_total,
        o.dErstellt AS order_date,
        o.kAuftrag AS order_id,
        o.cAuftragsNr AS order_number
      FROM Verkauf.tAuftrag o
      INNER JOIN Verkauf.tAuftragPosition op ON o.kAuftrag = op.kAuftrag
      LEFT JOIN dbo.tArtikel a ON op.kArtikel = a.kArtikel
      WHERE a.cArtNr = @sku
        AND CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        AND (o.nStorno IS NULL OR o.nStorno = 0)
        AND op.nPosTyp = 1
      ORDER BY o.dErstellt DESC
    `

    const result = await pool.request()
      .input('sku', sql.NVarChar, sku)
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .query(query)

    const rows = result.recordset || []
    
    // Calculate totals
    const totalQuantity = rows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0)
    const totalRevenue = rows.reduce((sum, r) => sum + (parseFloat(r.net_total) || 0), 0)

    return NextResponse.json({
      ok: true,
      sku,
      period: { from, to },
      count: rows.length,
      totalQuantity: totalQuantity.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      orders: rows.map(r => ({
        orderNumber: r.order_number,
        orderDate: r.order_date,
        productName: r.product_name,
        quantity: parseFloat(r.quantity || 0).toFixed(2),
        netPrice: parseFloat(r.net_price || 0).toFixed(2),
        netTotal: parseFloat(r.net_total || 0).toFixed(2)
      }))
    })
  } catch (error: any) {
    console.error('[/api/jtl/debug-sku] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
