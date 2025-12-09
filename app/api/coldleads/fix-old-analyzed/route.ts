export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../lib/mongodb'

/**
 * POST /api/coldleads/fix-old-analyzed
 * Fix: Alte Prospects mit analysis_v3 aber status='new' → 'analyzed' oder 'no_email'
 */
export async function POST() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('prospects')
    
    console.log('[Fix] Starte Fix für alte analyzed Prospects...')
    
    // Finde alle mit analysis_v3 aber status != 'analyzed' UND != 'no_email'
    const oldProspects = await collection.find({
      'analysis_v3': { $exists: true },
      'status': { $nin: ['analyzed', 'no_email', 'contacted'] }
    }).toArray()
    
    console.log(`[Fix] Gefunden: ${oldProspects.length} alte Prospects`)
    
    let toAnalyzed = 0
    let toNoEmail = 0
    
    for (const p of oldProspects) {
      const email = p.analysis_v3?.contact_person?.email
      const hasValid = email && typeof email === 'string' && email.length > 5 && email.includes('@')
      
      const newStatus = hasValid ? 'analyzed' : 'no_email'
      
      await collection.updateOne(
        { _id: p._id },
        { $set: { status: newStatus } }
      )
      
      if (hasValid) {
        toAnalyzed++
      } else {
        toNoEmail++
      }
    }
    
    console.log(`[Fix] ${toAnalyzed} → analyzed`)
    console.log(`[Fix] ${toNoEmail} → no_email`)
    
    // Neue Stats
    const stats = {
      new: await collection.countDocuments({ status: 'new' }),
      analyzed: await collection.countDocuments({ status: 'analyzed' }),
      no_email: await collection.countDocuments({ status: 'no_email' }),
      contacted: await collection.countDocuments({ status: 'contacted' })
    }
    
    return NextResponse.json({
      ok: true,
      fixed: oldProspects.length,
      to_analyzed: toAnalyzed,
      to_no_email: toNoEmail,
      stats
    })
    
  } catch (error: any) {
    console.error('[Fix] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
