export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { getDb } from '@/lib/db/mongodb'

/**
 * GET /api/jtl/articles/[kArtikel]/details
 * Lädt vollständige Artikel-Details inkl. Merkmale, Attribute, Beschreibung
 * Nutzt MongoDB als Hauptquelle (hat bereits importierte Daten)
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

    // Lade aus MongoDB (hat bereits alles)
    const db = await getDb()
    const collection = db.collection('articles')
    const artikel = await collection.findOne({ kArtikel })
    
    if (!artikel) {
      return NextResponse.json({
        ok: false,
        error: 'Artikel nicht gefunden. Bitte Import durchführen.'
      }, { status: 404 })
    }

    // Wenn Merkmale NICHT in MongoDB sind, hole sie aus MSSQL
    let merkmale = artikel.merkmale || []
    let attribute = artikel.attribute || []
    
    if (merkmale.length === 0) {
      try {
        const pool = await getMssqlPool()
        
        const merkmaleResult = await pool.request()
          .input('kArtikel', kArtikel)
          .query(`
            SELECT 
              m.cName as name,
              mws.cWert as wert
            FROM tArtikelMerkmal am
            INNER JOIN tMerkmal m ON am.kMerkmal = m.kMerkmal
            LEFT JOIN tMerkmalWertSprache mws ON am.kMerkmalWert = mws.kMerkmalWert
            WHERE am.kArtikel = @kArtikel
              AND (mws.kSprache = 1 OR mws.kSprache IS NULL)
            ORDER BY m.nSort, m.cName
          `)
        
        merkmale = merkmaleResult.recordset.map(m => ({
          name: m.name,
          wert: m.wert || ''
        }))
        
        // Attribute auch laden
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
        
        attribute = attributeResult.recordset.map(a => ({
          name: a.name,
          wert: a.wert || ''
        }))
      } catch (e: any) {
        console.log('[Artikel Details] Konnte Merkmale nicht aus MSSQL laden:', e.message)
      }
    }
    
    console.log(`[Artikel Details] kArtikel=${kArtikel}: ${merkmale.length} merkmale, ${attribute.length} attribute`)
    
    return NextResponse.json({
      ok: true,
      artikel: {
        kArtikel: artikel.kArtikel,
        cArtNr: artikel.cArtNr,
        cName: artikel.cName,
        cKurzBeschreibung: artikel.cKurzBeschreibung || null,
        cBeschreibung: artikel.cBeschreibung || null,
        cBarcode: artikel.cBarcode,
        cHAN: artikel.cHAN,
        fVKNetto: artikel.fVKNetto,
        fEKNetto: artikel.fEKNetto,
        fUVP: artikel.fUVP,
        nLagerbestand: artikel.nLagerbestand,
        fGewicht: artikel.fGewicht,
        cHerstellerName: artikel.cHerstellerName,
        cWarengruppenName: artikel.cWarengruppenName,
        merkmale: merkmale,
        attribute: attribute,
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
