export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

/**
 * GET /api/jtl/articles/[kArtikel]/details
 * Lädt vollständige Artikel-Details inkl. Merkmale, Attribute, Beschreibung
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { kArtikel: string } }
) {
  try {
    const kArtikel = parseInt(params.kArtikel)
    
    if (!kArtikel) {
      return NextResponse.json({
        ok: false,
        error: 'Ungültige Artikel-ID'
      }, { status: 400 })
    }

    const pool = await getMssqlPool()
    
    // 1. Basis-Artikeldaten
    const artikelResult = await pool.request()
      .input('kArtikel', kArtikel)
      .query(`
        SELECT 
          a.kArtikel,
          a.cArtNr,
          a.cBarcode,
          a.cHAN,
          a.fVKNetto,
          a.fEKNetto,
          a.fUVP,
          a.nLagerbestand,
          a.nMindestbestellmaenge,
          a.fGewicht,
          ab.cName,
          ab.cKurzBeschreibung,
          h.cName as cHerstellerName,
          w.cName as cWarengruppenName
        FROM tArtikel a
        LEFT JOIN tArtikelBeschreibung ab ON a.kArtikel = ab.kArtikel AND ab.kSprache = 1
        LEFT JOIN tHersteller h ON a.kHersteller = h.kHersteller
        LEFT JOIN tWarengruppe w ON a.kWarengruppe = w.kWarengruppe
        WHERE a.kArtikel = @kArtikel
      `)
    
    if (artikelResult.recordset.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Artikel nicht gefunden'
      }, { status: 404 })
    }
    
    const artikel = artikelResult.recordset[0]
    
    // 2. Beschreibung aus tArtikelBeschreibung
    const beschreibungResult = await pool.request()
      .input('kArtikel', kArtikel)
      .query(`
        SELECT TOP 1 cBeschreibung
        FROM tArtikelBeschreibung
        WHERE kArtikel = @kArtikel
        AND kSprache = 1
      `)
    
    artikel.cBeschreibung = beschreibungResult.recordset.length > 0 
      ? beschreibungResult.recordset[0].cBeschreibung 
      : null
    
    // 3. Merkmale
    const merkmaleResult = await pool.request()
      .input('kArtikel', kArtikel)
      .query(`
        SELECT 
          m.cName as name,
          mw.cWert as wert
        FROM tArtikelMerkmal am
        INNER JOIN tMerkmal m ON am.kMerkmal = m.kMerkmal
        LEFT JOIN tMerkmalWert mw ON am.kMerkmalWert = mw.kMerkmalWert
        WHERE am.kArtikel = @kArtikel
        ORDER BY m.nSort, m.cName
      `)
    
    artikel.merkmale = merkmaleResult.recordset.map(m => ({
      name: m.name,
      wert: m.wert || ''
    }))
    
    // 4. Attribute
    const attributeResult = await pool.request()
      .input('kArtikel', kArtikel)
      .query(`
        SELECT 
          a.cName as name,
          aa.cWert as wert
        FROM tArtikelAttribut aa
        INNER JOIN tAttribut a ON aa.kAttribut = a.kAttribut
        WHERE aa.kArtikel = @kArtikel
        ORDER BY a.nSort, a.cName
      `)
    
    artikel.attribute = attributeResult.recordset.map(a => ({
      name: a.name,
      wert: a.wert || ''
    }))
    
    console.log(`[Artikel Details] Loaded kArtikel=${kArtikel}: ${artikel.merkmale.length} merkmale, ${artikel.attribute.length} attribute`)
    
    return NextResponse.json({
      ok: true,
      artikel: {
        kArtikel: artikel.kArtikel,
        cArtNr: artikel.cArtNr,
        cName: artikel.cName,
        cKurzBeschreibung: artikel.cKurzBeschreibung,
        cBeschreibung: artikel.cBeschreibung,
        cBarcode: artikel.cBarcode,
        cHAN: artikel.cHAN,
        fVKNetto: artikel.fVKNetto,
        fEKNetto: artikel.fEKNetto,
        nLagerbestand: artikel.nLagerbestand,
        fGewicht: artikel.fGewicht,
        cHerstellerName: artikel.cHerstellerName,
        cWarengruppenName: artikel.cWarengruppenName,
        merkmale: artikel.merkmale,
        attribute: artikel.attribute,
        margin_percent: artikel.fEKNetto > 0 
          ? ((artikel.fVKNetto - artikel.fEKNetto) / artikel.fVKNetto * 100).toFixed(2)
          : 100
      }
    })
    
  } catch (error: any) {
    console.error('[Artikel Details] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
