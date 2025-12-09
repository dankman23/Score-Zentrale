export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../lib/mongodb'

/**
 * POST /api/coldleads/migrate-no-email
 * Migriert alte 'analyzed' Prospects ohne E-Mail zu 'no_email'
 */
export async function POST() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('prospects')
    
    console.log('[Migration] Starte Migration: analyzed → no_email')
    
    // Hole ALLE analyzed Prospects
    const analyzedProspects = await collection.find({ status: 'analyzed' }).toArray()
    
    console.log(`[Migration] Gefunden: ${analyzedProspects.length} analyzed Prospects`)
    
    // Filtere: nur die OHNE gültige E-Mail
    const withoutEmail = []
    const withEmail = []
    
    for (const prospect of analyzedProspects) {
      const email = prospect.analysis_v3?.contact_person?.email
      const hasValidEmail = email && 
                           typeof email === 'string' && 
                           email.length > 5 && 
                           email.includes('@')
      
      if (hasValidEmail) {
        withEmail.push(prospect)
      } else {
        withoutEmail.push(prospect)
      }
    }
    
    console.log(`[Migration] Mit E-Mail: ${withEmail.length}`)
    console.log(`[Migration] Ohne E-Mail: ${withoutEmail.length}`)
    
    let migratedCount = 0
    
    if (withoutEmail.length > 0) {
      // Update zu 'no_email' Status
      const idsToUpdate = withoutEmail.map(p => p._id)
      
      const result = await collection.updateMany(
        { _id: { $in: idsToUpdate } },
        { 
          $set: { 
            status: 'no_email',
            migrated_at: new Date()
          } 
        }
      )
      
      migratedCount = result.modifiedCount
      console.log(`[Migration] ${migratedCount} Prospects migriert`)
    }
    
    // Hole neue Stats
    const stats = {
      new: await collection.countDocuments({ status: 'new' }),
      analyzed: await collection.countDocuments({ status: 'analyzed' }),
      no_email: await collection.countDocuments({ status: 'no_email' }),
      contacted: await collection.countDocuments({ status: 'contacted' })
    }
    
    console.log('[Migration] Neue Stats:', stats)
    
    return NextResponse.json({
      ok: true,
      migrated: migratedCount,
      stats,
      message: `${migratedCount} Prospects zu 'no_email' migriert`
    })
    
  } catch (error: any) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
