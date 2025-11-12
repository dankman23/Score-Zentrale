export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

/**
 * GET /api/jtl/preis-historie?sku=122112
 * Sucht Preis-Historie für einen Artikel
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sku = searchParams.get('sku')
    
    if (!sku) {
      return NextResponse.json(
        { ok: false, error: 'SKU erforderlich' },
        { status: 400 }
      )
    }
    
    const pool = await getMssqlPool()
    const result: any = {}
    
    // 1. Finde alle Tabellen mit Preis/Historie
    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%Preis%' OR TABLE_NAME LIKE '%Historie%' OR TABLE_NAME LIKE '%History%' OR TABLE_NAME LIKE '%Log%'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    result.verfuegbareTabelLen = tables.recordset.map(t => `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`)
    
    // 2. Finde Artikel
    const artikel = await pool.request()
      .input('sku', sku)
      .query(`
        SELECT kArtikel, cArtNr, cName, fVKNetto, fVKBrutto
        FROM dbo.tArtikel
        WHERE cArtNr = @sku
      `)
    
    if (artikel.recordset.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Artikel nicht gefunden',
        verfuegbareTabelLen: result.verfuegbareTabelLen
      })
    }
    
    result.artikel = artikel.recordset[0]
    const kArtikel = artikel.recordset[0].kArtikel
    
    // 3. Versuche verschiedene Historie-Tabellen
    
    // tPreisHistorie
    try {
      const preisHistorie = await pool.request().query(`
        SELECT TOP 20 * FROM dbo.tPreisHistorie 
        WHERE kArtikel = ${kArtikel} 
        ORDER BY dErstellt DESC
      `)
      result.tPreisHistorie = {
        gefunden: true,
        anzahl: preisHistorie.recordset.length,
        spalten: Object.keys(preisHistorie.recordset[0] || {}),
        daten: preisHistorie.recordset
      }
    } catch (e: any) {
      result.tPreisHistorie = { gefunden: false, fehler: e.message }
    }
    
    // tArtikelLog
    try {
      const artikelLog = await pool.request().query(`
        SELECT TOP 20 * FROM dbo.tArtikelLog 
        WHERE kArtikel = ${kArtikel} 
        ORDER BY dErstellt DESC
      `)
      result.tArtikelLog = {
        gefunden: true,
        anzahl: artikelLog.recordset.length,
        spalten: Object.keys(artikelLog.recordset[0] || {}),
        daten: artikelLog.recordset
      }
    } catch (e: any) {
      result.tArtikelLog = { gefunden: false, fehler: e.message }
    }
    
    // tPreis (aktueller Preis)
    try {
      const preis = await pool.request().query(`
        SELECT * FROM dbo.tPreis 
        WHERE kArtikel = ${kArtikel}
      `)
      result.tPreis = {
        gefunden: true,
        anzahl: preis.recordset.length,
        spalten: Object.keys(preis.recordset[0] || {}),
        daten: preis.recordset
      }
    } catch (e: any) {
      result.tPreis = { gefunden: false, fehler: e.message }
    }
    
    // tArtikelAbnahme (Staffelpreise Historie?)
    try {
      const abnahme = await pool.request().query(`
        SELECT * FROM dbo.tArtikelAbnahme 
        WHERE kArtikel = ${kArtikel}
        ORDER BY nAbnahme
      `)
      result.tArtikelAbnahme = {
        gefunden: true,
        anzahl: abnahme.recordset.length,
        spalten: Object.keys(abnahme.recordset[0] || {}),
        daten: abnahme.recordset
      }
    } catch (e: any) {
      result.tArtikelAbnahme = { gefunden: false, fehler: e.message }
    }
    
    return NextResponse.json({
      ok: true,
      sku,
      result
    })
  } catch (error: any) {
    console.error('[Preis-Historie] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
