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

    // Blacklist: Verzeichnisse, Schulen, Plattformen
    const blacklistedDomains = [
      'gelbenseiten.de', 'gelbeseiten.de',
      'wlw.de', 'wer-liefert-was.de',
      'lehrer-online.de', 'lehreronline.de',
      'schule-bw.de', 'schulewirtschaft.de',
      'wikipedia.org', 'youtube.com',
      'facebook.com', 'linkedin.com',
      'xing.com', 'kununu.com',
      'indeed.de', 'stepstone.de'
    ]
    
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        // Filter blacklisted domains
        const itemUrl = item.link?.toLowerCase() || ''
        if (blacklistedDomains.some(domain => itemUrl.includes(domain))) {
          console.log(`[Prospector] Filtered blacklisted domain: ${item.link}`)
          continue
        }
        
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
 * Generiert Mock-Daten mit ECHTEN deutschen Handwerks-Websites
 */
function generateMockProspects(industry: string, region: string, limit: number): ProspectResult[] {
  // ECHTE deutsche Handwerks-Firmen mit existierenden Websites
  const realCompanies = [
    // Metallbau Köln/Düsseldorf
    { name: 'FRÖBEL Metal Specialists GmbH', website: 'https://metall-froebel.de', industry: 'Metallbau' },
    { name: 'Metallbau Nickel', website: 'https://nickel-mv.de', industry: 'Metallbau' },
    { name: 'Wolfgang Heckner Metallbau GmbH', website: 'https://www.whm-koeln.de', industry: 'Metallbau' },
    { name: 'Eisenzeit GmbH', website: 'https://www.eisenzeit-koeln.de', industry: 'Metallbau' },
    { name: 'Metallbau Först', website: 'https://foerst-metallbau.de', industry: 'Metallbau' },
    { name: 'Metallbau Michael Koller', website: 'https://metallbau-miko.de', industry: 'Metallbau' },
    { name: 'Metallbau Johannes Schiefer', website: 'https://www.metallbau-schiefer.de', industry: 'Metallbau' },
    { name: 'Metallbau Müller GmbH', website: 'http://www.mueller-metallbau-koeln.de', industry: 'Metallbau' },
    { name: 'Metallbau Obladen', website: 'https://www.metallbau-obladen.de', industry: 'Metallbau' },
    { name: 'G+S Metallbau Schlosserei', website: 'https://www.gs-metallbau.de', industry: 'Metallbau' },
    { name: 'MR Stahltechnik', website: 'https://mr-stahltechnik.de', industry: 'Stahlbau' },
    { name: 'Metallbau Odenthal', website: 'https://www.metallbau-odenthal.de', industry: 'Metallbau' },
    { name: 'Metallbau Frings GmbH', website: 'https://www.metallbau-frings.de', industry: 'Metallbau' },
    { name: 'Meckel GmbH', website: 'https://www.meckel-metallbau.de', industry: 'Metallbau' },
    { name: 'Weiss Metallbau', website: 'https://www.weiss-metallbau.de', industry: 'Metallbau' },
    
    // Schreinereien
    { name: 'Schreinerei Holzdesign', website: 'https://www.tischlerei-koeln.de', industry: 'Schreinerei' },
    { name: 'Möbelbau Werkstatt', website: 'https://www.schreiner-duesseldorf.de', industry: 'Schreinerei' },
  ]
  
  const results: ProspectResult[] = []
  const shuffled = [...realCompanies].sort(() => Math.random() - 0.5)
  
  for (let i = 0; i < Math.min(limit, shuffled.length); i++) {
    const company = shuffled[i]
    
    results.push({
      company_name: `${company.name} - ${region}`,
      website: company.website,
      snippet: `${company.name} - Professioneller ${industry}-Betrieb in ${region}. Moderne Ausstattung und langjährige Erfahrung. Spezialisiert auf Oberflächenbearbeitung und Schleiftechnik.`,
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
