/**
 * Kaltakquise - Phase 1: Prospector (Firmen-Finder)
 * Sucht potenzielle B2B-Kunden über Google Custom Search
 */

interface ProspectorOptions {
  industry: string  // z.B. "Metallbau"
  region: string    // z.B. "Berlin" oder "Deutschland"
  limit?: number
}

interface ProspectResult {
  company_name: string
  website: string
  snippet: string
  location?: string
  source: 'google_search'
}

/**
 * Sucht Firmen basierend auf Branche und Region
 */
export async function findProspects(options: ProspectorOptions): Promise<ProspectResult[]> {
  const { industry, region, limit = 10 } = options

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID
  const useMockData = !apiKey || !engineId || process.env.USE_MOCK_COLDLEADS === 'true'

  // MOCK-DATEN für Tests (wenn Google API nicht konfiguriert)
  if (useMockData) {
    console.log('[Prospector] Using MOCK data (Google API not configured)')
    return generateMockProspects(industry, region, limit)
  }

  const prospects: ProspectResult[] = []

  // Suchquery optimiert für B2B-Firmen
  const query = `${industry} ${region} site:.de OR site:.com "impressum" OR "kontakt"`
  
  try {
    // Google Custom Search API
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey!)
    url.searchParams.set('cx', engineId!)
    url.searchParams.set('q', query)
    url.searchParams.set('num', Math.min(limit, 10).toString())
    url.searchParams.set('gl', 'de') // Germany
    url.searchParams.set('lr', 'lang_de') // German

    const response = await fetch(url.toString())
    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Google Search API Error: ${data.error?.message || 'Unknown error'}`)
    }

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        // Extrahiere Firmennamen aus Titel
        const companyName = extractCompanyName(item.title)
        
        prospects.push({
          company_name: companyName,
          website: item.link,
          snippet: item.snippet || '',
          location: extractLocation(item.snippet, region),
          source: 'google_search'
        })
      }
    }

    console.log(`[Prospector] Found ${prospects.length} prospects for ${industry} in ${region}`)
    return prospects

  } catch (error: any) {
    console.error('[Prospector] Error:', error)
    throw new Error(`Firmen-Suche fehlgeschlagen: ${error.message}`)
  }
}

/**
 * Generiert Mock-Daten für Tests
 */
function generateMockProspects(industry: string, region: string, limit: number): ProspectResult[] {
  const mockCompanies = [
    { prefix: 'Metallbau', websites: ['mustermann-metallbau.de', 'schmidt-stahl.de', 'wagner-edelstahl.com', 'becker-metallbau.de', 'mueller-stahlbau.de'] },
    { prefix: 'Schreinerei', websites: ['holz-meister.de', 'tischlerei-weber.de', 'schreinerei-hoffmann.com', 'moebel-fischer.de'] },
    { prefix: 'Lackiererei', websites: ['lack-profi.de', 'oberflaechen-technik.de', 'farbe-design.com'] },
    { prefix: 'Maschinenbau', websites: ['maschinenbau-gmbh.de', 'industrie-technik.de', 'praezision-werke.com'] }
  ]
  
  const results: ProspectResult[] = []
  const baseNames = ['GmbH', 'AG', '& Co. KG', 'Betrieb']
  
  for (let i = 0; i < Math.min(limit, 10); i++) {
    const companyType = mockCompanies[Math.floor(Math.random() * mockCompanies.length)]
    const website = companyType.websites[i % companyType.websites.length]
    const companyName = `${companyType.prefix} ${region} ${baseNames[i % baseNames.length]}`
    
    results.push({
      company_name: companyName,
      website: `https://${website}`,
      snippet: `Professionelle ${industry} in ${region}. Langjährige Erfahrung, modernste Ausstattung. Kontaktieren Sie uns für ein Angebot.`,
      location: region,
      source: 'google_search'
    })
  }
  
  return results
}

/**
 * Extrahiert Firmennamen aus Google-Titel
 */
function extractCompanyName(title: string): string {
  // Entferne typische Suffixe
  let name = title
    .replace(/\s*-\s*Startseite.*$/i, '')
    .replace(/\s*-\s*Home.*$/i, '')
    .replace(/\s*\|.*$/i, '')
    .trim()

  return name || title
}

/**
 * Versucht Location aus Snippet zu extrahieren
 */
function extractLocation(snippet: string, fallback: string): string {
  // Suche nach PLZ-Mustern (5-stellig)
  const plzMatch = snippet.match(/\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/)
  if (plzMatch) {
    return `${plzMatch[1]} ${plzMatch[2]}`
  }

  // Suche nach Stadt-Namen
  const cityMatch = snippet.match(/\b([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?),?\s+(Deutschland|Germany)\b/i)
  if (cityMatch) {
    return cityMatch[1]
  }

  return fallback
}

/**
 * Generiert optimierte Suchqueries basierend auf Branche
 */
export function generateSearchQueries(industry: string, region: string): string[] {
  const baseTerms = [
    `${industry} ${region}`,
    `${industry} unternehmen ${region}`,
    `${industry} hersteller ${region}`,
    `${industry} produzent ${region}`
  ]

  // Branchenspezifische Ergänzungen
  const industryTerms: Record<string, string[]> = {
    'metallbau': ['schweißerei', 'stahlbau', 'schlosserei'],
    'holzbearbeitung': ['tischlerei', 'schreinerei', 'möbelbau'],
    'lackiererei': ['karosserie', 'fahrzeuglackierung', 'industrielackierung'],
    'maschinenbau': ['anlagenbau', 'sondermaschinenbau', 'automatisierung']
  }

  const industryLower = industry.toLowerCase()
  for (const [key, terms] of Object.entries(industryTerms)) {
    if (industryLower.includes(key)) {
      terms.forEach(term => {
        baseTerms.push(`${term} ${region}`)
      })
    }
  }

  return baseTerms
}
