export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../../../lib/mongodb'

/**
 * GET /api/coldleads/autopilot/status
 * Gibt aktuellen Autopilot-Status zurück
 */
export async function GET() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('autopilot_state')
    
    let state = await collection.findOne({ id: 'kaltakquise' })
    
    // Initialisiere State falls nicht vorhanden
    if (!state) {
      state = {
        id: 'kaltakquise',
        running: false,
        dailyLimit: 50,
        dailyCount: 0,
        lastReset: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
        totalProcessed: 0,
        lastActivity: null,
        currentPhase: null,
        errors: []
      }
      await collection.insertOne(state)
    }
    
    // Reset daily count wenn neuer Tag
    const today = new Date().toISOString().slice(0, 10)
    if (state.lastReset !== today) {
      await collection.updateOne(
        { id: 'kaltakquise' },
        { 
          $set: { 
            dailyCount: 0, 
            lastReset: today 
          } 
        }
      )
      state.dailyCount = 0
      state.lastReset = today
    }
    
    return NextResponse.json({
      ok: true,
      state: {
        running: state.running,
        dailyLimit: state.dailyLimit,
        dailyCount: state.dailyCount,
        remaining: Math.max(0, state.dailyLimit - state.dailyCount),
        totalProcessed: state.totalProcessed,
        lastActivity: state.lastActivity,
        currentPhase: state.currentPhase,
        lastReset: state.lastReset
      }
    })
  } catch (error: any) {
    console.error('[Autopilot Status] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
