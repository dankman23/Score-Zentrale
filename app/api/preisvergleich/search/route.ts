export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/preisvergleich/search
 * Sucht Produktpreise bei Amazon, Idealo, Google Shopping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ean, mpn, productName, unserVK, unsereVE } = body

    if (!ean && !mpn) {
      return NextResponse.json({ 
        ok: false, 
        error: 'EAN oder MPN erforderlich' 
      }, { status: 400 })
    }

    console.log(`[Preisvergleich] Suche: EAN=${ean}, MPN=${mpn}`)

    const results = []

    // Google Custom Search für Produktseiten
    const searchQueries = []
    if (ean) searchQueries.push(`${ean} preis`)
    if (mpn) searchQueries.push(`${mpn} ${productName} preis`)

    const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY
    const GOOGLE_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID

    if (!GOOGLE_API_KEY || !GOOGLE_ENGINE_ID) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Google Search API nicht konfiguriert' 
      }, { status: 500 })
    }

    for (const query of searchQueries.slice(0, 1)) { // Nur erste Query
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`
        const searchRes = await fetch(searchUrl)
        const searchData = await searchRes.json()

        if (searchData.items) {
          // Filtere nur relevante Shops
          const relevantItems = searchData.items.filter(item => {
            const url = item.link.toLowerCase()
            return url.includes('amazon.') || 
                   url.includes('idealo.') || 
                   url.includes('ebay.') ||
                   url.includes('mercateo.') ||
                   url.includes('contorion.')
          })

          // Crawle die ersten 3 Ergebnisse
          for (const item of relevantItems.slice(0, 3)) {
            try {
              const productUrl = item.link
              const shop = extractShopName(productUrl)

              // Jina.ai Reader zum Crawlen
              const jinaUrl = `https://r.jina.ai/${productUrl}`
              const jinaRes = await fetch(jinaUrl, {
                headers: {
                  'Authorization': `Bearer ${process.env.JINA_API_KEY || ''}`,
                  'X-Return-Format': 'text'
                },
                signal: AbortSignal.timeout(10000)
              })

              if (!jinaRes.ok) continue

              const pageText = await jinaRes.text()

              // Preis extrahieren
              const preis = extractPreis(pageText)
              const ve = extractVE(pageText, productName)

              if (preis) {
                results.push({
                  shop,
                  url: productUrl,
                  preis: parseFloat(preis),
                  ve: ve || 1,
                  preis_pro_stueck: ve > 1 ? parseFloat((preis / ve).toFixed(2)) : preis,
                  title: item.title,
                  snippet: item.snippet
                })
              }
            } catch (e) {
              console.error(`[Preisvergleich] Fehler beim Crawlen: ${e.message}`)
            }
          }
        }
      } catch (e) {
        console.error(`[Preisvergleich] Suche fehlgeschlagen: ${e.message}`)
      }
    }

    // Sortiere nach Preis pro Stück
    results.sort((a, b) => a.preis_pro_stueck - b.preis_pro_stueck)

    return NextResponse.json({ 
      ok: true,
      unserPreis: {
        vk: unserVK,
        ve: unsereVE || 1,
        preis_pro_stueck: unsereVE > 1 ? parseFloat((unserVK / unsereVE).toFixed(2)) : unserVK
      },
      wettbewerber: results,
      anzahl: results.length
    })
  } catch (error: any) {
    console.error('[Preisvergleich] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * Shop-Name aus URL extrahieren
 */
function extractShopName(url: string): string {
  if (url.includes('amazon.')) return 'Amazon'
  if (url.includes('idealo.')) return 'Idealo'
  if (url.includes('ebay.')) return 'eBay'
  if (url.includes('mercateo.')) return 'Mercateo'
  if (url.includes('contorion.')) return 'Contorion'
  return 'Unbekannt'
}

/**
 * Preis aus Text extrahieren
 */
function extractPreis(text: string): string | null {
  // Suche nach Preis-Patterns: 12,99 € oder 12.99 EUR oder €12,99
  const patterns = [
    /(\d{1,4})[.,](\d{2})\s*€/,
    /€\s*(\d{1,4})[.,](\d{2})/,
    /(\d{1,4})[.,](\d{2})\s*EUR/,
    /Preis:\s*(\d{1,4})[.,](\d{2})/
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return `${match[1]}.${match[2]}`
    }
  }

  return null
}

/**
 * Verkaufseinheit aus Text extrahieren
 */
function extractVE(text: string, productName: string): number {
  // Suche nach VE-Hinweisen
  const vePatterns = [
    /(\d+)er[\s-]?Pack/i,
    /(\d+)er[\s-]?Set/i,
    /(\d+)\s*Stück/i,
    /Packung[^\d]*(\d+)/i,
    /VE[:\s]*(\d+)/i,
    /Inhalt[:\s]*(\d+)/i
  ]

  // Prüfe Produktname zuerst
  for (const pattern of vePatterns) {
    const match = productName.match(pattern)
    if (match) return parseInt(match[1])
  }

  // Dann den Seitentext
  for (const pattern of vePatterns) {
    const match = text.match(pattern)
    if (match) return parseInt(match[1])
  }

  return 1 // Default: Einzelstück
}
