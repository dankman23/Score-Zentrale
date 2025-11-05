export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { validateSchema, quickHealthCheck, generateRecommendations } from '../../../../services/sql/validation'

/**
 * GET /api/health/schema
 * Umfassende Schema-Validierung
 */
export async function GET() {
  try {
    const result = await validateSchema()
    const recommendations = generateRecommendations(result)

    return NextResponse.json({
      ...result,
      recommendations,
      summary: {
        total_checks: result.details.length,
        critical_ok: result.details.filter(d => d.status === 'OK').length,
        warnings: result.warnings.length,
        critical_issues: result.critical_issues.length
      }
    }, {
      status: result.ok ? 200 : 503
    })

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
