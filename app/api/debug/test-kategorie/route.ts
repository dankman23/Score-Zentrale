export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../app/lib/db/mssql'

/**
 * GET /api/debug/test-kategorie?kKunde=100000
 * Test: Produktkategorien-Erkennung
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const kKunde = parseInt(searchParams.get('kKunde') || '100000')
    
    const pool = await getMssqlPool()
    
    const result = await pool.request()
      .input('kKunde', kKunde)
      .query(`
        WITH Kategorien AS (
          SELECT 
            CASE 
              WHEN CHARINDEX(' ', ab.cName) > 0 
              THEN LEFT(ab.cName, CHARINDEX(' ', ab.cName) - 1)
              ELSE ab.cName
            END as kategorie,
            SUM(op.fAnzahl * op.fVKNetto) as umsatz
          FROM Verkauf.tAuftrag o
          INNER JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
          INNER JOIN tArtikel art ON art.kArtikel = op.kArtikel
          INNER JOIN tArtikelBeschreibung ab ON ab.kArtikel = art.kArtikel
            AND ab.kSprache = 1
          WHERE o.kKunde = @kKunde
            AND (o.nStorno IS NULL OR o.nStorno = 0)
            AND o.cAuftragsNr LIKE 'AU%'
            AND op.kArtikel > 0
          GROUP BY 
            CASE 
              WHEN CHARINDEX(' ', ab.cName) > 0 
              THEN LEFT(ab.cName, CHARINDEX(' ', ab.cName) - 1)
              ELSE ab.cName
            END
        )
        SELECT TOP 10 kategorie, umsatz
        FROM Kategorien
        WHERE kategorie NOT IN ('Kord', 'und', 'der', 'die', 'das')
          AND LEN(kategorie) > 2
        ORDER BY umsatz DESC
      `)
    
    return NextResponse.json({
      ok: true,
      kKunde,
      kategorien: result.recordset
    })
    
  } catch (error: any) {
    console.error('[Debug] Kategorie-Test error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
