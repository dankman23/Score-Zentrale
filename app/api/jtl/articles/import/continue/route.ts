export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'
import { connectToDatabase } from '@/../lib/api'

/**
 * POST /api/jtl/articles/import/continue
 * Intelligenter Import - holt letzte kArtikel aus MongoDB und importiert ab da
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchSize = 5000 } = body

    const pool = await getMssqlPool()
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    // Letzte kArtikel-ID aus MongoDB holen
    const lastArticle = await articlesCollection.findOne(
      {},
      { sort: { kArtikel: -1 }, projection: { kArtikel: 1 } }
    )
    const lastKArtikel = lastArticle?.kArtikel || 0

    console.log(`[Continue Import] Starting from kArtikel > ${lastKArtikel}`)

    // Artikel ab lastKArtikel importieren
    const result = await pool.request().query(`
      SELECT TOP ${batchSize}
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
        ab.cName,
        ab.cKurzBeschreibung,
        h.cName as cHerstellerName,
        w.cName as cWarengruppenName
      FROM tArtikel a
      LEFT JOIN tArtikelBeschreibung ab ON a.kArtikel = ab.kArtikel AND ab.kSprache = 1
      LEFT JOIN tHersteller h ON a.kHersteller = h.kHersteller
      LEFT JOIN tWarengruppe w ON a.kWarengruppe = w.kWarengruppe
      WHERE a.cAktiv = 'Y'
        AND a.kStueckliste = 0
        AND (a.nIstVater = 1 OR a.kVaterArtikel = 0)
        AND a.kArtikel > ${lastKArtikel}
      ORDER BY a.kArtikel
    `)

    const articles = result.recordset

    if (articles.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        total: await articlesCollection.countDocuments(),
        finished: true,
        message: 'Import abgeschlossen'
      })
    }

    // Bulk upsert
    const bulkOps = articles.map(article => ({
      updateOne: {
        filter: { kArtikel: article.kArtikel },
        update: {
          $set: {
            kArtikel: article.kArtikel,
            cArtNr: article.cArtNr || '',
            cName: article.cName || article.cArtNr || 'Unbenannt',
            cKurzBeschreibung: article.cKurzBeschreibung || '',
            cBarcode: article.cBarcode || '',
            cHAN: article.cHAN || '',
            fVKNetto: parseFloat(article.fVKNetto) || 0,
            fEKNetto: parseFloat(article.fEKNetto) || 0,
            fUVP: parseFloat(article.fUVP) || 0,
            margin_percent: article.fVKNetto > 0 
              ? parseFloat(((article.fVKNetto - article.fEKNetto) / article.fVKNetto * 100).toFixed(2))
              : 0,
            nLagerbestand: parseFloat(article.nLagerbestand) || 0,
            nMindestbestellmaenge: parseFloat(article.nMindestbestellmaenge) || 0,
            fGewicht: parseFloat(article.fGewicht) || 0,
            kWarengruppe: article.kWarengruppe || 0,
            cWarengruppenName: article.cWarengruppenName || 'Keine Kategorie',
            kHersteller: article.kHersteller || 0,
            cHerstellerName: article.cHerstellerName || 'Kein Hersteller',
            kSteuerklasse: article.kSteuerklasse || 0,
            cAktiv: article.cAktiv === 'Y',
            nIstVater: article.nIstVater === 1,
            kVaterArtikel: article.kVaterArtikel || 0,
            dErstelldatum: article.dErstelldatum,
            last_updated: new Date()
          },
          $setOnInsert: {
            imported_at: new Date()
          }
        },
        upsert: true
      }
    }))

    if (bulkOps.length > 0) {
      await articlesCollection.bulkWrite(bulkOps)
    }

    const totalInDb = await articlesCollection.countDocuments()
    const hasMore = articles.length === batchSize

    console.log(`[Continue Import] Imported ${articles.length} articles. Total in DB: ${totalInDb}`)

    return NextResponse.json({
      ok: true,
      imported: articles.length,
      total: totalInDb,
      lastKArtikel: articles[articles.length - 1].kArtikel,
      finished: !hasMore,
      message: hasMore 
        ? `${articles.length} Artikel importiert. Weiter mit kArtikel > ${articles[articles.length - 1].kArtikel}` 
        : `Import abgeschlossen! ${totalInDb} Artikel insgesamt importiert.`
    })

  } catch (error: any) {
    console.error('[Continue Import] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
