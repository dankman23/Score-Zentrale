export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * GET /api/jtl/articles/import/status
 * Zeigt Import-Status aus MongoDB
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    // Zähle importierte Artikel
    const totalImported = await articlesCollection.countDocuments()
    
    // Statistiken
    const stats = await articlesCollection.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          mit_hersteller: { 
            $sum: { $cond: [{ $gt: ['$kHersteller', 0] }, 1, 0] } 
          },
          mit_warengruppe: { 
            $sum: { $cond: [{ $gt: ['$kWarengruppe', 0] }, 1, 0] } 
          },
          mit_lagerbestand: { 
            $sum: { $cond: [{ $gt: ['$nLagerbestand', 0] }, 1, 0] } 
          },
          durchschnitt_vk: { $avg: '$fVKNetto' },
          durchschnitt_ek: { $avg: '$fEKNetto' }
        }
      }
    ]).toArray()

    const statistics = stats[0] || {
      total: 0,
      mit_hersteller: 0,
      mit_warengruppe: 0,
      mit_lagerbestand: 0,
      durchschnitt_vk: 0,
      durchschnitt_ek: 0
    }

    // Letzte importierte Artikel
    const lastImported = await articlesCollection
      .find({})
      .sort({ imported_at: -1 })
      .limit(5)
      .toArray()

    // Prüfe ob Import läuft (last_updated in den letzten 30 Sekunden)
    const thirtySecondsAgo = new Date(Date.now() - 30000)
    const recentlyUpdated = await articlesCollection.countDocuments({
      last_updated: { $gte: thirtySecondsAgo }
    })
    const isRunning = recentlyUpdated > 0 && totalImported < 166854

    return NextResponse.json({
      ok: true,
      imported: totalImported,
      running: isRunning,
      target: 166854,
      percentage: ((totalImported / 166854) * 100).toFixed(1),
      statistics: {
        ...statistics,
        durchschnitt_vk: statistics.durchschnitt_vk?.toFixed(2) || '0.00',
        durchschnitt_ek: statistics.durchschnitt_ek?.toFixed(2) || '0.00'
      },
      lastImported: lastImported.map(a => ({
        kArtikel: a.kArtikel,
        cArtNr: a.cArtNr,
        cName: a.cName,
        cHerstellerName: a.cHerstellerName,
        imported_at: a.imported_at
      }))
    })

  } catch (error: any) {
    console.error('[Articles Import Status] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
