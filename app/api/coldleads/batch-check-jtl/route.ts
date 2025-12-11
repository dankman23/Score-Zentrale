export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Minuten

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { checkJTLCustomerMatch } from '@/lib/jtl-customer-matcher'

/**
 * GET /api/coldleads/batch-check-jtl
 * Batch-Check: Prüft ALLE Prospects (analyzed, contacted, new) auf JTL-Kunden-Match
 * 
 * Query-Params:
 * - status: Nur Prospects mit diesem Status prüfen (optional)
 * - limit: Max Anzahl zu prüfender Prospects (default: 100)
 * - force: Auch bereits geprüfte erneut prüfen (default: false)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = request.nextUrl
    const statusFilter = searchParams.get('status') // optional: 'analyzed', 'contacted', 'new'
    const limit = parseInt(searchParams.get('limit') || '100')
    const force = searchParams.get('force') === 'true'
    
    console.log(`[Batch-JTL-Check] Starting... (status=${statusFilter || 'all'}, limit=${limit}, force=${force})`)
    
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    
    // Build Query
    const query: any = {}
    
    if (statusFilter) {
      query.status = statusFilter
    }
    
    // Nur Prospects ohne Check ODER force=true
    if (!force) {
      query['jtl_customer_match'] = { $exists: false }
    }
    
    // Lade Prospects
    const prospects = await prospectsCollection.find(query)
      .limit(limit)
      .toArray()
    
    console.log(`[Batch-JTL-Check] Found ${prospects.length} prospects to check`)
    
    if (prospects.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Keine Prospects zum Prüfen gefunden',
        checked: 0,
        matches: 0,
        moved_to_customer: 0
      })
    }
    
    let matchCount = 0
    let movedToCustomer = 0
    let errorCount = 0
    const matches: any[] = []
    
    for (const prospect of prospects) {
      try {
        const email = prospect.analysis_v3?.contact_person?.email || prospect.email
        
        console.log(`[Batch-JTL-Check] Checking: ${prospect.company_name}`)
        
        const matchResult = await checkJTLCustomerMatch(
          prospect.company_name,
          prospect.website,
          email
        )
        
        // Update Prospect in DB
        const updateData: any = {
          jtl_customer_match: matchResult,
          updated_at: new Date()
        }
        
        // Falls Match: Markiere als Kunde & Skip im Autopilot
        if (matchResult.matched) {
          updateData.status = 'customer'
          updateData.autopilot_skip = true
          
          matchCount++
          movedToCustomer++
          
          matches.push({
            prospect: prospect.company_name,
            website: prospect.website,
            jtlCustomer: matchResult.jtlCustomer?.cFirma,
            confidence: matchResult.confidence,
            matchType: matchResult.matchType,
            previousStatus: prospect.status
          })
          
          console.log(`[Batch-JTL-Check] ✅ MATCH! ${prospect.company_name} -> ${matchResult.jtlCustomer?.cFirma} (${matchResult.confidence}%)`)
        }
        
        await prospectsCollection.updateOne(
          { _id: prospect._id },
          { $set: updateData }
        )
        
      } catch (error: any) {
        console.error(`[Batch-JTL-Check] Error checking ${prospect.company_name}:`, error.message)
        errorCount++
      }
    }
    
    const duration = Date.now() - startTime
    
    console.log(`[Batch-JTL-Check] ✅ Complete!`)
    console.log(`[Batch-JTL-Check]    Checked: ${prospects.length}`)
    console.log(`[Batch-JTL-Check]    Matches: ${matchCount}`)
    console.log(`[Batch-JTL-Check]    Moved to Customer: ${movedToCustomer}`)
    console.log(`[Batch-JTL-Check]    Errors: ${errorCount}`)
    console.log(`[Batch-JTL-Check]    Duration: ${duration}ms`)
    
    return NextResponse.json({
      ok: true,
      checked: prospects.length,
      matches: matchCount,
      moved_to_customer: movedToCustomer,
      errors: errorCount,
      duration_ms: duration,
      matches_detail: matches
    })
    
  } catch (error: any) {
    console.error('[Batch-JTL-Check] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
