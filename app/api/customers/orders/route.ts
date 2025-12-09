export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

/**
 * GET /api/customers/orders?kKunde=12345
 * Lädt alle Bestellungen eines Kunden aus JTL
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
    
    // Lade Bestellungen mit Details
    const result = await pool.request()
      .input('kKunde', parseInt(kKunde))
      .query(`
        SELECT 
          o.kAuftrag,
          o.cAuftragsNr,
          o.dErstellt,
          ISNULL(z.cName, '') as cZahlungsart,
          ISNULL(v.cName, '') as cVersandart,
          -- Berechne Gesamtsumme aus Positionen
          ISNULL(SUM(op.fAnzahl * op.fVKNetto), 0) as fGesamtsummeNetto,
          -- Anzahl Artikel
          COUNT(DISTINCT op.kArtikel) as artikel_count,
          -- Status
          CASE 
            WHEN o.nStorno = 1 THEN 'Storniert'
            WHEN o.nAuftragStatus >= 4 THEN 'Abgeschlossen'
            ELSE 'Offen'
          END as cStatus
        FROM Verkauf.tAuftrag o
        LEFT JOIN tZahlungsart z ON z.kZahlungsart = o.kZahlungsart
        LEFT JOIN tVersandart v ON v.kVersandArt = o.kVersandArt
        LEFT JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag AND op.kArtikel > 0
        WHERE o.kKunde = @kKunde
          AND (o.nStorno IS NULL OR o.nStorno = 0)
          AND o.cAuftragsNr LIKE 'AU%'
        GROUP BY 
          o.kAuftrag, o.cAuftragsNr, o.dErstellt, z.cName, v.cName, 
          o.nStorno, o.nAuftragStatus
        ORDER BY o.dErstellt DESC
      `)
    
    return NextResponse.json({
      ok: true,
      orders: result.recordset
    })
    
  } catch (error: any) {
    console.error('[Customer Orders] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
