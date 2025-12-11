export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { ObjectId } from 'mongodb'

/**
 * GET /api/amazon/bulletpoints/batch/job-status?jobId=xxx
 * Gibt den Status eines Batch-Jobs zurück
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json({
        ok: false,
        error: 'jobId parameter erforderlich'
      }, { status: 400 })
    }
    
    const { db } = await connectToDatabase()
    const jobsCollection = db.collection('batch_jobs')
    
    const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) })
    
    if (!job) {
      return NextResponse.json({
        ok: false,
        error: 'Job nicht gefunden'
      }, { status: 404 })
    }
    
    const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0
    
    return NextResponse.json({
      ok: true,
      job: {
        id: job._id.toString(),
        status: job.status,
        total: job.total,
        processed: job.processed,
        succeeded: job.succeeded,
        failed: job.failed,
        progress,
        created_at: job.created_at,
        started_at: job.started_at,
        finished_at: job.finished_at,
        results: job.results || [],
        error: job.error
      }
    })
    
  } catch (error: any) {
    console.error('[Job Status] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
