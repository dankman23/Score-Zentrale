export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool } from '../../../../lib/db/mssql'

/**
 * GET /api/debug/order?id=145585
 * Debug specific order
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('id')
    
    if (!orderId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Order ID required' 
      }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    
    // Find Auftrag table
    const tableCheck = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%Auftrag%' AND TABLE_TYPE = 'BASE TABLE'
    `)
    
    const auftragTable = tableCheck.recordset.find((t: any) => t.TABLE_NAME === 'tAuftrag')
      ? (tableCheck.recordset.find((t: any) => t.TABLE_NAME === 'tAuftrag' && t.TABLE_SCHEMA === 'Verkauf') ? 'Verkauf.tAuftrag' : 'dbo.tAuftrag')
      : 'dbo.tAuftrag'
    
    // Search order by kAuftrag or cAuftragsNr
    const result = await pool.request().query(`
      SELECT TOP 5 *
      FROM ${auftragTable}
      WHERE kAuftrag = ${orderId} OR cAuftragsNr = '${orderId}'
    `)
    
    // Also search in positions
    const posTable = tableCheck.recordset.find((t: any) => t.TABLE_NAME === 'tAuftragPosition')
      ? (tableCheck.recordset.find((t: any) => t.TABLE_NAME === 'tAuftragPosition' && t.TABLE_SCHEMA === 'Verkauf') ? 'Verkauf.tAuftragPosition' : 'dbo.tAuftragPosition')
      : 'dbo.tAuftragPosition'
    
    const positions = await pool.request().query(`
      SELECT TOP 10 *
      FROM ${posTable}
      WHERE kAuftrag = ${orderId}
    `)
    
    return NextResponse.json({
      ok: true,
      auftragTable,
      posTable,
      orderCount: result.recordset.length,
      orders: result.recordset,
      positionCount: positions.recordset.length,
      positions: positions.recordset
    })
  } catch (error: any) {
    console.error('[Debug Order] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
