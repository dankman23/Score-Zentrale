export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../lib/api'

/**
 * GET /api/jtl/articles/filters
 * Liefert verfügbare Filter-Optionen (Hersteller, Warengruppen)
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    // Unique Hersteller
    const hersteller = await articlesCollection
      .aggregate([
        { $group: { _id: '$cHerstellerName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 100 }
      ])
      .toArray()

    // Unique Warengruppen
    const warengruppen = await articlesCollection
      .aggregate([
        { $group: { _id: '$cWarengruppenName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 100 }
      ])
      .toArray()

    return NextResponse.json({
      ok: true,
      hersteller: hersteller.map(h => ({
        name: h._id,
        count: h.count
      })),
      warengruppen: warengruppen.map(w => ({
        name: w._id,
        count: w.count
      }))
    })

  } catch (error: any) {
    console.error('[Articles Filters] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
