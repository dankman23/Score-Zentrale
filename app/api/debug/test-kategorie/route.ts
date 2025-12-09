export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

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
        WITH Produktnamen AS (
          SELECT 
            ab.cName as produktname,
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
            AND ab.cName IS NOT NULL
          GROUP BY ab.cName
        ),
        KategorienMatch AS (
          SELECT 
            CASE 
              WHEN produktname LIKE '%Schleifscheibe%' THEN 'Schleifscheibe'
              WHEN produktname LIKE '%Fächerscheibe%' THEN 'Fächerscheibe'
              WHEN produktname LIKE '%Trennscheibe%' THEN 'Trennscheibe'
              WHEN produktname LIKE '%Schleifband%' THEN 'Schleifband'
              WHEN produktname LIKE '%Schleifbänder%' THEN 'Schleifband'
              WHEN produktname LIKE '%Fräser%' THEN 'Fräser'
              WHEN produktname LIKE '%Bohrer%' THEN 'Bohrer'
              WHEN produktname LIKE '%Schleifpapier%' THEN 'Schleifpapier'
              WHEN produktname LIKE '%Vlies%' THEN 'Vlies'
              WHEN produktname LIKE '%Polierscheibe%' THEN 'Polierscheibe'
              WHEN produktname LIKE '%Fächerschleifscheibe%' THEN 'Fächerscheibe'
              WHEN produktname LIKE '%Fiberscheibe%' THEN 'Fiberscheibe'
              WHEN produktname LIKE '%Schruppscheibe%' THEN 'Schruppscheibe'
              WHEN produktname LIKE '%Lamellenscheibe%' THEN 'Lamellenscheibe'
              ELSE NULL
            END as kategorie,
            produktname,
            umsatz
          FROM Produktnamen
        )
        SELECT TOP 10 kategorie, SUM(umsatz) as total_umsatz
        FROM KategorienMatch
        WHERE kategorie IS NOT NULL
        GROUP BY kategorie
        ORDER BY total_umsatz DESC
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
