export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { loadGlossary, listGlossaryVersions } from '../../../../services/glossary/publish'

/**
 * GET /api/glossary/:version
 * Lädt JTL-Glossar für bestimmte Version
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { version: string } }
) {
  try {
    const { version } = params

    // Liste aller Versionen wenn "list" als Version
    if (version === 'list') {
      const versions = await listGlossaryVersions()
      return NextResponse.json({
        ok: true,
        versions,
        count: versions.length
      })
    }

    // Glossar für spezifische Version laden
    const glossary = await loadGlossary(version)

    if (!glossary) {
      return NextResponse.json({
        ok: false,
        error: `Glossary not found for version: ${version}`,
        hint: 'Use /api/glossary/list to see available versions or run /api/glossary/generate to create'
      }, { status: 404 })
    }

    // Optional: Nur bestimmte Tabellen filtern
    const tableFilter = request.nextUrl.searchParams.get('tables')
    if (tableFilter) {
      const requestedTables = tableFilter.split(',').map(t => t.trim())
      const filteredTables = glossary.tables.filter(t => 
        requestedTables.some(rt => t.name.includes(rt))
      )
      
      return NextResponse.json({
        ok: true,
        version: glossary.version,
        generated_at: glossary.generated_at,
        table_count: filteredTables.length,
        tables: filteredTables,
        filtered: true
      })
    }

    return NextResponse.json({
      ok: true,
      ...glossary
    })

  } catch (error: any) {
    console.error('[Glossary API] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
