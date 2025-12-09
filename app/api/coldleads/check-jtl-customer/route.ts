export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { checkJTLCustomerMatch } from '@/lib/jtl-customer-matcher'
import { connectToDatabase } from '@/lib/api'
import { buildProspectQuery } from '@/lib/prospect-utils'

/**
 * POST /api/coldleads/check-jtl-customer
 * Prüft ob ein Prospect bereits als JTL-Kunde existiert
 * 
 * Body:
 * - prospect_id: ID des Prospects (optional)
 * - company_name: Firmenname (required wenn kein prospect_id)
 * - website: Website-URL (required wenn kein prospect_id)
 * - email: Email-Adresse (optional)
 * - update_prospect: Boolean - Soll der Prospect aktualisiert werden? (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prospect_id, company_name, website, email, update_prospect = true } = body
    
    let prospectData: any = {
      company_name,
      website,
      email
    }
    
    // Falls prospect_id gegeben, lade aus DB
    if (prospect_id) {
      const { db } = await connectToDatabase()
      const prospectsCollection = db.collection('prospects')
      
      const query = buildProspectQuery(prospect_id)
      const prospect = await prospectsCollection.findOne(query)
      
      if (!prospect) {
        return NextResponse.json({
          ok: false,
          error: 'Prospect nicht gefunden'
        }, { status: 404 })
      }
      
      prospectData = {
        company_name: prospect.company_name,
        website: prospect.website,
        email: prospect.analysis_v3?.contact_person?.email || prospect.email
      }
    }
    
    // Validierung
    if (!prospectData.company_name || !prospectData.website) {
      return NextResponse.json({
        ok: false,
        error: 'company_name und website sind erforderlich'
      }, { status: 400 })
    }
    
    console.log(`[CheckJTL] Checking: ${prospectData.company_name}`)
    
    // JTL-Customer-Match prüfen
    const matchResult = await checkJTLCustomerMatch(
      prospectData.company_name,
      prospectData.website,
      prospectData.email
    )
    
    // Falls Match gefunden UND update_prospect=true: Prospect aktualisieren
    if (matchResult.matched && update_prospect && prospect_id) {
      const { db } = await connectToDatabase()
      const prospectsCollection = db.collection('prospects')
      
      const query = buildProspectQuery(prospect_id)
      
      await prospectsCollection.updateOne(query, {
        $set: {
          jtl_customer_match: matchResult,
          status: 'customer', // Markiere als Kunde
          autopilot_skip: true, // Skip im Autopilot
          updated_at: new Date()
        }
      })
      
      console.log(`[CheckJTL] ✅ Prospect als Kunde markiert (kKunde: ${matchResult.jtlCustomer?.kKunde})`)
    }
    
    return NextResponse.json({
      ok: true,
      match: matchResult
    })
    
  } catch (error: any) {
    console.error('[CheckJTL] Error:', error)
    
    let errorMessage = error.message || 'JTL-Check fehlgeschlagen'
    let statusCode = 500
    
    if (error.message?.includes('MSSQL') || error.message?.includes('connection')) {
      errorMessage = 'JTL-Datenbankverbindung fehlgeschlagen'
      statusCode = 503
    }
    
    return NextResponse.json({
      ok: false,
      error: errorMessage,
      errorType: error.name || 'Error'
    }, { status: statusCode })
  }
}

/**
 * GET /api/coldleads/check-jtl-customer
 * Batch-Check aller Prospects ohne JTL-Match
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[CheckJTL Batch] Starting batch check...')
    
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    
    // Lade alle analysierten Prospects OHNE JTL-Check
    const prospects = await prospectsCollection.find({
      status: 'analyzed',
      jtl_customer_match: { $exists: false }
    }).limit(50).toArray() // Limit für Performance
    
    console.log(`[CheckJTL Batch] Found ${prospects.length} prospects to check`)
    
    let matchCount = 0
    const results = []
    
    for (const prospect of prospects) {
      const email = prospect.analysis_v3?.contact_person?.email || prospect.email
      
      const matchResult = await checkJTLCustomerMatch(
        prospect.company_name,
        prospect.website,
        email
      )
      
      // Update Prospect
      await prospectsCollection.updateOne(
        { _id: prospect._id },
        {
          $set: {
            jtl_customer_match: matchResult,
            ...(matchResult.matched && {
              status: 'customer',
              autopilot_skip: true
            }),
            updated_at: new Date()
          }
        }
      )
      
      if (matchResult.matched) {
        matchCount++
        results.push({
          prospect: prospect.company_name,
          jtlCustomer: matchResult.jtlCustomer?.cFirma,
          confidence: matchResult.confidence
        })
      }
    }
    
    console.log(`[CheckJTL Batch] ✅ Complete! ${matchCount}/${prospects.length} matches found`)
    
    return NextResponse.json({
      ok: true,
      checked: prospects.length,
      matches: matchCount,
      results: results
    })
    
  } catch (error: any) {
    console.error('[CheckJTL Batch] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
