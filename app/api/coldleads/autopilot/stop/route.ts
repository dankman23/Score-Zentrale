export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/../lib/mongodb'

/**
 * POST /api/coldleads/autopilot/stop
 * Stoppt den Autopilot
 */
export async function POST() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('autopilot_state')
    
    await collection.updateOne(
      { id: 'kaltakquise' },
      { 
        $set: { 
          running: false,
          currentPhase: null,
          dailyCount: 0, // WICHTIG: Reset bei Stop (Session-basiert)
          lastActivity: new Date().toISOString()
        }
      }
    )
    
    console.log('[Autopilot] Stopped')
    
    return NextResponse.json({
      ok: true,
      message: 'Autopilot gestoppt'
    })
  } catch (error: any) {
    console.error('[Autopilot Stop] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
