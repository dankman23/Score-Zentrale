/**
 * DACH Systematic Company Crawler
 * Strukturiertes Crawling von Firmenverzeichnissen für Deutschland, Österreich, Schweiz
 */

interface DACHRegion {
  country: string // DE, AT, CH
  state?: string // Bundesland
  city?: string
  postalCode?: string
}

interface CompanyLead {
  name: string
  website?: string
  address?: string
  city: string
  region: string
  country: string
  postalCode?: string
  phone?: string
  industry: string
  source: string // gelbeseiten.de, firmenabc.de, etc.
}

/**
 * Systematisches Crawling-Framework
 * 
 * Quellen-Hierarchie:
 * 1. Branchenverzeichnisse (Gelbe Seiten, firmenabc.at, local.ch)
 * 2. Handelsregister-Daten
 * 3. Spezial-Verzeichnisse (IHK, Handwerkskammer)
 */

// DACH Bundesländer/Kantone
const DACH_REGIONS = {
  DE: [
    'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
    'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
    'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
    'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'
  ],
  AT: [
    'Burgenland', 'Kärnten', 'Niederösterreich', 'Oberösterreich',
    'Salzburg', 'Steiermark', 'Tirol', 'Vorarlberg', 'Wien'
  ],
  CH: [
    'Aargau', 'Appenzell', 'Basel', 'Bern', 'Freiburg', 'Genf',
    'Glarus', 'Graubünden', 'Jura', 'Luzern', 'Neuenburg', 'Schaffhausen',
    'Schwyz', 'Solothurn', 'St. Gallen', 'Tessin', 'Thurgau', 'Uri',
    'Waadt', 'Wallis', 'Zug', 'Zürich'
  ]
}

// Branchen-Mapping mit Suchbegriffen (aus PDF "Relevante Branchen für Schleifwerkzeuge")
const INDUSTRY_KEYWORDS = {
  // 🚗 Automobilindustrie & Fahrzeugbau
  'Automobilindustrie': ['automobilindustrie', 'fahrzeugbau', 'automobilzulieferer', 'kfz industrie'],
  'Karosseriebau': ['karosseriebau', 'karosseriewerkstatt', 'blechbearbeitung fahrzeug', 'autolackierung'],
  'KFZ-Werkstatt': ['kfz werkstatt', 'autowerkstatt', 'kfz reparatur', 'fahrzeugreparatur'],
  
  // 🔩 Metallverarbeitung & Stahlbau
  'Metallverarbeitung': ['metallverarbeitung', 'metallbau', 'blechbearbeitung', 'stahlverarbeitung'],
  'Schlosserei': ['schlosserei', 'bauschlosserei', 'metallbau', 'schlossereibetrieb'],
  'Stahlbau': ['stahlbau', 'stahlkonstruktion', 'metallkonstruktion', 'profilbearbeitung'],
  'Schweißtechnik': ['schweißtechnik', 'schweißbetrieb', 'schweißerei', 'schweißnahtbearbeitung'],
  
  // ⚙️ Maschinen- und Apparatebau
  'Maschinenbau': ['maschinenbau', 'sondermaschinenbau', 'präzisionsmaschinenbau'],
  'Apparatebau': ['apparatebau', 'anlagenbau', 'behälterbau', 'rohrbau'],
  'Werkzeugbau': ['werkzeugbau', 'formenbau', 'vorrichtungsbau', 'stanzerei'],
  
  // ✈️ Luft- und Raumfahrt
  'Luftfahrt': ['luftfahrt', 'flugzeugbau', 'flugzeugwartung', 'triebwerksbau'],
  'Raumfahrt': ['raumfahrt', 'aerospace', 'luftfahrtindustrie'],
  
  // 🚢 Schiff- und Bahnindustrie
  'Schiffbau': ['schiffbau', 'werft', 'marinebau', 'bootsbau'],
  'Bahnindustrie': ['bahnindustrie', 'schienenfahrzeugbau', 'gleisbau', 'zugbau'],
  
  // 🪵 Holz- und Möbelindustrie
  'Holzverarbeitung': ['holzverarbeitung', 'holzbearbeitung', 'sägewerk'],
  'Schreinerei': ['schreinerei', 'tischlerei', 'schreinereibetrieb'],
  'Möbelindustrie': ['möbelindustrie', 'möbelbau', 'möbelherstellung', 'innenausbau'],
  'Parkettverlegung': ['parkett', 'parkettverlegung', 'bodenleger'],
  
  // 🔥 Gießereien und Schmieden
  'Gießerei': ['gießerei', 'metallguss', 'gussteile', 'eisengießerei'],
  'Schmiede': ['schmiede', 'schmiedebetrieb', 'metallschmiede', 'kunstschmiede'],
  
  // 🎨 Maler- und Ausbauhandwerk
  'Malerhandwerk': ['malerhandwerk', 'malerbetrieb', 'maler lackierer'],
  'Trockenbau': ['trockenbau', 'innenausbau', 'gipskartonbau'],
  'Stuckateur': ['stuckateur', 'stukkateur', 'putzarbeiten'],
  
  // 🎨 Oberflächentechnik
  'Oberflächentechnik': ['oberflächentechnik', 'oberflächenbehandlung', 'oberflächenveredelung'],
  'Lackiererei': ['lackiererei', 'industrielackierung', 'pulverbeschichtung'],
  'Galvanik': ['galvanik', 'galvanisierung', 'verzinkerei', 'verchromung'],
  
  // 💎 Glas, Stein & Keramik
  'Glasverarbeitung': ['glasverarbeitung', 'glastechnik', 'glaserei', 'glasschleiferei'],
  'Steinmetz': ['steinmetz', 'steinbearbeitung', 'natursteinbearbeitung', 'marmorbearbeitung'],
  
  // 🦷 Dental & Medizintechnik
  'Dentallabor': ['dentallabor', 'zahntechnik', 'dentaltechnik', 'zahnersatz'],
  
  // 💍 Schmuck & Gravur
  'Schmuckherstellung': ['goldschmied', 'schmuckherstellung', 'juwelier', 'schmuckwerkstatt'],
  'Gravurbetrieb': ['gravur', 'gravierwerkstatt', 'lasergravur', 'gravierdienst'],
  
  // 🔧 Kunststoff & Sonstige
  'Kunststoffverarbeitung': ['kunststoffverarbeitung', 'kunststofftechnik', 'spritzguss'],
  'Modellbau': ['modellbau', 'prototypenbau', 'modellbauer'],
  'Messerschmiede': ['messerschmiede', 'messermacher', 'messerherstellung']
}

