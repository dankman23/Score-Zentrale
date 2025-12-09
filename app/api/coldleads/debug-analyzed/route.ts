export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../lib/mongodb'

/**
 * GET /api/coldleads/debug-analyzed
 * Debug: Warum werden analyzed Prospects nicht ausgewählt?
 */
export async function GET() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('prospects')
    
    // Prüfe verschiedene Queries
    const totalAnalyzed = await collection.countDocuments({ status: 'analyzed' })
    const withAnalysisV3 = await collection.countDocuments({ 'analysis_v3': { $exists: true } })
    const notSent = await collection.countDocuments({ 'followup_schedule.mail_1_sent': { $ne: true } })
    
    // Gleiche Query wie Autopilot
    const candidates = await collection.find({
      status: 'analyzed',  // WICHTIG: Muss analyzed sein!
      'analysis_v3': { $exists: true },
      'followup_schedule.mail_1_sent': { $ne: true },
      'autopilot_skip': { $ne: true }
    }).limit(10).toArray()
    
    const debug = {
      total_analyzed: totalAnalyzed,
      with_analysis_v3: withAnalysisV3,
      not_sent: notSent
    }
    
    const results = []
    
    for (const c of candidates) {
      const email = c.analysis_v3?.contact_person?.email
      const isValid = email && typeof email === 'string' && email.length > 5 && email.includes('@')
      
      results.push({
        company: c.company_name,
        status: c.status,
        email: email || null,
        email_type: typeof email,
        email_valid: isValid,
        mail_sent: c.followup_schedule?.mail_1_sent || false,
        autopilot_skip: c.autopilot_skip || false
      })
    }
    
    const validCount = results.filter(r => r.email_valid).length
    
    return NextResponse.json({
      ok: true,
      debug,
      total_candidates: results.length,
      valid_email_count: validCount,
      candidates: results
    })
    
  } catch (error: any) {
    console.error('[Debug] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
