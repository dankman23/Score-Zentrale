export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

/**
 * GET /api/customers/all-articles?kKunde=12345
 * Lädt alle je gekauften Artikel eines Kunden (aggregiert)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const kKunde = searchParams.get('kKunde')
    
    if (!kKunde) {
      return NextResponse.json({
        ok: false,
        error: 'kKunde Parameter fehlt'
      }, { status: 400 })
    }
    
    const pool = await getMssqlPool()
    
    // Lade alle Artikel aggregiert
    const result = await pool.request()
      .input('kKunde', parseInt(kKunde))
      .query(`
        SELECT 
          art.cArtNr,
          op.cName as cArtikelName,
          SUM(op.fAnzahl) as fGesamtAnzahl,
          SUM(op.fAnzahl * op.fVKNetto) as fGesamtUmsatz,
          COUNT(DISTINCT o.kAuftrag) as nAnzahlBestellungen,
          MAX(o.dErstellt) as dLetzteBestellung
        FROM Verkauf.tAuftrag o
        INNER JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
        INNER JOIN tArtikel art ON art.kArtikel = op.kArtikel
        WHERE o.kKunde = @kKunde
          AND (o.nStorno IS NULL OR o.nStorno = 0)
          AND o.cAuftragsNr LIKE 'AU%'
          AND op.kArtikel > 0
        GROUP BY art.cArtNr, op.cName
        ORDER BY fGesamtUmsatz DESC
      `)
    
    return NextResponse.json({
      ok: true,
      articles: result.recordset
    })
    
  } catch (error: any) {
    console.error('[All Articles] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