/**
 * Crawler-Status für Progress-Tracking
 */
interface CrawlProgress {
  country: string
  region: string
  industry: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  companies_found: number
  last_updated: Date
  next_page?: string
}

/**
 * Filter für unerwünschte Ergebnisse
 * Sortiert Schulen, Plattformen, Verzeichnisse, etc. aus
 */
function isValidCompanyLead(lead: CompanyLead): boolean {
  const name = lead.name.toLowerCase()
  const website = (lead.website || '').toLowerCase()
  
  // Blacklist: Unerwünschte Domains und Keywords
  const blacklistDomains = [
    'wikipedia.org', 'facebook.com', 'instagram.com', 'linkedin.com', 'xing.com',
    'youtube.com', 'twitter.com', 'kununu.com', 'jobware.de', 'stepstone.de',
    'indeed.com', 'monster.de', 'gelbeseiten.de', 'firmenabc.de', '11880.com',
    'golocal.de', 'yelp.de', 'tripadvisor.de', 'foursquare.com',
    'wlw.de', 'wer-liefert-was.de', 'europages.de', 'kompass.com',
    'markt.de', 'ebay-kleinanzeigen.de', 'quoka.de', 'kalaydo.de',
    'unternehmensregister.de', 'handelsregister.de', 'northdata.de',
    'creditreform.de', 'bundesanzeiger.de', 'handwerkskammer.de', 'ihk.de'
  ]
  
  const blacklistKeywords = [
    'schule', 'hochschule', 'universität', 'fachhochschule', 'berufsschule',
    'ausbildung', 'lehrstelle', 'praktikum', 'studium',
    'verband', 'verein', 'vereinigung', 'kammer', 'innung',
    'plattform', 'portal', 'verzeichnis', 'branchenbuch', 'katalog',
    'marktplatz', 'kleinanzeigen', 'anzeigen', 'stellenangebote',
    'jobbörse', 'recruiting', 'personalvermittlung',
    'wikipedia', 'ratgeber', 'forum', 'blog', 'news'
  ]
  
  // Prüfe Domain-Blacklist
  for (const domain of blacklistDomains) {
    if (website.includes(domain)) {
      console.log(`[Filter] Blocked (Blacklist-Domain): ${lead.name} (${domain})`)
      return false
    }
  }
  
  // Prüfe Keyword-Blacklist
  for (const keyword of blacklistKeywords) {
    if (name.includes(keyword)) {
      console.log(`[Filter] Blocked (Blacklist-Keyword): ${lead.name} (${keyword})`)
      return false
    }
  }
  
  // Website muss vorhanden sein
  if (!lead.website || lead.website.trim() === '') {
    console.log(`[Filter] Blocked (No Website): ${lead.name}`)
    return false
  }
  
  // Website muss valide sein (eigene Domain, nicht Plattform)
  const urlPattern = /^https?:\/\/[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/
  if (!urlPattern.test(website)) {
    console.log(`[Filter] Blocked (Invalid URL): ${lead.name}`)
    return false
  }
  
  return true
}

/**
 * Haupt-Crawler-Funktion
 * Crawlt systematisch durch DACH nach Branchen
 */
export async function crawlDACHRegion(
  country: 'DE' | 'AT' | 'CH',
  region: string,
  industry: string,
  limit: number = 50
): Promise<{
  leads: CompanyLead[]
  progress: CrawlProgress
  nextRegion?: { country: string, region: string }
}> {
  
  console.log(`[DACH Crawler] Starting: ${country} / ${region} / ${industry}`)
  
  const allLeads: CompanyLead[] = []
  
  // Strategie basierend auf Land
  switch (country) {
    case 'DE':
      // Gelbe Seiten / 11880.com scrapen (simuliert)
      const deLeads = await crawlGermanyRegion(region, industry, limit * 2) // 2x für Filter-Overhead
      allLeads.push(...deLeads)
      break
      
    case 'AT':
      // Herold.at / firmenabc.at scrapen (simuliert)
      const atLeads = await crawlAustriaRegion(region, industry, limit * 2)
      allLeads.push(...atLeads)
      break
      
    case 'CH':
      // local.ch / search.ch scrapen (simuliert)
      const chLeads = await crawlSwitzerlandRegion(region, industry, limit * 2)
      allLeads.push(...chLeads)
      break
  }
  
  // Filter anwenden: Nur echte Firmen, keine Schulen/Plattformen
  const filteredLeads = allLeads.filter(isValidCompanyLead)
  console.log(`[DACH Crawler] Filtered: ${allLeads.length} → ${filteredLeads.length} (removed ${allLeads.length - filteredLeads.length})`)
  
  const leads = filteredLeads.slice(0, limit)
  
  // Progress tracken
  const progress: CrawlProgress = {
    country,
    region,
    industry,
    status: 'completed',
    companies_found: leads.length,
    last_updated: new Date()
  }
  
  // Nächste Region bestimmen
  const nextRegion = getNextRegion(country, region)
  
  return {
    leads,
    progress,
    nextRegion
  }
}

/**
 * Deutschland: Gelbe Seiten / 11880 / WLW scrapen
 * Nutzt Google Custom Search wie der funktionierende Prospector
 */
async function crawlGermanyRegion(
  region: string,
  industry: string,
  limit: number
): Promise<CompanyLead[]> {
  
  const leads: CompanyLead[] = []
  const keywords = INDUSTRY_KEYWORDS[industry as keyof typeof INDUSTRY_KEYWORDS] || [industry.toLowerCase()]
  
  console.log(`[DE Crawler] Searching ${region} for ${keywords.join(', ')}`)
  
  // Mehrere Suchanfragen: Fokus auf direkte Firmenwebsites statt Verzeichnisse
  const searchQueries = [
    `${keywords[0]} ${region} site:.de -site:gelbeseiten.de -site:wikipedia.org "impressum" "kontakt"`,
    `"${keywords[0]}" "${region}" site:.de "unternehmen" OR "firma" OR "betrieb"`,
    `${keywords[1] || keywords[0]} ${region} site:.de -site:facebook.com -site:linkedin.com "über uns"`
  ]
  
  for (const query of searchQueries) {
    try {
      const searchResults = await performGoogleSearch(query, Math.ceil(limit / searchQueries.length))
      
      for (const result of searchResults) {
        // Bestimme Quelle aus URL
        let sourceName = 'Google'
        if (result.link.includes('gelbeseiten.de')) sourceName = 'Gelbe Seiten'
        else if (result.link.includes('firmenabc.de')) sourceName = 'FirmenABC'
        else if (result.link.includes('11880.com')) sourceName = '11880.com'
        else if (result.link.includes('wlw.de')) sourceName = 'WLW'
        
        leads.push({
          name: result.title,
          website: result.link,
          address: result.snippet,
          city: region,
          region: region,
          country: 'DE',
          industry: industry,
          source: sourceName
        })
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      console.error(`[DE Crawler] Error with query "${query}":`, error)
    }
  }
  
  return leads.slice(0, limit)
}

/**
 * Österreich: Herold / firmenabc
 */
async function crawlAustriaRegion(
  region: string,
  industry: string,
  limit: number
): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = []
  const keywords = INDUSTRY_KEYWORDS[industry as keyof typeof INDUSTRY_KEYWORDS] || [industry.toLowerCase()]
  
  console.log(`[AT Crawler] Searching ${region} for ${industry}`)
  
  const searchQueries = [
    `${keywords[0]} ${region} site:herold.at OR site:firmenabc.at "impressum"`,
    `${keywords[0]} ${region} site:.at "firma" OR "unternehmen"`
  ]
  
  for (const query of searchQueries) {
    try {
      const searchResults = await performGoogleSearch(query, Math.ceil(limit / searchQueries.length))
      
      for (const result of searchResults) {
        let sourceName = 'Google'
        if (result.link.includes('herold.at')) sourceName = 'Herold.at'
        else if (result.link.includes('firmenabc.at')) sourceName = 'FirmenABC.at'
        
        leads.push({
          name: result.title,
          website: result.link,
          address: result.snippet,
          city: region,
          region: region,
          country: 'AT',
          industry: industry,
          source: sourceName
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      console.error(`[AT Crawler] Error with query "${query}":`, error)
    }
  }
  
  return leads.slice(0, limit)
}

/**
 * Schweiz: local.ch / search.ch
 */
async function crawlSwitzerlandRegion(
  region: string,
  industry: string,
  limit: number
): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = []
  const keywords = INDUSTRY_KEYWORDS[industry as keyof typeof INDUSTRY_KEYWORDS] || [industry.toLowerCase()]
  
  console.log(`[CH Crawler] Searching ${region} for ${industry}`)
  
  const searchQueries = [
    `${keywords[0]} ${region} site:local.ch OR site:search.ch "kontakt"`,
    `${keywords[0]} ${region} site:.ch "firma" OR "unternehmen"`
  ]
  
  for (const query of searchQueries) {
    try {
      const searchResults = await performGoogleSearch(query, Math.ceil(limit / searchQueries.length))
      
      for (const result of searchResults) {
        let sourceName = 'Google'
        if (result.link.includes('local.ch')) sourceName = 'local.ch'
        else if (result.link.includes('search.ch')) sourceName = 'search.ch'
        
        leads.push({
          name: result.title,
          website: result.link,
          address: result.snippet,
          city: region,
          region: region,
          country: 'CH',
          industry: industry,
          source: sourceName
        })
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      console.error(`[CH Crawler] Error with query "${query}":`, error)
    }
  }
  
  return leads.slice(0, limit)
}

/**
 * Führt Google-Suche aus (GLEICHE METHODE wie funktionierender Prospector)
 */
async function performGoogleSearch(
  query: string,
  limit: number
): Promise<Array<{ title: string; link: string; snippet: string }>> {
  
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID
  const useMockData = !apiKey || !engineId || process.env.USE_MOCK_COLDLEADS === 'true'
  
  // Falls Google API nicht konfiguriert, leere Ergebnisse zurückgeben
  if (useMockData) {
    console.log('[DACH Crawler] Google API not configured, returning empty results')
    return []
  }
  
  try {
    // EXAKT wie im funktionierenden Prospector
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey!)
    url.searchParams.set('cx', engineId!)
    url.searchParams.set('q', query)
    url.searchParams.set('num', Math.min(limit, 10).toString())
    url.searchParams.set('gl', 'de') // Germany
    url.searchParams.set('lr', 'lang_de') // German
    
    console.log('[DACH Crawler] Query:', query)
    
    const response = await fetch(url.toString())
    const data = await response.json()
    
    if (!response.ok) {
      console.error('[DACH Crawler] Google API Error:', data.error?.message || 'Unknown')
      return []
    }
    
    if (data.items && Array.isArray(data.items)) {
      console.log(`[DACH Crawler] Found ${data.items.length} results`)
      return data.items.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet || ''
      }))
    }
    
    console.log('[DACH Crawler] No results found')
    return []
    
  } catch (error) {
    console.error('[DACH Crawler] Exception:', error)
    return []
  }
}

