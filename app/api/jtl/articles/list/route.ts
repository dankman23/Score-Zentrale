export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * GET /api/jtl/articles/list
 * Liste aller Artikel mit Filter & Pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const hersteller = searchParams.get('hersteller') || ''
    const warengruppe = searchParams.get('warengruppe') || ''
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
      imported_at: a.imported_at
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
