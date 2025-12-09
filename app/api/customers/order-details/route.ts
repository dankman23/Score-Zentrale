export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

/**
 * GET /api/customers/order-details?kAuftrag=12345
 * Lädt alle Artikel einer Bestellung
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const kAuftrag = searchParams.get('kAuftrag')
    
    if (!kAuftrag) {
      return NextResponse.json({
        ok: false,
        error: 'kAuftrag Parameter fehlt'
      }, { status: 400 })
    }
    
    const pool = await getMssqlPool()
    
    // Lade Bestellpositionen mit Artikeldetails
    const result = await pool.request()
      .input('kAuftrag', parseInt(kAuftrag))
      .query(`
        SELECT DISTINCT
          op.kAuftragPosition,
          op.cName as cArtikelName,
          art.cArtNr,
          op.fAnzahl,
          op.fVKNetto as fPreisNetto,
          (op.fAnzahl * op.fVKNetto) as fGesamtNetto
        FROM Verkauf.tAuftragPosition op
        INNER JOIN tArtikel art ON art.kArtikel = op.kArtikel
        WHERE op.kAuftrag = @kAuftrag
          AND op.kArtikel > 0
        ORDER BY op.kAuftragPosition
      `)
    
    return NextResponse.json({
      ok: true,
      items: result.recordset
    })
    
  } catch (error: any) {
    console.error('[Order Details] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
