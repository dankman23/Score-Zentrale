export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

/**
 * GET /api/jtl/articles/count
 * Zählt importierbare Artikel (aktiv, keine Stücklisten, keine Varianten-Kinder)
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getMssqlPool()

    // Zähle gefilterte Artikel
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as gesamt,
        COUNT(CASE WHEN kStueckliste = 0 THEN 1 END) as keine_stuecklisten,
        COUNT(CASE WHEN cAktiv = 'Y' THEN 1 END) as aktive,
        COUNT(CASE WHEN cAktiv = 'Y' AND kStueckliste = 0 AND (nIstVater = 1 OR kVaterArtikel = 0) THEN 1 END) as importierbar
      FROM tArtikel
    `)

    const counts = result.recordset[0]

    return NextResponse.json({
      ok: true,
      counts: {
        gesamt: counts.gesamt,
        keine_stuecklisten: counts.keine_stuecklisten,
        aktive: counts.aktive,
        importierbar: counts.importierbar,
        info: 'Importierbar = Aktiv + Keine Stückliste + (Vater-Artikel oder Einzelartikel)'
      }
    })

  } catch (error: any) {
    console.error('[Articles Count] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
