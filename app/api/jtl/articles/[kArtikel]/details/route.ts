export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { getDb } from '@/lib/db/mongodb'

/**
 * GET /api/jtl/articles/[kArtikel]/details
 * Lädt vollständige Artikel-Details inkl. Merkmale, Attribute, Beschreibung
 * Zuerst aus MongoDB (importierte Daten), dann enrichment aus MSSQL
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

    // Lade aus MongoDB (hat bereits importierte Basis-Daten)
    const db = await getDb()
    const collection = db.collection('articles')
    const mongoArtikel = await collection.findOne({ kArtikel })
    
    if (!mongoArtikel) {
      return NextResponse.json({
        ok: false,
        error: 'Artikel nicht in MongoDB gefunden. Bitte Import durchführen.'
      }, { status: 404 })
    }

    const pool = await getMssqlPool()
    
    // Nutze MongoDB-Daten als Basis
    const artikel = {
      kArtikel: mongoArtikel.kArtikel,
      cArtNr: mongoArtikel.cArtNr,
      cName: mongoArtikel.cName,
      cKurzBeschreibung: mongoArtikel.cKurzBeschreibung || null,
      cBeschreibung: null, // Wird gleich geladen
      cBarcode: mongoArtikel.cBarcode,
      cHAN: mongoArtikel.cHAN,
      fVKNetto: mongoArtikel.fVKNetto,
      fEKNetto: mongoArtikel.fEKNetto,
      fUVP: mongoArtikel.fUVP,
      nLagerbestand: mongoArtikel.nLagerbestand,
      fGewicht: mongoArtikel.fGewicht,
      cHerstellerName: mongoArtikel.cHerstellerName,
      cWarengruppenName: mongoArtikel.cWarengruppenName,
      merkmale: mongoArtikel.merkmale || [],
      attribute: []
    }
    
    // 2. Beschreibung aus tArtikelBeschreibung (Langtext)
    try {
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
    } catch (e) {
      console.log('[Artikel Details] Beschreibung konnte nicht geladen werden:', e.message)
      artikel.cBeschreibung = null
    }
    
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
