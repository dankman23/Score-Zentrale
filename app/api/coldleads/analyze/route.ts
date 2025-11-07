export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { analyzeCompany } from '../../../../services/coldleads/analyzer'
import { matchProspectWithJTLCustomer } from '../../../../services/coldleads/customer-matcher'
import { connectToDatabase } from '../../../lib/api'

/**
 * POST /api/coldleads/analyze
 * Analysiert eine Firma (Website-Crawling + AI + JTL-Matching)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { website, industry, force = false } = body

    if (!website || !industry) {
      return NextResponse.json({
        ok: false,
        error: 'Website und Branche sind erforderlich'
      }, { status: 400 })
    }

    console.log(`[ColdLeads] Analyzing: ${website} (force: ${force})`)

    // 1. Analyse durchführen
    const analysis = await analyzeCompany(website, industry)
    console.log('[ColdLeads] Analysis complete:', { 
      companyName: analysis.company_info.name,
      score: analysis.needs_assessment.score,
      contactsFound: analysis.contact_persons.length 
    })

    // 2. JTL-Customer-Matching
    let matchResult = null
    try {
      const contactEmails = analysis.contact_persons
        .map(c => c.email)
        .filter(e => e) as string[]
      
      matchResult = await matchProspectWithJTLCustomer(
        analysis.company_info.name,
        website,
        contactEmails
      )
      
      if (matchResult.is_match) {
        console.log('[ColdLeads] JTL Customer Match found:', {
          customer: matchResult.matched_customer_name,
          confidence: matchResult.match_confidence,
          type: matchResult.match_type
        })
      }
    } catch (error) {
      console.error('[ColdLeads] JTL Matching failed (non-critical):', error)
      // Nicht-kritischer Fehler, weiter machen
    }

    // 3. In MongoDB speichern
    const { db } = await connectToDatabase()
    const collection = db.collection('cold_prospects')

    const updateData: any = {
      analysis,
      score: analysis.needs_assessment.score,
      status: 'analyzed',
      analyzed_at: new Date(),
      updated_at: new Date()
    }

    // JTL-Match-Daten hinzufügen
    if (matchResult && matchResult.is_match) {
      updateData.matched_customer_id = matchResult.matched_customer_id
      updateData.matched_customer_name = matchResult.matched_customer_name
      updateData.is_existing_customer = true
      updateData.match_confidence = matchResult.confidence
      updateData.match_type = matchResult.match_type
    }

    const result = await collection.updateOne(
      { website },
      { $set: updateData },
      { upsert: false }
    )

    console.log('[ColdLeads] DB Update result:', { 
      matched: result.matchedCount, 
      modified: result.modifiedCount 
    })

    if (result.matchedCount === 0) {
      console.warn('[ColdLeads] WARNING: No document found for website:', website)
      // Versuche trotzdem zu speichern
      await collection.insertOne({
        website,
        company_name: analysis.company_info.name,
        industry,
        region: '',
        ...updateData,
        created_at: new Date()
      })
    }

    return NextResponse.json({
      ok: true,
      analysis,
      match: matchResult
    })

  } catch (error: any) {
    console.error('[ColdLeads Analyze] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Analyse fehlgeschlagen',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
