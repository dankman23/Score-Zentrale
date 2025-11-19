export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { analyzeCompany } from '../../../../services/coldleads/analyzer'
import { analyzeCompanyV2 } from '../../../../services/coldleads/analyzer-v2'
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

    // 1. Analyse durchführen - V2 mit Fallback auf V1
    let analysis
    let useV2 = true // Feature flag für V2
    
    try {
      if (useV2) {
        console.log('[ColdLeads] Using Analyzer V2')
        const analysisV2 = await analyzeCompanyV2(website, industry)
        
        // Konvertiere V2 Format zu V1 Format für Kompatibilität
        analysis = {
          company_info: analysisV2.company_profile,
          contact_persons: analysisV2.contact.found ? [analysisV2.contact] : [],
          needs_assessment: analysisV2.assessment,
          glossary_terms: analysisV2.company_profile.mapped_terms // NEU!
        }
      } else {
        analysis = await analyzeCompany(website, industry)
      }
    } catch (error) {
      console.error('[ColdLeads] V2 failed, falling back to V1:', error)
      analysis = await analyzeCompany(website, industry)
    }
    
    console.log('[ColdLeads] Analysis complete:', { 
      companyName: analysis.company_info.name,
      score: analysis.needs_assessment.score || analysis.needs_assessment.relevance_score,
      contactsFound: analysis.contact_persons?.length || (analysis.contact_persons ? 1 : 0)
    })

    // JTL-Customer-Matching temporarily disabled
    let matchResult = null

    // 3. In MongoDB speichern
    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')

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

    // Upsert: Erstelle Dokument falls nicht vorhanden
    const result = await collection.updateOne(
      { website },
      { 
        $set: updateData,
        $setOnInsert: {
          website,
          company_name: analysis.company_info.name,
          industry,
          region: '',
          created_at: new Date()
        }
      },
      { upsert: true }
    )

    console.log('[ColdLeads] DB Update result:', { 
      matched: result.matchedCount, 
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    })

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
