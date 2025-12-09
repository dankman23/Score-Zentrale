export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { connectToDatabase } from '../../../lib/api'

/**
 * POST /api/jtl/articles/import/merkmale
 * Importiert Merkmale für alle Artikel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchSize = 1000, offset = 0 } = body

    const pool = await getMssqlPool()
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    console.log(`[Merkmale Import] Starting: offset=${offset}, size=${batchSize}`)

    // Hole Artikel aus MongoDB (die bereits importiert sind)
    const articles = await articlesCollection
      .find({})
      .sort({ kArtikel: 1 })
      .skip(offset)
      .limit(batchSize)
      .toArray()

    if (articles.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        total: offset,
        finished: true,
        message: 'Alle Artikel haben Merkmale'
      })
    }

    const articleIds = articles.map(a => a.kArtikel)

    // Hole alle Merkmale für diese Artikel aus JTL
    const merkmaleResult = await pool.request().query(`
      SELECT 
        am.kArtikel,
        m.cName as MerkmalName,
        mw.cWert as MerkmalWert
      FROM tArtikelMerkmal am
      JOIN tMerkmalWert mw ON am.kMerkmalWert = mw.kMerkmalWert
      JOIN tMerkmal m ON mw.kMerkmal = m.kMerkmal
      WHERE am.kArtikel IN (${articleIds.join(',')})
      ORDER BY am.kArtikel, m.cName
    `)

    const merkmale = merkmaleResult.recordset

    // Gruppiere Merkmale nach Artikel
    const merkmalByArtikel: Record<number, Array<{name: string, wert: string}>> = {}
    for (const m of merkmale) {
      if (!merkmalByArtikel[m.kArtikel]) {
        merkmalByArtikel[m.kArtikel] = []
      }
      merkmalByArtikel[m.kArtikel].push({
        name: m.MerkmalName,
        wert: m.MerkmalWert
      })
    }

    // Update Artikel in MongoDB
    const bulkOps = articles.map(article => ({
      updateOne: {
        filter: { kArtikel: article.kArtikel },
        update: {
          $set: {
            merkmale: merkmalByArtikel[article.kArtikel] || [],
            merkmale_updated_at: new Date()
          }
        }
      }
    }))

    if (bulkOps.length > 0) {
      await articlesCollection.bulkWrite(bulkOps)
    }

    const nextOffset = offset + articles.length
    const hasMore = articles.length === batchSize

    console.log(`[Merkmale Import] Updated ${articles.length} articles with merkmale. Next offset: ${nextOffset}`)

    return NextResponse.json({
      ok: true,
      updated: articles.length,
      total: nextOffset,
      nextOffset: hasMore ? nextOffset : null,
      finished: !hasMore,
      message: hasMore 
        ? `${articles.length} Artikel aktualisiert. Weiter mit offset=${nextOffset}` 
        : `Merkmale-Import abgeschlossen! ${nextOffset} Artikel aktualisiert.`
    })

  } catch (error: any) {
    console.error('[Merkmale Import] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
