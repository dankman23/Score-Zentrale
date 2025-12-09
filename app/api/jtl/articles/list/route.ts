export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../lib/api'

/**
 * GET /api/jtl/articles/list
 * Liste aller Artikel mit Filter & Pagination
 * OPTIMIERT: Besseres Error Handling, Performance-Verbesserungen
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')
    const bulletpointsCollection = db.collection('amazon_bulletpoints_generated')

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const hersteller = searchParams.get('hersteller') || ''
    const warengruppe = searchParams.get('warengruppe') || ''
    const abpFilter = searchParams.get('abp') || 'all' // 'all', 'generated', 'missing'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const sortBy = searchParams.get('sortBy') || 'cArtNr'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Filter-Query bauen
    const query: any = {}

    if (search) {
      query.$or = [
        { cArtNr: { $regex: search, $options: 'i' } },
        { cName: { $regex: search, $options: 'i' } },
        { cBarcode: { $regex: search, $options: 'i' } },
        { cHerstellerName: { $regex: search, $options: 'i' } }
      ]
    }

    if (hersteller && hersteller !== 'all') {
      query.cHerstellerName = hersteller
    }

    if (warengruppe && warengruppe !== 'all') {
      query.cWarengruppenName = warengruppe
    }

    // Sortierung
    const sort: any = {}
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Pagination
    const skip = (page - 1) * limit

    // ABP Filter: OPTIMIERT - Nur wenn nötig
    let artikelMitBulletpoints: Set<number> | null = null
    if (abpFilter !== 'all') {
      try {
        const bulletpoints = await bulletpointsCollection
          .find({}, { projection: { kArtikel: 1 } })
          .toArray()
        artikelMitBulletpoints = new Set(bulletpoints.map(bp => bp.kArtikel))
        
        if (abpFilter === 'generated') {
          query.kArtikel = { $in: Array.from(artikelMitBulletpoints) }
        } else if (abpFilter === 'missing') {
          query.kArtikel = { $nin: Array.from(artikelMitBulletpoints) }
        }
      } catch (e) {
        console.error('[Articles List] ABP Filter Fehler:', e)
        // Ignoriere Filter-Fehler und zeige alle Artikel
      }
    }

    // Query ausführen - OPTIMIERT mit Timeout
    const [articles, totalCount] = await Promise.all([
      articlesCollection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .maxTimeMS(30000) // 30 Sekunden Timeout
        .toArray(),
      articlesCollection.countDocuments(query, { maxTimeMS: 10000 })
    ])

    // Hole Bulletpoint-Status für die aktuellen Artikel - OPTIMIERT
    const kArtikelList = articles.map(a => a.kArtikel)
    let bulletpointsMap = new Map()
    
    if (kArtikelList.length > 0) {
      try {
        const bulletpointsForArticles = await bulletpointsCollection
          .find(
            { kArtikel: { $in: kArtikelList } },
            { projection: { kArtikel: 1 }, maxTimeMS: 5000 }
          )
          .toArray()
        bulletpointsMap = new Map(bulletpointsForArticles.map(bp => [bp.kArtikel, true]))
      } catch (e) {
        console.error('[Articles List] Bulletpoint-Status Fehler:', e)
        // Zeige Artikel trotzdem an
      }
    }

    // Formatierte Artikel
    const formattedArticles = articles.map(a => ({
      kArtikel: a.kArtikel,
      cArtNr: a.cArtNr || '',
      cName: a.cName || '',
      cKurzBeschreibung: a.cKurzBeschreibung || '',
      cBarcode: a.cBarcode || '',
      fVKNetto: a.fVKNetto || 0,
      fEKNetto: a.fEKNetto || 0,
      margin_percent: a.margin_percent || 0,
      nLagerbestand: a.nLagerbestand || 0,
      cHerstellerName: a.cHerstellerName || '',
      cWarengruppenName: a.cWarengruppenName || '',
      imported_at: a.imported_at,
      hasAmazonBulletpoints: bulletpointsMap.has(a.kArtikel)
    }))

    return NextResponse.json({
      ok: true,
      articles: formattedArticles,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      },
      filters: {
        search,
        hersteller,
        warengruppe,
        sortBy,
        sortOrder
      }
    })

  } catch (error: any) {
    console.error('[Articles List] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Fehler beim Laden der Artikel',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
