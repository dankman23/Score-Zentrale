export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'
import { analyzeCompanyV3 } from '@/services/coldleads/analyzer-v3'
import { generateEmailSequenceV3 } from '@/services/coldleads/emailer-v3'
import { SCORE_CONFIG } from '@/lib/score-coldleads-config'

/**
 * POST /api/coldleads/analyze-v3
 * Analysiert eine Firma mit V3-Pipeline
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { website, company_name, industry, region } = body
    
    if (!website) {
      return NextResponse.json({
        ok: false,
        error: 'Website URL required'
      }, { status: 400 })
    }
    
    console.log(`[AnalyzeV3] Starting analysis for: ${website}`)
    
    // Step 1: Analyzer V3
    const analysis = await analyzeCompanyV3(website, company_name, industry, region)
    
    console.log(`[AnalyzeV3] Analysis complete. Confidence: ${analysis.confidence_overall}%`)
    
    // Step 2: Email Generation V3
    const emailSequence = await generateEmailSequenceV3(analysis)
    
    console.log(`[AnalyzeV3] Email sequence generated`)
    
    // Step 3: Save to MongoDB
    const db = await getMongoDb()
    const prospectsCollection = db.collection('prospects')
    
    const now = new Date()
    
    // Update Prospect mit V3-Daten
    const updateResult = await prospectsCollection.updateOne(
      { website },
      {
        $set: {
          company_name: analysis.company,
          status: 'analyzed',
          score: analysis.confidence_overall,
          
          // V3 Analysis Data
          analysis_v3: {
            branch_guess: analysis.branch_guess,
            applications: analysis.applications,
            materials: analysis.materials,
            machines: analysis.machines,
            product_categories: analysis.product_categories,
            contact_person: analysis.contact_person,
            recommended_brands: analysis.recommended_brands,
            notes: analysis.notes,
            analyzed_at: now
          },
          
          // Email Sequence
          email_sequence: {
            mail_1: emailSequence.mail_1,
            mail_2: emailSequence.mail_2,
            mail_3: emailSequence.mail_3,
            crm_tags: emailSequence.crm_tags,
            generated_at: now
          },
          
          // Follow-up Schedule
          followup_schedule: {
            mail_1_sent: false,
            mail_2_scheduled: null,
            mail_2_sent: false,
            mail_3_scheduled: null,
            mail_3_sent: false
          },
          
          updated_at: now
        }
      },
      { upsert: false }
    )
    
    if (updateResult.matchedCount === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Prospect not found in database'
      }, { status: 404 })
    }
    
    console.log(`[AnalyzeV3] Saved to MongoDB`)
    
    return NextResponse.json({
      ok: true,
      analysis: analysis,
      email_sequence: emailSequence,
      message: 'Analysis complete'
    })
    
  } catch (error: any) {
    console.error('[AnalyzeV3] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Analysis failed'
    }, { status: 500 })
  }
}
