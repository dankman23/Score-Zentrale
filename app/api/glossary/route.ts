import { NextRequest, NextResponse } from 'next/server'
import { GLOSSARY } from '../../../lib/glossary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/glossary
 * Returns the complete glossary
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      ok: true,
      version: '1.0',
      glossary: GLOSSARY,
      stats: {
        anwendungen: GLOSSARY.anwendungen.length,
        kategorien: GLOSSARY.kategorien.length,
        werkstoffe: GLOSSARY.werkstoffe.length,
        maschinentypen: GLOSSARY.maschinentypen.length,
        total: GLOSSARY.anwendungen.length + GLOSSARY.kategorien.length + 
               GLOSSARY.werkstoffe.length + GLOSSARY.maschinentypen.length
      }
    })
  } catch (error: any) {
    console.error('Glossary API error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
