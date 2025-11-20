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
    const prospectsCollection = db.collection('prospects')
    
    // 1. Prüfe Autopilot State
    const state = await stateCollection.findOne({ id: 'kaltakquise' })
    
    if (!state || !state.running) {
      return NextResponse.json({
        ok: true,
        action: 'skip',
        reason: 'Autopilot nicht aktiv'
      })
    }
    
    // Session-basiert: Kein Reset mehr basierend auf Datum
    // Der Counter wird nur bei Start/Stop zurückgesetzt
    
    // Prüfe Session Limit
    if (state.dailyCount >= state.dailyLimit) {
      console.log(`[Autopilot Tick] Session limit reached: ${state.dailyCount}/${state.dailyLimit}`)
      return NextResponse.json({
        ok: true,
        action: 'limit_reached',
        dailyCount: state.dailyCount,
        dailyLimit: state.dailyLimit
      })
    }
    
    // 2. Hole ALLE Prospects mit analysis_v3 die noch nicht kontaktiert wurden
    const candidates = await prospectsCollection.find({
      status: 'analyzed',  // WICHTIG: Nur analyzed Prospects (mit E-Mail)!
      'analysis_v3': { $exists: true },
      'followup_schedule.mail_1_sent': { $ne: true },
      'autopilot_skip': { $ne: true }  // Skip failed Prospects
    }).limit(20).toArray()
    
    // Filtere die mit gültiger Email
    let nextProspect = null
    for (const candidate of candidates) {
      const email = candidate.analysis_v3?.contact_person?.email
      if (email && typeof email === 'string' && email.length > 5 && email.includes('@')) {
        nextProspect = candidate
        break
      }
    }
    
    console.log(`[Autopilot Tick] Found ${candidates.length} candidates, selected:`, nextProspect?.company_name || 'none')
    
    // Wenn keine analysierten Prospects vorhanden, suche neue Firmen
    if (!nextProspect) {
      console.log('[Autopilot Tick] No analyzed prospects, searching for new companies...')
      
      await stateCollection.updateOne(
        { id: 'kaltakquise' },
        { $set: { currentPhase: 'searching', lastActivity: new Date().toISOString() } }
      )
      
      // Importiere Search-Strategy
      const { getNextSearchQuery } = await import('../../../../../services/coldleads/search-strategy')
      
      // Hole letzte Such-Query aus State
      const lastQuery = state.lastSearchQuery || null
      const nextQuery = getNextSearchQuery(lastQuery)
      
      console.log(`[Autopilot Tick] Searching: ${nextQuery.industry} in ${nextQuery.region}`)
      
      // Führe DACH-Crawler aus (bessere Qualität, Stats werden aktualisiert)
      const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/coldleads/dach/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: 'DE',
          region: nextQuery.region,
          industry: nextQuery.industry,
          limit: nextQuery.limit || 5
        })
      })
      
      const searchResult = await searchResponse.json()
      
      if (!searchResult.ok || searchResult.count === 0) {
        console.log('[Autopilot Tick] Search failed or no results')
        
        // Speichere Query trotzdem für nächste Rotation
        await stateCollection.updateOne(
          { id: 'kaltakquise' },
          { 
            $set: { 
              lastSearchQuery: nextQuery,
              currentPhase: 'idle',
              lastActivity: new Date().toISOString()
            } 
          }
        )
        
        return NextResponse.json({
          ok: true,
          action: 'search_no_results',
          query: nextQuery
        })
      }
      
      console.log(`[Autopilot Tick] Found ${searchResult.count} new companies`)
      
      // Analysiere alle gefundenen Prospects
      await stateCollection.updateOne(
        { id: 'kaltakquise' },
        { $set: { currentPhase: 'analyzing', lastActivity: new Date().toISOString() } }
      )
      
      for (const prospect of searchResult.prospects) {
        try {
          console.log(`[Autopilot Tick] Analyzing ${prospect.company_name}...`)
          
          // Extrahiere Haupt-URL (ohne /impressum, /kontakt, etc.)
          let baseWebsite = prospect.website
          try {
            const url = new URL(prospect.website)
            baseWebsite = `${url.protocol}//${url.hostname}`
          } catch (e) {
            // Falls URL-Parsing fehlschlägt, nutze Original
            baseWebsite = prospect.website
          }
          
          // Nutze neue Deep-Analyze API mit Haupt-URL
          const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/coldleads/analyze-deep`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              website: baseWebsite,
              firmenname: prospect.company_name,
              branche: nextQuery.industry,
              prospectId: prospect.id || prospect._id?.toString()
            })
          })
          
          const result = await analyzeResponse.json()
          console.log(`[Autopilot] ${prospect.company_name}: ${result.ok ? 'OK' : 'FAILED'}`)
          
        } catch (error) {
          console.error(`[Autopilot Tick] Failed to analyze ${prospect.company_name}:`, error)
        }
      }
      
      // Speichere Query für nächste Rotation
      await stateCollection.updateOne(
        { id: 'kaltakquise' },
        { $set: { lastSearchQuery: nextQuery, currentPhase: 'idle' } }
      )
      
      // Hole nun ersten analysierten Prospect mit gültiger E-Mail
      const newCandidates = await prospectsCollection.find({
        'analysis_v3': { $exists: true },
        'followup_schedule.mail_1_sent': { $ne: true },
        'autopilot_skip': { $ne: true }
      }).limit(20).toArray()
      
      // Filtere die mit gültiger Email
      for (const candidate of newCandidates) {
        const email = candidate.analysis_v3?.contact_person?.email
        if (email && typeof email === 'string' && email.length > 5 && email.includes('@')) {
          nextProspect = candidate
          break
        }
      }
      
      if (!nextProspect) {
        return NextResponse.json({
          ok: true,
          action: 'analyzed_but_no_email',
          message: 'Firmen analysiert, aber keine gültige E-Mail gefunden'
        })
      }
    }
    
    console.log(`[Autopilot Tick] Processing prospect: ${nextProspect.company_name}`)
    const prospectId = nextProspect.id || nextProspect._id?.toString()
    console.log(`[Autopilot Tick] Using prospect_id: ${prospectId}`)
    
    // 3. Sende Email (Mail 1 - Erstansprache)
    await stateCollection.updateOne(
      { id: 'kaltakquise' },
      { $set: { currentPhase: 'sending_email', lastActivity: new Date().toISOString() } }
    )
    
    // Nutze neue V3 Email-Send API
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/coldleads/email-v3/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect_id: prospectId,
        mail_number: 1  // Erstansprache
      })
    })
    
    const emailResult = await emailResponse.json()
    
    if (!emailResult.ok) {
      console.error('[Autopilot Tick] Email failed:', emailResult.error)
      
      // Markiere Prospect als fehlgeschlagen und SKIP für Autopilot
      await prospectsCollection.updateOne(
        { $or: [
          { id: nextProspect.id },
          { _id: nextProspect._id }
        ]},
        { 
          $set: { 
            status: 'new', // Zurück zu 'new'
            email_error: emailResult.error,
            email_error_at: new Date(),
            email_failed_at: new Date(),
            autopilot_skip: true, // WICHTIG: Flag damit Autopilot ihn nicht wieder versucht!
            note: `Email-Versand fehlgeschlagen: ${emailResult.error}`
          } 
        }
      )
      
      console.log('[Autopilot Tick] Prospect marked as failed, continuing with next...')
      
      // NICHT mit Fehler returnen - stattdessen nochmal versuchen mit nächstem Prospect
      return NextResponse.json({
        ok: true,
        action: 'email_failed_continue',
        error: emailResult.error,
        prospect: nextProspect.company_name,
        message: 'Email failed, will try next prospect'
      })
    }
    
    console.log(`[Autopilot] Email sent to ${nextProspect.company_name}, follow-ups scheduled`)
    
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
