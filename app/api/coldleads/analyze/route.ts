export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { analyzeCompany } from '../../../../services/coldleads/analyzer'
import { connectToDatabase } from '../../../lib/api'

/**
 * POST /api/coldleads/analyze
 * Analysiert eine Firma (Website-Crawling + AI)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { website, industry } = body

    if (!website || !industry) {
      return NextResponse.json({
        ok: false,
        error: 'Website und Branche sind erforderlich'
      }, { status: 400 })
    }

    console.log(`[ColdLeads] Analyzing: ${website}`)

    // Analyse durchführen
    const analysis = await analyzeCompany(website, industry)

    // In MongoDB speichern
    const { db } = await connectToDatabase()
    const collection = db.collection('cold_prospects')

    await collection.updateOne(
      { website },
      {
        $set: {
          analysis,
          score: analysis.needs_assessment.score,
          status: 'analyzed',
          analyzed_at: new Date(),
          updated_at: new Date()
        }
      }
    )

    return NextResponse.json({
      ok: true,
      analysis
    })

  } catch (error: any) {
    console.error('[ColdLeads Analyze] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Analyse fehlgeschlagen'
    }, { status: 500 })
  }
}
