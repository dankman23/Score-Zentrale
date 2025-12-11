export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * POST /api/amazon/bulletpoints/batch/start-job
 * Startet einen asynchronen Batch-Job für 1000+ Artikel
 * Gibt sofort eine Job-ID zurück, Status kann abgerufen werden
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kArtikel: kArtikelList, filter, limit, promptId } = body
    
    const { db } = await connectToDatabase()
    const jobsCollection = db.collection('batch_jobs')
    const articlesCollection = db.collection('articles')
    
    let artikelIds: number[] = []
    
    // Artikel-IDs ermitteln
    if (kArtikelList && Array.isArray(kArtikelList)) {
      artikelIds = kArtikelList
    } else if (filter) {
      const query: any = {}
      
      if (filter.search) {
        query.$or = [
          { cArtNr: { $regex: filter.search, $options: 'i' } },
          { cName: { $regex: filter.search, $options: 'i' } },
          { cBarcode: { $regex: filter.search, $options: 'i' } },
          { cHerstellerName: { $regex: filter.search, $options: 'i' } }
        ]
      }
      
      if (filter.hersteller && filter.hersteller !== 'all') {
        query.cHerstellerName = filter.hersteller
      }
      
      if (filter.warengruppe && filter.warengruppe !== 'all') {
        query.cWarengruppenName = filter.warengruppe
      }
      
      const articles = await articlesCollection
        .find(query)
        .limit(limit || 10000) // Max 10000 Artikel - Async-Job-System kann unbegrenzt verarbeiten
        .project({ kArtikel: 1 })
        .toArray()
      
      artikelIds = articles.map(a => a.kArtikel)
    }
    
    if (artikelIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Artikel gefunden'
      }, { status: 400 })
    }
    
    // Erstelle Job in MongoDB
    const job = {
      type: 'bulletpoints_batch',
      status: 'pending',
      artikelIds,
      promptId: parseInt(promptId) || 2,
      total: artikelIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      created_at: new Date(),
      started_at: null,
      finished_at: null
    }
    
    const result = await jobsCollection.insertOne(job)
    const jobId = result.insertedId.toString()
    
    console.log(`[Batch Job] Created job ${jobId} for ${artikelIds.length} articles`)
    
    // Starte Job asynchron (Fire & Forget)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/amazon/bulletpoints/batch/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    }).catch(err => {
      console.error('[Batch Job] Failed to start worker:', err.message)
    })
    
    return NextResponse.json({
      ok: true,
      jobId,
      total: artikelIds.length,
      message: `Job gestartet für ${artikelIds.length} Artikel. Verwende /api/amazon/bulletpoints/batch/job-status?jobId=${jobId} um den Status abzurufen.`
    })
    
  } catch (error: any) {
    console.error('[Batch Job] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
