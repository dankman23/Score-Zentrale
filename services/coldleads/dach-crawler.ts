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

// Branchen-Mapping mit Suchbegriffen
const INDUSTRY_KEYWORDS = {
  'Metallverarbeitung': [
    'metallbau', 'metallverarbeitung', 'stahlbau', 'blechbearbeitung',
    'maschinenbau', 'schweißtechnik', 'schlosserei'
  ],
  'Schreinerei': [
    'schreinerei', 'tischlerei', 'möbelbau', 'holzverarbeitung'
  ],
  'Automobilindustrie': [
    'kfz', 'autolackierung', 'karosseriebau', 'fahrzeugbau'
  ],
  'Oberflächentechnik': [
    'pulverbeschichtung', 'lackiererei', 'galvanik', 'oberflächenbehandlung'
  ],
  'Werkzeugbau': [
    'werkzeugbau', 'formenbau', 'stanzerei'
  ]
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
  
  const leads: CompanyLead[] = []
  
  // Strategie basierend auf Land
  switch (country) {
    case 'DE':
      // Gelbe Seiten / 11880.com scrapen (simuliert)
      const deLeads = await crawlGermanyRegion(region, industry, limit)
      leads.push(...deLeads)
      break
      
    case 'AT':
      // Herold.at / firmenabc.at scrapen (simuliert)
      const atLeads = await crawlAustriaRegion(region, industry, limit)
      leads.push(...atLeads)
      break
      
    case 'CH':
      // local.ch / search.ch scrapen (simuliert)
      const chLeads = await crawlSwitzerlandRegion(region, industry, limit)
      leads.push(...chLeads)
      break
  }
  
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
 */
async function crawlGermanyRegion(
  region: string,
  industry: string,
  limit: number
): Promise<CompanyLead[]> {
  
  // Für MVP: Simulierte Daten
  // In Produktion: Echtes Scraping mit Playwright
  
  const leads: CompanyLead[] = []
  const keywords = INDUSTRY_KEYWORDS[industry as keyof typeof INDUSTRY_KEYWORDS] || [industry.toLowerCase()]
  
  console.log(`[DE Crawler] Searching ${region} for ${keywords.join(', ')}`)
  
  // Simuliere Fund von Unternehmen
  // In Produktion würde hier das echte Scraping stattfinden
  
  return leads
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
  console.log(`[AT Crawler] Searching ${region}`)
  return leads
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
  console.log(`[CH Crawler] Searching ${region}`)
  return leads
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
