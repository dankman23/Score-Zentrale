export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Max 60 Sekunden

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../../../lib/mongodb'

/**
 * POST /api/coldleads/autopilot/tick
 * Verarbeitet EINEN Prospect im Autopilot-Modus
 * 
 * Workflow:
 * 1. Prüfe ob Autopilot läuft & Limit nicht erreicht
 * 2. Hole nächsten unbearbeiteten Prospect (status=new)
 * 3. Wenn keiner vorhanden: Suche neue Firmen
 * 4. Analysiere Prospect
 * 5. Sende Email
 * 6. Update Counters
 */
export async function POST() {
  const startTime = Date.now()
  
  try {
    const db = await connectToMongoDB()
    const stateCollection = db.collection('autopilot_state')
    const prospectsCollection = db.collection('cold_prospects')
    
    // 1. Prüfe Autopilot State
    const state = await stateCollection.findOne({ id: 'kaltakquise' })
    
    if (!state || !state.running) {
      return NextResponse.json({
        ok: true,
        action: 'skip',
        reason: 'Autopilot nicht aktiv'
      })
    }
    
    // Reset daily count wenn neuer Tag
    const today = new Date().toISOString().slice(0, 10)
    if (state.lastReset !== today) {
      await stateCollection.updateOne(
        { id: 'kaltakquise' },
        { $set: { dailyCount: 0, lastReset: today } }
      )
      state.dailyCount = 0
    }
    
    // Prüfe Daily Limit
    if (state.dailyCount >= state.dailyLimit) {
      console.log(`[Autopilot Tick] Daily limit reached: ${state.dailyCount}/${state.dailyLimit}`)
      return NextResponse.json({
        ok: true,
        action: 'limit_reached',
        dailyCount: state.dailyCount,
        dailyLimit: state.dailyLimit
      })
    }
    
    // 2. Hole nächsten Prospect der analysiert aber noch nicht kontaktiert wurde
    const nextProspect = await prospectsCollection.findOne({
      status: 'analyzed',
      email_sent_at: { $exists: false }
    })
    
    if (!nextProspect) {
      console.log('[Autopilot Tick] No analyzed prospects ready to contact')
      return NextResponse.json({
        ok: true,
        action: 'no_prospects',
        message: 'Keine analysierten Prospects bereit zum Kontaktieren'
      })
    }
    
    console.log(`[Autopilot Tick] Processing prospect: ${nextProspect.company_name}`)
    
    // 3. Sende Email
    await stateCollection.updateOne(
      { id: 'kaltakquise' },
      { $set: { currentPhase: 'sending_email', lastActivity: new Date().toISOString() } }
    )
    
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/coldleads/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website: nextProspect.website,
        send: true
      })
    })
    
    const emailResult = await emailResponse.json()
    
    if (!emailResult.ok) {
      console.error('[Autopilot Tick] Email failed:', emailResult.error)
      
      // Markiere Prospect als fehlgeschlagen
      await prospectsCollection.updateOne(
        { _id: nextProspect._id },
        { 
          $set: { 
            email_error: emailResult.error,
            email_error_at: new Date()
          } 
        }
      )
      
      return NextResponse.json({
        ok: false,
        action: 'email_failed',
        error: emailResult.error,
        prospect: nextProspect.company_name
      })
    }
    
    // 4. Update Counters
    await stateCollection.updateOne(
      { id: 'kaltakquise' },
      { 
        $inc: { dailyCount: 1, totalProcessed: 1 },
        $set: { 
          currentPhase: 'idle',
          lastActivity: new Date().toISOString()
        }
      }
    )
    
    const duration = Date.now() - startTime
    console.log(`[Autopilot Tick] Successfully processed ${nextProspect.company_name} in ${duration}ms`)
    
    return NextResponse.json({
      ok: true,
      action: 'email_sent',
      prospect: {
        company_name: nextProspect.company_name,
        website: nextProspect.website
      },
      dailyCount: state.dailyCount + 1,
      dailyLimit: state.dailyLimit,
      duration
    })
    
  } catch (error: any) {
    console.error('[Autopilot Tick] Error:', error)
    
    // Log Error im State
    try {
      const db = await connectToMongoDB()
      await db.collection('autopilot_state').updateOne(
        { id: 'kaltakquise' },
        { 
          $set: { currentPhase: 'error', lastActivity: new Date().toISOString() },
          $push: { 
            errors: { 
              $each: [{ message: error.message, timestamp: new Date().toISOString() }],
              $slice: -10 // Behalte nur letzte 10 Fehler
            }
          }
        }
      )
    } catch (e) {
      console.error('[Autopilot Tick] Failed to log error:', e)
    }
    
    return NextResponse.json({ 
      ok: false,
      action: 'error',
      error: error.message 
    }, { status: 500 })
  }
}
