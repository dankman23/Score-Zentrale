export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export async function GET() {
  try {
    const pool = await getMssqlPool()
    
    // 1. Struktur von tPlattform
    const platformStructure = `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tPlattform'
      ORDER BY ORDINAL_POSITION
    `
    const platformCols = await pool.request().query(platformStructure)
    
    // 2. Alle Plattformen anzeigen
    const platformsQuery = `
      SELECT TOP 20 * FROM dbo.tPlattform
    `
    const platforms = await pool.request().query(platformsQuery)
    
    // 2. Struktur von tArtikelShop
    const artikelShopStructure = `
      SELECT TOP 5 COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tArtikelShop'
      ORDER BY ORDINAL_POSITION
    `
    const shopStructure = await pool.request().query(artikelShopStructure)
    
    // 3. Sample von tArtikelShop
    const artikelShopSample = `
      SELECT TOP 10 * FROM dbo.tArtikelShop
    `
    const shopSample = await pool.request().query(artikelShopSample)
    
    // 4. Anzahl Artikel pro Plattform
    const countQuery = `
      SELECT 
        p.cName as Plattform,
        COUNT(DISTINCT asho.kArtikel) as AnzahlArtikel
      FROM dbo.tArtikelShop asho
      INNER JOIN dbo.tShop s ON asho.kShop = s.kShop
      INNER JOIN dbo.tPlattform p ON s.kPlattform = p.kPlattform
      GROUP BY p.cName
      ORDER BY AnzahlArtikel DESC
    `
    const counts = await pool.request().query(countQuery)
    
    return NextResponse.json({
      ok: true,
      platforms: platforms.recordset,
      shopStructure: shopStructure.recordset,
      shopSample: shopSample.recordset,
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
