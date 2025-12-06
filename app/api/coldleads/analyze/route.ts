export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/coldleads/analyze
 * ⚠️ DEPRECATED: Use /api/coldleads/analyze-v3 instead
 * 
 * Diese API-Route ist veraltet und wird nicht mehr unterstützt.
 * Bitte verwenden Sie stattdessen:
 * - /api/coldleads/analyze-v3 (aktuell, empfohlen)
 * - /api/coldleads/analyze-deep (falls noch in Verwendung)
 */
export async function POST(request: NextRequest) {
  console.warn('[DEPRECATED] /api/coldleads/analyze wurde aufgerufen - bitte auf V3 migrieren')
  
  return NextResponse.json({
    ok: false,
    error: 'DEPRECATED: Diese API ist veraltet. Bitte verwenden Sie /api/coldleads/analyze-v3',
    deprecated: true,
    migration_guide: {
      old_endpoint: '/api/coldleads/analyze',
      new_endpoint: '/api/coldleads/analyze-v3',
      breaking_changes: [
        'Response-Format geändert (analysis_v3 statt analysis)',
        'Neue Felder: confidence_overall, recommended_brands',
        'Glossar-Mapping automatisch inkludiert'
      ]
    }
  }, { status: 410 }) // 410 Gone
}