/**
 * Bestimmt nächste zu crawlende Region
 */
function getNextRegion(
  currentCountry: string,
  currentRegion: string
): { country: string, region: string } | undefined {
  
  const regions = DACH_REGIONS[currentCountry as keyof typeof DACH_REGIONS]
  const currentIndex = regions.indexOf(currentRegion)
  
  if (currentIndex < regions.length - 1) {
    // Nächste Region im gleichen Land
    return {
      country: currentCountry,
      region: regions[currentIndex + 1]
    }
  }
  
  // Nächstes Land
  if (currentCountry === 'DE') {
    return { country: 'AT', region: DACH_REGIONS.AT[0] }
  } else if (currentCountry === 'AT') {
    return { country: 'CH', region: DACH_REGIONS.CH[0] }
  }
  
  // Alle Regionen durchlaufen
  return undefined
}

/**
 * Branchen-Validierung nach Crawl
 * Extrahiert echte Branche aus Website-Content
 */
export function validateIndustryFromWebsite(websiteContent: string): {
  detected_industry: string
  confidence: number
  keywords_found: string[]
} {
  const lowerContent = websiteContent.toLowerCase()
  const matches: { industry: string, score: number, keywords: string[] }[] = []
  
  // Durchsuche alle Branchen
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    let score = 0
    const foundKeywords: string[] = []
    
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        score += 1
        foundKeywords.push(keyword)
      }
    }
    
    if (score > 0) {
      matches.push({ industry, score, keywords: foundKeywords })
    }
  }
  
  // Sortiere nach Score
  matches.sort((a, b) => b.score - a.score)
  
  if (matches.length === 0) {
    return {
      detected_industry: 'Unbekannt',
      confidence: 0,
      keywords_found: []
    }
  }
  
  const best = matches[0]
  return {
    detected_industry: best.industry,
    confidence: Math.min(best.score * 20, 100), // Score * 20% = confidence
    keywords_found: best.keywords
  }
}

