export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../lib/mongodb'

/**
 * POST /api/coldleads/autopilot/start
 * Startet den Autopilot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const dailyLimit = parseInt(body.dailyLimit) || 50
    
    if (dailyLimit < 1 || dailyLimit > 500) {
      return NextResponse.json({
        ok: false,
        error: 'Limit muss zwischen 1 und 500 liegen'
      }, { status: 400 })
    }
    
    const db = await connectToMongoDB()
    const collection = db.collection('autopilot_state')
    
    const today = new Date().toISOString().slice(0, 10)
    
    // Update oder erstelle State - Session-basiert, Counter wird bei jedem Start zurückgesetzt
    await collection.updateOne(
      { id: 'kaltakquise' },
      { 
        $set: { 
          running: true,
          dailyLimit,
          dailyCount: 0, // WICHTIG: Reset bei jedem Start (Session-basiert)
          lastActivity: new Date().toISOString(),
          currentPhase: 'idle',
          sessionStartedAt: new Date().toISOString()
        },
        $setOnInsert: {
          id: 'kaltakquise',
          lastReset: today,
          totalProcessed: 0,
          errors: []
        }
      },
      { upsert: true }
    )
    
    console.log(`[Autopilot] Started with session limit: ${dailyLimit}`)
    
    return NextResponse.json({
      ok: true,
      message: `Autopilot gestartet mit Session-Limit: ${dailyLimit} Emails`
    })
  } catch (error: any) {
    console.error('[Autopilot Start] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
