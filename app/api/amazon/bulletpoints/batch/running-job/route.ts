export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * GET /api/amazon/bulletpoints/batch/running-job
 * 
 * Findet den aktuell laufenden Batch-Job (falls vorhanden)
 * Wird beim Seitenladen aufgerufen um laufende Jobs wiederzufinden
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const jobsCollection = db.collection('batch_jobs')
    
    // Finde den zuletzt aktiven Job (running oder pending)
    const runningJob = await jobsCollection.findOne(
      { status: { $in: ['running', 'pending'] } },
      { sort: { created_at: -1 } }
    )
    
    if (!runningJob) {
      return NextResponse.json({
        ok: true,
        job: null,
        message: 'Kein laufender Job gefunden'
      })
    }
    
    return NextResponse.json({
      ok: true,
      job: {
        id: runningJob._id.toString(),
        status: runningJob.status,
        total: runningJob.total || 0,
        processed: runningJob.processed || 0,
        succeeded: runningJob.succeeded || 0,
        failed: runningJob.failed || 0,
        started_at: runningJob.started_at,
        created_at: runningJob.created_at
      }
    })
    
  } catch (error: any) {
    console.error('[Running Job Check] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
