export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ClaudeClient } from '@/lib/claude-client'

/**
 * GET /api/amazon/bulletpoints/batch/estimate
 * Schätzt die Kosten für eine Batch-Generierung
 * 
 * Query: ?count=100
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const countParam = searchParams.get('count')
    
    const count = parseInt(countParam || '0')
    
    if (count <= 0) {
      return NextResponse.json({
        ok: false,
        error: 'Ungültige Anzahl'
      }, { status: 400 })
    }
    
    const claude = new ClaudeClient()
    
    // Schätze Kosten
    // Durchschnitt: 1500 Input Tokens (Produkt-Details + Prompt)
    // Durchschnitt: 500 Output Tokens (5 Bulletpoints)
    const estimate = claude.estimateCosts(count, 1500, 500)
    
    return NextResponse.json({
      ok: true,
      count,
      model: 'claude-sonnet-4-20250514',
      estimate: {
        inputTokens: estimate.inputTokens.toLocaleString('de-DE'),
        outputTokens: estimate.outputTokens.toLocaleString('de-DE'),
        totalTokens: estimate.totalTokens.toLocaleString('de-DE'),
        costs: {
          inputUSD: estimate.inputCostUSD.toFixed(4),
          outputUSD: estimate.outputCostUSD.toFixed(4),
          totalUSD: estimate.totalCostUSD.toFixed(2),
          totalEUR: estimate.totalCostEUR.toFixed(2)
        }
      }
    })
    
  } catch (error: any) {
    console.error('[Batch Estimate] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
