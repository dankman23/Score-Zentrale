export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Minuten für Batch

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../lib/api'
import { buildProspectQuery } from '@/lib/prospect-utils'

/**
 * POST /api/coldleads/batch/analyze
 * Analysiert mehrere Prospects auf einmal
 * 
 * Body:
 * - prospect_ids: Array von Prospect-IDs
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { prospect_ids } = body
    
    if (!prospect_ids || !Array.isArray(prospect_ids) || prospect_ids.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'prospect_ids Array erforderlich'
      }, { status: 400 })
    }
    
    // Limit für Batch-Größe
    if (prospect_ids.length > 50) {
      return NextResponse.json({
        ok: false,
        error: 'Maximum 50 Prospects pro Batch'
      }, { status: 400 })
    }
    
    console.log(`[Batch Analyze] Starting batch analysis for ${prospect_ids.length} prospects`)
    
    const results = {
      success: [] as any[],
      failed: [] as any[],
      total: prospect_ids.length
    }
    
    // Sequenziell analysieren (um API-Limits zu vermeiden)
    for (let i = 0; i < prospect_ids.length; i++) {
      const prospectId = prospect_ids[i]
      
      try {
        console.log(`[Batch Analyze] ${i+1}/${prospect_ids.length}: Analyzing ${prospectId}`)
        
        // API-Call zur analyze-deep Route
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/coldleads/analyze-deep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: prospectId })
        })
        
        const data = await response.json()
        
        if (data.ok) {
          results.success.push({
            id: prospectId,
            company_name: data.company_name,
            has_email: !!data.analysis?.contact_email
          })
        } else {
          results.failed.push({
            id: prospectId,
            error: data.error || 'Analyse fehlgeschlagen'
          })
        }
        
        // Kurze Pause zwischen Requests (Rate-Limiting)
        if (i < prospect_ids.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
      } catch (error: any) {
        console.error(`[Batch Analyze] Error for ${prospectId}:`, error.message)
        results.failed.push({
          id: prospectId,
          error: error.message
        })
      }
    }
    
    const duration = Date.now() - startTime
    
    console.log(`[Batch Analyze] ✅ Complete in ${duration}ms - Success: ${results.success.length}, Failed: ${results.failed.length}`)
    
    return NextResponse.json({
      ok: true,
      results: results,
      duration: duration,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length
      }
    })
    
  } catch (error: any) {
    console.error('[Batch Analyze] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Batch-Analyse fehlgeschlagen'
    }, { status: 500 })
  }
}
