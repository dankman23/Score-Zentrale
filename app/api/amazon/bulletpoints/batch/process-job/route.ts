export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Minuten pro Chunk

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { getMssqlPool } from '@/lib/db/mssql'
import { ClaudeClient } from '@/lib/claude-client'
import { ObjectId } from 'mongodb'

/**
 * POST /api/amazon/bulletpoints/batch/process-job
 * Verarbeitet einen Batch-Job chunk-weise
 * Wird asynchron aufgerufen und läuft im Hintergrund
 */
export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()
    
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
    
    // Update Job Status zu 'running'
    await jobsCollection.updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $set: { 
          status: 'running',
          started_at: new Date()
        }
      }
    )
    
    console.log(`[Job ${jobId}] Starting processing of ${job.artikelIds.length} articles`)
    
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
    
    const pool = await getMssqlPool()
    const claude = new ClaudeClient()
    
    // Verarbeite in Chunks von 50 Artikeln
    const CHUNK_SIZE = 50
    let processed = 0
    let succeeded = 0
    let failed = 0
    const results: any[] = []
    
    for (let i = 0; i < job.artikelIds.length; i += CHUNK_SIZE) {
      const chunk = job.artikelIds.slice(i, i + CHUNK_SIZE)
      
      console.log(`[Job ${jobId}] Processing chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(job.artikelIds.length/CHUNK_SIZE)}`)
      
      // Verarbeite jeden Artikel im Chunk
      for (const kArtikel of chunk) {
        try {
          // 1. Lade Artikel aus MongoDB (wie generate API)
          const artikel = await articlesCollection.findOne({ kArtikel })
          
          if (!artikel) {
            throw new Error('Artikel nicht in MongoDB gefunden')
          }
          
          // Generiere Bulletpoints mit Claude
          const userPrompt = `
Artikel-Nr: ${artikel.cArtNr}
Name: ${artikel.cName}
Beschreibung: ${artikel.cBeschreibung || 'Keine Beschreibung'}
Kurzbeschreibung: ${artikel.cKurzBeschreibung || 'Keine Kurzbeschreibung'}
Hersteller: ${artikel.cHerstellerName || 'Unbekannt'}
          `.trim()
          
          const response = await claude.createMessage(
            [
              {
                role: 'user',
                content: userPrompt
              }
            ],
            selectedPrompt.prompt || '',  // Korrektur: Feld heißt 'prompt', nicht 'systemPrompt'
            2000
          )
          
          const bulletpointsRaw = response.content[0]?.text || ''
          const bullets = bulletpointsRaw.split(';').map(b => b.trim()).filter(b => b.length > 0)
          
          // Speichere Ergebnis
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
          
          succeeded++
          results.push({
            kArtikel,
            status: 'success',
            bulletpoints: bulletpointsRaw.substring(0, 100) + '...'
          })
          
        } catch (error: any) {
          failed++
          results.push({
            kArtikel,
            status: 'failed',
            error: error.message
          })
          console.error(`[Job ${jobId}] Failed for article ${kArtikel}:`, error.message)
        }
        
        processed++
        
        // Update Job Progress alle 10 Artikel
        if (processed % 10 === 0) {
          await jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            { 
              $set: { 
                processed,
                succeeded,
                failed,
                results: results.slice(-50) // Nur letzte 50 Ergebnisse speichern
              }
            }
          )
        }
      }
    }
    
    // Job abgeschlossen
    await jobsCollection.updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $set: { 
          status: 'completed',
          processed,
          succeeded,
          failed,
          results,
          finished_at: new Date()
        }
      }
    )
    
    console.log(`[Job ${jobId}] Completed! Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}`)
    
    return NextResponse.json({
      ok: true,
      jobId,
      processed,
      succeeded,
      failed
    })
    
  } catch (error: any) {
    console.error('[Job Worker] Error:', error)
    
    // Update Job zu failed
    if (request && request.json) {
      try {
        const { jobId } = await request.json()
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
        // Ignore
      }
    }
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
