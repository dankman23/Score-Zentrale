export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * GET /api/glossary/config
 * Test-Endpoint: Zeigt Glossar-Konfiguration
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    config: {
      jtl_doc_version: process.env.JTL_DOC_VERSION || 'NOT_SET',
      jtl_doc_base: process.env.JTL_DOC_BASE || 'NOT_SET',
      allow_net: process.env.ALLOW_NET || 'NOT_SET'
    },
    timestamp: new Date().toISOString()
  })
}
