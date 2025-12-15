export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()
    
    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 })
    }
    
    const { db } = await connectToDatabase()
    const jobsCollection = db.collection('batch_jobs')
    
    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $set: { 
          status: 'cancelled',
          finished_at: new Date()
        }
      }
    )
    
    console.log(`[Cancel Job] Job ${jobId} cancelled`)
    
    return NextResponse.json({
      ok: true,
      cancelled: result.modifiedCount > 0
    })
    
  } catch (error: any) {
    console.error('[Cancel Job] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
