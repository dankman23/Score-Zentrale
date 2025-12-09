export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'
import { connectToDatabase } from '@/../lib/api'

/**
 * GET /api/jtl/articles/import/orphaned
 * Findet Artikel die in MongoDB aber nicht mehr in JTL vorhanden sind
 */
export async function GET() {
  try {
    const pool = await getMssqlPool()
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    console.log('[Orphaned Articles] Checking for articles no longer in JTL...')

    // ALLE kArtikel IDs aus JTL holen (aktiv UND inaktiv!)
    // Wichtig: Nur Artikel, die komplett aus JTL gelöscht wurden, sind "verwaist"
    const jtlResult = await pool.request().query(`
      SELECT kArtikel, cAktiv
      FROM tArtikel
      WHERE kStueckliste = 0
        AND (nIstVater = 1 OR kVaterArtikel = 0)
    `)

    const jtlArticleIds = new Set(jtlResult.recordset.map(r => r.kArtikel))
    const activeCount = jtlResult.recordset.filter(r => r.cAktiv === 'Y').length
    console.log(`[Orphaned Articles] JTL has ${jtlArticleIds.size} articles total (${activeCount} active, ${jtlArticleIds.size - activeCount} inactive)`)

    // Alle kArtikel aus MongoDB holen
    const mongoArticles = await articlesCollection.find({}, {
      projection: { kArtikel: 1, cArtNr: 1, cName: 1 }
    }).toArray()

    console.log(`[Orphaned Articles] MongoDB has ${mongoArticles.length} articles`)

    // Finde Artikel die in Mongo aber nicht in JTL sind
    const orphanedArticles = mongoArticles.filter(a => !jtlArticleIds.has(a.kArtikel))

    console.log(`[Orphaned Articles] Found ${orphanedArticles.length} orphaned articles`)

    return NextResponse.json({ 
      ok: true,
      orphanedCount: orphanedArticles.length,
      orphanedArticles: orphanedArticles.map(a => ({
        kArtikel: a.kArtikel,
        cArtNr: a.cArtNr,
        cName: a.cName
      }))
    })
  } catch (error: any) {
    console.error('[Orphaned Articles] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}

/**
 * DELETE /api/jtl/articles/import/orphaned
 * Löscht verwaiste Artikel aus MongoDB
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { kArtikelIds } = body

    if (!kArtikelIds || !Array.isArray(kArtikelIds)) {
      return NextResponse.json({ 
        ok: false, 
        error: 'kArtikelIds array required' 
      }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    // Lösche alle Artikel mit den angegebenen IDs
    const result = await articlesCollection.deleteMany({
      kArtikel: { $in: kArtikelIds }
    })

    console.log(`[Orphaned Articles] Deleted ${result.deletedCount} orphaned articles`)

    return NextResponse.json({ 
      ok: true,
      deletedCount: result.deletedCount
    })
  } catch (error: any) {
    console.error('[Orphaned Articles] Delete error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
