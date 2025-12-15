export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // Test: Artikel 404546 (Top-Artikel aus Rating)
    const testQuery = `
      SELECT 
        a.kArtikel,
        a.cArtNr,
        s.kShop,
        s.cName as ShopName,
        s.nPlattform,
        p.cName as PlattformName
      FROM dbo.tArtikel a
      INNER JOIN dbo.tArtikelShop asho ON a.kArtikel = asho.kArtikel
      INNER JOIN dbo.tShop s ON asho.kShop = s.kShop
      INNER JOIN dbo.tPlattform p ON s.nPlattform = p.nPlattform
      WHERE a.cArtNr = '404546'
    `
    const test = await pool.request().query(testQuery)
    
    // Count pro Plattform
    const countQuery = `
      SELECT 
        p.cName as Plattform,
        COUNT(DISTINCT asho.kArtikel) as AnzahlArtikel
      FROM dbo.tArtikelShop asho
      INNER JOIN dbo.tShop s ON asho.kShop = s.kShop
      INNER JOIN dbo.tPlattform p ON s.nPlattform = p.nPlattform
      GROUP BY p.cName
      ORDER BY AnzahlArtikel DESC
    `
    const counts = await pool.request().query(countQuery)
    
    return NextResponse.json({
      ok: true,
      testArtikel: test.recordset,
      counts: counts.recordset
    })
    
  } catch (error: any) {
    console.error('[Test Platforms] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
