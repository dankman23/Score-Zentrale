import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/jtl/articles/check?kArtikel=123,456,789
 * Prüft, ob Artikel in JTL existieren
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const kArtikelParam = searchParams.get('kArtikel') || ''
    
    if (!kArtikelParam) {
      return NextResponse.json({ 
        ok: false, 
        error: 'kArtikel parameter required' 
      }, { status: 400 })
    }

    const pool = await getMssqlPool()
    
    const result = await pool.request().query(`
      SELECT 
        kArtikel, 
        cArtNr, 
        cName,
        cAktiv,
        kStueckliste,
        nIstVater,
        kVaterArtikel
      FROM tArtikel 
      WHERE kArtikel IN (${kArtikelParam})
    `)

    return NextResponse.json({
      ok: true,
      found: result.recordset.length,
      articles: result.recordset
    })

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