/**
 * PLZ-basiertes Crawling für Deutschland
 * Systematisch durch PLZ-Bereiche gehen
 */
export function generatePLZRanges(): { start: string, end: string, region: string }[] {
  return [
    { start: '01000', end: '01999', region: 'Sachsen' },
    { start: '02000', end: '02999', region: 'Sachsen' },
    { start: '03000', end: '03999', region: 'Brandenburg' },
    { start: '04000', end: '04999', region: 'Sachsen' },
    { start: '05000', end: '05999', region: 'Sachsen' },
    { start: '06000', end: '06999', region: 'Sachsen-Anhalt' },
    { start: '07000', end: '07999', region: 'Thüringen' },
    { start: '08000', end: '08999', region: 'Baden-Württemberg' },
    { start: '09000', end: '09999', region: 'Bayern' },
    { start: '10000', end: '14999', region: 'Berlin/Brandenburg' },
    // ... weitere PLZ-Bereiche
  ]
}

/**
 * Exportiert Crawling-Fortschritt als Dashboard-Daten
 */
export async function getCrawlStatistics(): Promise<{
  total_regions: number
  completed_regions: number
  pending_regions: number
  total_companies_found: number
  coverage_percentage: number
}> {
  // In Produktion: Aus MongoDB laden
  return {
    total_regions: 59, // 16 DE + 9 AT + 22 CH + 12 Branchen
    completed_regions: 0,
    pending_regions: 59,
    total_companies_found: 0,
    coverage_percentage: 0
  }
}
