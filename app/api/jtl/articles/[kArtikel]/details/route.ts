export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
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

    // Wenn Merkmale NICHT in MongoDB sind oder cBeschreibung fehlt, hole sie aus MSSQL
    let merkmale = artikel.merkmale || []
    let attribute = artikel.attribute || []
    let cBeschreibung = artikel.cBeschreibung || null
    let cKurzBeschreibung = artikel.cKurzBeschreibung || null
    
    if (merkmale.length === 0 || !cBeschreibung) {
      try {
        const pool = await getMssqlPool()
        
        // Lade Beschreibung aus MSSQL falls nicht vorhanden
        if (!cBeschreibung || !cKurzBeschreibung) {
          const beschreibungResult = await pool.request()
            .input('kArtikel', kArtikel)
            .query(`
              SELECT 
                cKurzBeschreibung,
                cBeschreibung
              FROM tArtikelBeschreibung
              WHERE kArtikel = @kArtikel AND kSprache = 1
            `)
          
          if (beschreibungResult.recordset.length > 0) {
            cKurzBeschreibung = beschreibungResult.recordset[0].cKurzBeschreibung || cKurzBeschreibung
            cBeschreibung = beschreibungResult.recordset[0].cBeschreibung || cBeschreibung
            console.log(`[Artikel Details] Beschreibung aus MSSQL geladen für kArtikel=${kArtikel}`)
            
            // Update MongoDB mit der Beschreibung
            await collection.updateOne(
              { kArtikel },
              { $set: { cKurzBeschreibung, cBeschreibung } }
            )
          }
        }
        
        const merkmaleResult = await pool.request()
          .input('kArtikel', kArtikel)
          .query(`
            SELECT 
              ms.cName as name,
              mws.cWert as wert
            FROM tArtikelMerkmal am
            INNER JOIN tMerkmalSprache ms ON am.kMerkmal = ms.kMerkmal
            LEFT JOIN tMerkmalWertSprache mws ON am.kMerkmalWert = mws.kMerkmalWert
            WHERE am.kArtikel = @kArtikel
              AND ms.kSprache = 1
              AND (mws.kSprache = 1 OR mws.kSprache IS NULL)
            ORDER BY ms.cName
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
        cKurzBeschreibung: cKurzBeschreibung,
        cBeschreibung: cBeschreibung,
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
    
    // Detaillierte Error Message für besseres Debugging
    let errorMessage = error.message || 'Unbekannter Fehler'
    
    // Spezifische Error-Typen
    if (error.message?.includes('not authorized')) {
      errorMessage = 'MongoDB Zugriffsfehler: Keine Berechtigung für die Datenbank. Bitte prüfen Sie die MongoDB-Konfiguration.'
    } else if (error.message?.includes('MONGO_URL')) {
      errorMessage = 'MongoDB nicht konfiguriert: MONGO_URL fehlt in den Environment Variables.'
    } else if (error.message?.includes('MSSQL') || error.message?.includes('SQL')) {
      errorMessage = 'JTL-Datenbank (MSSQL) nicht erreichbar. Artikel-Details können nur teilweise geladen werden.'
    }
    
    return NextResponse.json({
      ok: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}
