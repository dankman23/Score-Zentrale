export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/app/lib/db/mongodb'

/**
 * GET /api/jtl/articles/list
 * Liste aller Artikel mit Filter & Pagination
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const articlesCollection = db.collection('articles')
    const bulletpointsCollection = db.collection('amazon_bulletpoints_generated')

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const hersteller = searchParams.get('hersteller') || ''
    const warengruppe = searchParams.get('warengruppe') || ''
    const abpFilter = searchParams.get('abp') || 'all' // 'all', 'generated', 'missing'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
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

    // ABP Filter: Hole alle kArtikel mit generierten Bulletpoints
    let artikelMitBulletpoints: Set<number> | null = null
    if (abpFilter !== 'all') {
      const bulletpoints = await bulletpointsCollection
        .find({}, { projection: { kArtikel: 1 } })
        .toArray()
      artikelMitBulletpoints = new Set(bulletpoints.map(bp => bp.kArtikel))
      
      if (abpFilter === 'generated') {
        // Nur Artikel MIT Bulletpoints
        query.kArtikel = { $in: Array.from(artikelMitBulletpoints) }
      } else if (abpFilter === 'missing') {
        // Nur Artikel OHNE Bulletpoints
        query.kArtikel = { $nin: Array.from(artikelMitBulletpoints) }
      }
    }

    // Query ausführen
    const [articles, totalCount] = await Promise.all([
      articlesCollection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      articlesCollection.countDocuments(query)
    ])

    // Hole Bulletpoint-Status für die aktuellen Artikel
    const kArtikelList = articles.map(a => a.kArtikel)
    const bulletpointsForArticles = await bulletpointsCollection
      .find({ kArtikel: { $in: kArtikelList } })
      .toArray()
    const bulletpointsMap = new Map(bulletpointsForArticles.map(bp => [bp.kArtikel, true]))

    // Formatierte Artikel
    const formattedArticles = articles.map(a => ({
      kArtikel: a.kArtikel,
      cArtNr: a.cArtNr,
      cName: a.cName,
      cKurzBeschreibung: a.cKurzBeschreibung,
      cBarcode: a.cBarcode,
      fVKNetto: a.fVKNetto,
      fEKNetto: a.fEKNetto,
      margin_percent: a.margin_percent,
      nLagerbestand: a.nLagerbestand,
      cHerstellerName: a.cHerstellerName,
      cWarengruppenName: a.cWarengruppenName,
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
      error: error.message
    }, { status: 500 })
  }
}
