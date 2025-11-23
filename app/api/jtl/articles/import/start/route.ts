export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Minuten Timeout

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { connectToDatabase } from '@/lib/api'

/**
 * POST /api/jtl/articles/import/start
 * Startet Artikel-Import in Batches
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      batchSize = 1000,
      offset = 0,
      fullImport = false 
    } = body

    const pool = await getMssqlPool()
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    console.log(`[Articles Import] Starting batch import: offset=${offset}, size=${batchSize}, fullImport=${fullImport}`)

    // WICHTIG: Bei fullImport werden Artikel NICHT gelöscht, sondern nur aktualisiert!
    // Dies bewahrt zusätzliche Felder, die hier an Produkte angehängt wurden.
    // MongoDB upsert: true sorgt für Update bei existierenden und Insert bei neuen Artikeln.

    // Artikel mit allen Joins abrufen
    const result = await pool.request().query(`
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
        a.kWarengruppe,
        a.kHersteller,
        a.kSteuerklasse,
        a.cAktiv,
        a.kStueckliste,
        a.nIstVater,
        a.kVaterArtikel,
        a.dErstelldatum,
        
        -- Artikelname aus tArtikelBeschreibung
        ab.cName,
        ab.cKurzBeschreibung,
        ab.cBeschreibung,
        
        -- Hersteller-Name
        h.cName as cHerstellerName,
        
        -- Warengruppe-Name
        w.cName as cWarengruppenName
        
      FROM tArtikel a
      LEFT JOIN tArtikelBeschreibung ab ON a.kArtikel = ab.kArtikel AND ab.kSprache = 1
      LEFT JOIN tHersteller h ON a.kHersteller = h.kHersteller
      LEFT JOIN tWarengruppe w ON a.kWarengruppe = w.kWarengruppe
      
      WHERE a.cAktiv = 'Y'
        AND a.kStueckliste = 0
        AND (a.nIstVater = 1 OR a.kVaterArtikel = 0)
      
      ORDER BY a.kArtikel
      OFFSET ${offset} ROWS
      FETCH NEXT ${batchSize} ROWS ONLY
    `)

    const articles = result.recordset

    if (articles.length === 0) {
      console.log('[Articles Import] No more articles to import')
      return NextResponse.json({
        ok: true,
        imported: 0,
        total: offset,
        finished: true,
        message: 'Import abgeschlossen'
      })
    }

    // Lade ALLE Merkmale für diesen Batch auf einmal (effizient)
    console.log(`[Articles Import] Loading Merkmale for ${articles.length} articles...`)
    const kArtikelList = articles.map(a => a.kArtikel).join(',')
    
    const merkmaleResult = await pool.request().query(`
      SELECT 
        am.kArtikel,
        COALESCE(m.cName, '') as name,
        COALESCE(mw.cWert, '') as wert
      FROM tArtikelMerkmal am
      INNER JOIN tMerkmal m ON am.kMerkmal = m.kMerkmal
      LEFT JOIN tMerkmalWert mw ON am.kMerkmalWert = mw.kMerkmalWert
      WHERE am.kArtikel IN (${kArtikelList})
      ORDER BY am.kArtikel, COALESCE(m.nSort, 999), m.cName
    `)

    // Gruppiere Merkmale nach kArtikel
    const merkmaleByArtikel = {}
    for (const m of merkmaleResult.recordset) {
      if (!merkmaleByArtikel[m.kArtikel]) {
        merkmaleByArtikel[m.kArtikel] = []
      }
      merkmaleByArtikel[m.kArtikel].push({
        name: m.name,
        wert: m.wert || ''
      })
    }

    // Lade ALLE Attribute für diesen Batch auf einmal
    console.log(`[Articles Import] Loading Attribute for ${articles.length} articles...`)
    const attributeResult = await pool.request().query(`
      SELECT 
        aa.kArtikel,
        a.cName as name,
        aa.cWert as wert
      FROM tArtikelAttribut aa
      INNER JOIN tAttribut a ON aa.kAttribut = a.kAttribut
      WHERE aa.kArtikel IN (${kArtikelList})
      ORDER BY aa.kArtikel, a.nSort, a.cName
    `)

    // Gruppiere Attribute nach kArtikel
    const attributeByArtikel = {}
    for (const attr of attributeResult.recordset) {
      if (!attributeByArtikel[attr.kArtikel]) {
        attributeByArtikel[attr.kArtikel] = []
      }
      attributeByArtikel[attr.kArtikel].push({
        name: attr.name,
        wert: attr.wert || ''
      })
    }

    console.log(`[Articles Import] Loaded ${merkmaleResult.recordset.length} Merkmale and ${attributeResult.recordset.length} Attribute`)

    // Artikel in MongoDB speichern mit Upsert
    // $set: Felder, die bei jedem Update überschrieben werden (JTL-Daten)
    // $setOnInsert: Felder nur beim ersten Insert (z.B. imported_at)
    // Zusätzliche custom Felder (die hier angehängt wurden) bleiben erhalten!
    const bulkOps = articles.map(article => ({
      updateOne: {
        filter: { kArtikel: article.kArtikel },
        update: {
          $set: {
            // Basis-Daten (immer aktualisieren)
            kArtikel: article.kArtikel,
            cArtNr: article.cArtNr || '',
            cName: article.cName || article.cArtNr || 'Unbenannt',
            cKurzBeschreibung: article.cKurzBeschreibung || '',
            cBeschreibung: article.cBeschreibung || '',
            cBarcode: article.cBarcode || '',
            cHAN: article.cHAN || '',
            
            // Merkmale & Attribute (immer aktualisieren)
            merkmale: merkmaleByArtikel[article.kArtikel] || [],
            attribute: attributeByArtikel[article.kArtikel] || [],
            
            // Preise (immer aktualisieren)
            fVKNetto: parseFloat(article.fVKNetto) || 0,
            fEKNetto: parseFloat(article.fEKNetto) || 0,
            fUVP: parseFloat(article.fUVP) || 0,
            margin_percent: article.fVKNetto > 0 
              ? parseFloat(((article.fVKNetto - article.fEKNetto) / article.fVKNetto * 100).toFixed(2))
              : 0,
            
            // Lager (immer aktualisieren)
            nLagerbestand: parseFloat(article.nLagerbestand) || 0,
            nMindestbestellmaenge: parseFloat(article.nMindestbestellmaenge) || 0,
            fGewicht: parseFloat(article.fGewicht) || 0,
            
            // Zuordnungen (immer aktualisieren)
            kWarengruppe: article.kWarengruppe || 0,
            cWarengruppenName: article.cWarengruppenName || 'Keine Kategorie',
            kHersteller: article.kHersteller || 0,
            cHerstellerName: article.cHerstellerName || 'Kein Hersteller',
            kSteuerklasse: article.kSteuerklasse || 0,
            
            // Flags (immer aktualisieren)
            cAktiv: article.cAktiv === 'Y',
            nIstVater: article.nIstVater === 1,
            kVaterArtikel: article.kVaterArtikel || 0,
            dErstelldatum: article.dErstelldatum,
            
            // Update-Timestamp
            last_updated: new Date()
          },
          $setOnInsert: {
            // Nur beim ersten Insert setzen
            imported_at: new Date()
          }
        },
        upsert: true
      }
    }))

    if (bulkOps.length > 0) {
      await articlesCollection.bulkWrite(bulkOps)
    }

    const nextOffset = offset + articles.length
    const hasMore = articles.length === batchSize

    console.log(`[Articles Import] Imported ${articles.length} articles. Next offset: ${nextOffset}`)

    return NextResponse.json({
      ok: true,
      imported: articles.length,
      total: nextOffset,
      nextOffset: hasMore ? nextOffset : null,
      finished: !hasMore,
      message: hasMore 
        ? `${articles.length} Artikel importiert. Weiter mit offset=${nextOffset}` 
        : `Import abgeschlossen! ${nextOffset} Artikel insgesamt importiert.`
    })

  } catch (error: any) {
    console.error('[Articles Import] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
