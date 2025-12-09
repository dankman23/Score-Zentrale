export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * GET /api/jtl/articles/import/status
 * Zeigt Import-Status aus MongoDB
 * OPTIMIERT: Besseres Error Handling, Fallback-Werte
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')

    // Zähle importierte Artikel - OPTIMIERT mit Timeout
    const totalImported = await articlesCollection.countDocuments({}, { maxTimeMS: 10000 })
    
    // Statistiken - OPTIMIERT mit Error Handling
    let statistics = {
      total: totalImported,
      mit_hersteller: 0,
      mit_warengruppe: 0,
      mit_lagerbestand: 0,
      durchschnitt_vk: '0.00',
      durchschnitt_ek: '0.00'
    }

    try {
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
      ], { maxTimeMS: 15000 }).toArray()

      if (stats[0]) {
        statistics = {
          total: stats[0].total || totalImported,
          mit_hersteller: stats[0].mit_hersteller || 0,
          mit_warengruppe: stats[0].mit_warengruppe || 0,
          mit_lagerbestand: stats[0].mit_lagerbestand || 0,
          durchschnitt_vk: (stats[0].durchschnitt_vk || 0).toFixed(2),
          durchschnitt_ek: (stats[0].durchschnitt_ek || 0).toFixed(2)
        }
      }
    } catch (statsError) {
      console.error('[Status] Statistiken konnten nicht geladen werden:', statsError)
      // Verwende Fallback-Werte
    }

    // Letzte importierte Artikel - OPTIMIERT mit Error Handling
    let lastImported: any[] = []
    try {
      const articles = await articlesCollection
        .find({}, { maxTimeMS: 5000 })
        .sort({ imported_at: -1 })
        .limit(5)
        .toArray()
      
      lastImported = articles.map(a => ({
        kArtikel: a.kArtikel,
        cArtNr: a.cArtNr || '',
        cName: a.cName || '',
        cHerstellerName: a.cHerstellerName || '',
        imported_at: a.imported_at
      }))
    } catch (lastError) {
      console.error('[Status] Letzte Artikel konnten nicht geladen werden:', lastError)
    }

    // Prüfe ob Import läuft (last_updated in den letzten 60 Sekunden)
    let isRunning = false
    try {
      const sixtySecondsAgo = new Date(Date.now() - 60000)
      const recentlyUpdated = await articlesCollection.countDocuments(
        { last_updated: { $gte: sixtySecondsAgo } },
        { maxTimeMS: 5000 }
      )
      isRunning = recentlyUpdated > 0 && totalImported < 166854
    } catch (runningError) {
      console.error('[Status] Running-Status konnte nicht geprüft werden:', runningError)
    }

    const target = 166854
    const percentage = totalImported > 0 ? ((totalImported / target) * 100).toFixed(1) : '0.0'

    return NextResponse.json({
      ok: true,
      imported: totalImported,
      running: isRunning,
      target,
      percentage,
      statistics,
      lastImported
    })

  } catch (error: any) {
    console.error('[Articles Import Status] Error:', error)
    
    // Fallback-Antwort bei totalem Fehler
    return NextResponse.json({
      ok: false,
      error: error.message || 'Fehler beim Laden des Status',
      imported: 0,
      running: false,
      target: 166854,
      percentage: '0.0',
      statistics: {
        total: 0,
        mit_hersteller: 0,
        mit_warengruppe: 0,
        mit_lagerbestand: 0,
        durchschnitt_vk: '0.00',
        durchschnitt_ek: '0.00'
      },
      lastImported: []
    }, { status: 500 })
  }
}
