export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Minuten für Crawler

import { NextRequest, NextResponse } from 'next/server'
import { createCrawler } from '../../../../services/glossary/crawler'
import { normalizeTable, createGlossarySchema } from '../../../../services/glossary/normalize'
import { publishGlossary } from '../../../../services/glossary/publish'

/**
 * POST /api/glossary/generate
 * Generiert JTL-Glossar durch Crawling der Dokumentation
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const version = process.env.JTL_DOC_VERSION || '1.10.14.3'
    const allowNet = process.env.ALLOW_NET === 'true'

    if (!allowNet) {
      return NextResponse.json({
        ok: false,
        error: 'Network crawling disabled. Set ALLOW_NET=true to enable.'
      }, { status: 403 })
    }

    console.log(`[Generate] Starting glossary generation for version ${version}`)

    // 1. Crawler erstellen und Tabellenliste abrufen
    const crawler = createCrawler()
    const tableList = await crawler.crawlTableList()

    if (tableList.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No tables found in documentation',
        hint: 'Check JTL_DOC_VERSION and JTL_DOC_BASE settings'
      }, { status: 404 })
    }

    console.log(`[Generate] Found ${tableList.length} tables to crawl`)

    // 2. Limit für Test-Runs (optional)
    const maxTables = parseInt(request.nextUrl.searchParams.get('limit') || '0') || tableList.length
    const tablesToCrawl = tableList.slice(0, maxTables)

    // 3. Jede Tabelle crawlen und normalisieren
    const normalizedTables = []
    let successCount = 0
    let failCount = 0

    for (const tableInfo of tablesToCrawl) {
      try {
        const rawTable = await crawler.crawlTableDetail(tableInfo.url)
        
        if (rawTable && rawTable.columns && rawTable.columns.length > 0) {
          const normalized = normalizeTable(rawTable, tableInfo.name)
          normalizedTables.push(normalized)
          successCount++
        } else {
          console.warn(`[Generate] Skipping ${tableInfo.name}: No columns found`)
          failCount++
        }
      } catch (error) {
        console.error(`[Generate] Failed to crawl ${tableInfo.name}:`, error)
        failCount++
      }

      // Rate limiting zwischen Requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 4. Glossar-Schema erstellen
    const schema = createGlossarySchema(normalizedTables, version)

    // 5. Publishen (JSON-Datei + Cache)
    const filepath = await publishGlossary(schema)

    const duration = Date.now() - startTime

    return NextResponse.json({
      ok: true,
      version,
      filepath,
      stats: {
        tables_found: tableList.length,
        tables_crawled: tablesToCrawl.length,
        tables_success: successCount,
        tables_failed: failCount,
        duration_ms: duration,
        duration_formatted: `${Math.round(duration / 1000)}s`
      },
      sample_tables: normalizedTables.slice(0, 5).map(t => t.name)
    })

  } catch (error: any) {
    console.error('[Generate] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
