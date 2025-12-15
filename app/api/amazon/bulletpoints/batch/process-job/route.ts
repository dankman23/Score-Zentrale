export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Minuten pro Chunk

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { ClaudeClient } from '@/lib/claude-client'
import { ObjectId } from 'mongodb'

/**
 * POST /api/amazon/bulletpoints/batch/process-job
 * 
 * VERBESSERTE VERSION mit rekursiver Verarbeitung:
 * - Verarbeitet 50 Artikel pro Aufruf
 * - Ruft sich selbst wieder auf wenn noch Artikel übrig sind
 * - Umgeht damit das 5-Minuten-Timeout
 */
export async function POST(request: NextRequest) {
  let jobId: string | null = null
  
  try {
    const body = await request.json()
    jobId = body.jobId
    
    if (!jobId) {
      return NextResponse.json({
        ok: false,
        error: 'jobId erforderlich'
      }, { status: 400 })
    }
    
    const { db } = await connectToDatabase()
    const jobsCollection = db.collection('batch_jobs')
    const articlesCollection = db.collection('articles')
    const bulletpointsCollection = db.collection('amazon_bulletpoints_generated')
    const promptsCollection = db.collection('amazon_bulletpoint_prompts')
    
    // Lade Job
    const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) })
    
    if (!job) {
      return NextResponse.json({
        ok: false,
        error: 'Job nicht gefunden'
      }, { status: 404 })
    }
    
    // Prüfe ob Job abgebrochen wurde
    if (job.status === 'cancelled') {
      console.log(`[Job ${jobId}] Job was cancelled, stopping`)
      return NextResponse.json({ ok: true, message: 'Job cancelled' })
    }
    
    // Update Job Status zu 'running' (falls noch pending)
    if (job.status === 'pending') {
      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { 
          $set: { 
            status: 'running',
            started_at: new Date()
          }
        }
      )
    }
    
    // Lade Prompt
    const selectedPrompt = await promptsCollection.findOne({ version: job.promptId })
    
    if (!selectedPrompt) {
      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { 
          $set: { 
            status: 'failed',
            error: `Prompt v${job.promptId} nicht gefunden`,
            finished_at: new Date()
          }
        }
      )
      return NextResponse.json({
        ok: false,
        error: `Prompt v${job.promptId} nicht gefunden`
      }, { status: 400 })
    }
    
    const claude = new ClaudeClient()
    
    // Hole aktuellen Fortschritt
    const startIndex = job.processed || 0
    const CHUNK_SIZE = 50
    
    // Bestimme welche Artikel in diesem Chunk verarbeitet werden
    const chunk = job.artikelIds.slice(startIndex, startIndex + CHUNK_SIZE)
    
    if (chunk.length === 0) {
      // Keine weiteren Artikel - Job abgeschlossen
      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { 
          $set: { 
            status: 'completed',
            finished_at: new Date()
          }
        }
      )
      console.log(`[Job ${jobId}] Completed! All articles processed.`)
      return NextResponse.json({
        ok: true,
        message: 'Job completed'
      })
    }
    
    console.log(`[Job ${jobId}] Processing chunk: ${startIndex} to ${startIndex + chunk.length} of ${job.artikelIds.length}`)
    
    let processed = startIndex
    let succeeded = job.succeeded || 0
    let failed = job.failed || 0
    const results = job.results || []
    
    // PARALLEL: Verarbeite 5 Artikel gleichzeitig
    const PARALLEL_COUNT = 5
    
    const processArticle = async (kArtikel: number) => {
      try {
        const artikel = await articlesCollection.findOne({ kArtikel })
        
        if (!artikel) {
          throw new Error('Artikel nicht in MongoDB gefunden')
        }
        
        const userPrompt = `
Artikel-Nr: ${artikel.cArtNr}
Name: ${artikel.cName}
Beschreibung: ${artikel.cBeschreibung || 'Keine Beschreibung'}
Kurzbeschreibung: ${artikel.cKurzBeschreibung || 'Keine Kurzbeschreibung'}
Hersteller: ${artikel.cHerstellerName || 'Unbekannt'}
        `.trim()
        
        const response = await claude.createMessage(
          [{ role: 'user', content: userPrompt }],
          selectedPrompt.prompt || '',
          2000
        )
        
        const bulletpointsRaw = response.content[0]?.text || ''
        const bullets = bulletpointsRaw.split(';').map((b: string) => b.trim()).filter((b: string) => b.length > 0)
        
        await bulletpointsCollection.updateOne(
          { kArtikel },
          {
            $set: {
              kArtikel,
              cArtNr: artikel.cArtNr,
              cName: artikel.cName,
              bulletpoints: bulletpointsRaw,
              bullets: bullets,
              generatedAt: new Date(),
              promptVersion: selectedPrompt.version,
              promptName: selectedPrompt.name,
              jobId
            }
          },
          { upsert: true }
        )
        
        return { kArtikel, status: 'success', bulletpoints: bulletpointsRaw.substring(0, 100) + '...' }
      } catch (error: any) {
        console.error(`[Job ${jobId}] Failed for article ${kArtikel}:`, error.message)
        return { kArtikel, status: 'failed', error: error.message }
      }
    }
    
    // Verarbeite in Batches von PARALLEL_COUNT
    for (let i = 0; i < chunk.length; i += PARALLEL_COUNT) {
      const batch = chunk.slice(i, i + PARALLEL_COUNT)
      const batchResults = await Promise.all(batch.map(processArticle))
      
      for (const result of batchResults) {
        if (result.status === 'success') {
          succeeded++
        } else {
          failed++
        }
        results.push(result)
        processed++
      }
      
      // Update Progress nach jedem Batch
      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { 
          $set: { 
            processed,
            succeeded,
            failed,
            results: results.slice(-50),
            updated_at: new Date()
          }
        }
      )
      
      console.log(`[Job ${jobId}] Batch done. Processed: ${processed}/${job.artikelIds.length} (${PARALLEL_COUNT}x parallel)`)
    }
    
    // Prüfe ob noch mehr Artikel zu verarbeiten sind
    if (processed < job.artikelIds.length) {
      // Rufe sich selbst wieder auf (Fire & Forget)
      const internalUrl = 'http://localhost:3000'
      fetch(`${internalUrl}/api/amazon/bulletpoints/batch/process-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      }).catch(err => {
        console.error(`[Job ${jobId}] Failed to continue:`, err.message)
      })
      
      return NextResponse.json({
        ok: true,
        message: 'Chunk processed, continuing...',
        processed,
        total: job.artikelIds.length
      })
    } else {
      // Job abgeschlossen
      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { 
          $set: { 
            status: 'completed',
            finished_at: new Date()
          }
        }
      )
      
      console.log(`[Job ${jobId}] COMPLETED! Total: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}`)
      
      return NextResponse.json({
        ok: true,
        message: 'Job completed',
        processed,
        succeeded,
        failed
      })
    }
    
  } catch (error: any) {
    console.error('[Job Worker] Error:', error)
    
    // Update Job zu failed
    if (jobId) {
      try {
        const { db } = await connectToDatabase()
        await db.collection('batch_jobs').updateOne(
          { _id: new ObjectId(jobId) },
          { 
            $set: { 
              status: 'failed',
              error: error.message,
              finished_at: new Date()
            }
          }
        )
      } catch (e) {
        console.error('[Job Worker] Could not update job status:', e)
      }
    }
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
