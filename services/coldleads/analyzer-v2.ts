/**
 * Kaltakquise Analyzer V2
 * Basierend auf ChatGPT Briefing - Strukturiertes Parsing + Glossar-Mapping
 */

import { mapToGlossary, getProductRecommendations } from '@/lib/glossary'

interface AnalysisResult {
  company_profile: {
    name: string
    url: string
    industry: string
    services: string[]
    materials: string[]
    processes_machines: string[]
    references: string[]
    location: string
    mapped_terms: {
      applications: string[]
      categories: string[]
      materials: string[]
      machines: string[]
    }
  }
  contact: {
    found: boolean
    name: string
    role: string
    email: string
    phone: string
  }
  assessment: {
    relevance_score: number
    why_fit: string
    recommended_products: string[]
  }
  do_not_contact: boolean
  notes: string
  glossary_persisted: boolean
}

/**
 * Analysiert eine Firmen-Website strukturiert
 */
export async function analyzeCompanyV2(
  websiteUrl: string,
  industry?: string,
  region?: string
): Promise<AnalysisResult> {
  
  console.log(`[AnalyzerV2] Analyzing: ${websiteUrl}`)
  
  // 1. Website crawlen mit strukturiertem Ansatz
  const crawlData = await crawlWebsiteStructured(websiteUrl)
  
  // 2. Glossar-Mapping durchführen
  const fullText = [
    crawlData.leistungen,
    crawlData.produkte,
    crawlData.fertigung,
    crawlData.maschinen,
    crawlData.referenzen
  ].join(' ')
  
  const mappedTerms = mapToGlossary(fullText)
  
  // 3. Kontaktperson finden
  const contact = findBestContact(crawlData.kontakt, crawlData.team, crawlData.impressum)
  
  // 4. Relevanz bewerten
  const assessment = assessRelevance(mappedTerms, crawlData, industry)
  
  // 5. Do-not-contact Prüfung
  const doNotContact = shouldNotContact(crawlData, mappedTerms)
  
  // 6. Company Profile zusammenstellen
  const companyProfile = {
    name: extractCompanyName(crawlData),
    url: websiteUrl,
    industry: industry || 'Unbekannt',
    services: extractServices(crawlData),
    materials: extractMaterials(crawlData, mappedTerms),
    processes_machines: extractProcessesMachines(crawlData, mappedTerms),
    references: extractReferences(crawlData),
    location: extractLocation(crawlData, region),
    mapped_terms: mappedTerms
  }
  
  return {
    company_profile: companyProfile,
    contact,
    assessment,
    do_not_contact: doNotContact.flag,
    notes: doNotContact.reason || generateNotes(crawlData),
    glossary_persisted: true
  }
}

/**
 * Crawlt Website strukturiert nach Scraping-Pfad
 */
async function crawlWebsiteStructured(url: string) {
  // Pfade in Reihenfolge: /leistungen | /produkte | /fertigung | /maschinen | /referenzen | /projekte | /impressum | /kontakt | /team
  const paths = [
    '', // Homepage
    '/leistungen',
    '/produkte',
    '/fertigung',
    '/maschinen',
    '/referenzen',
    '/projekte',
    '/impressum',
    '/kontakt',
    '/team',
    '/ueber-uns',
    '/about'
  ]
  
  const result = {
    leistungen: '',
    produkte: '',
    fertigung: '',
    maschinen: '',
    referenzen: '',
    impressum: '',
    kontakt: '',
    team: ''
  }
  
  // Vereinfachtes Crawling - in Produktion würde man hier Playwright/Cheerio verwenden
  // Für MVP: Simuliere mit Homepage-Content
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    })
    const html = await response.text()
    
    // Extrahiere Text (sehr vereinfacht)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Verteile auf Bereiche (vereinfacht)
    result.leistungen = text
    result.produkte = text
    result.impressum = text
    result.kontakt = text
    
  } catch (error) {
    console.error('[AnalyzerV2] Crawl error:', error)
  }
  
  return result
}

/**
 * Findet beste Kontaktperson nach Priorität:
 * Einkauf/Beschaffung (1) > Produktion/Werkstatt (2) > GF (3) > Generisch (4)
 */
function findBestContact(kontaktText: string, teamText: string, impressumText: string): {
  found: boolean
  name: string
  role: string
  email: string
  phone: string
} {
  const allText = [kontaktText, teamText, impressumText].join(' ')
  
  // Prio 1: Einkauf/Beschaffung
  let contact = extractContactByRole(allText, ['einkauf', 'beschaffung', 'procurement', 'purchasing'])
  if (contact.found) {
    contact.role = 'Einkauf'
    return contact
  }
  
  // Prio 2: Produktion/Werkstatt
  contact = extractContactByRole(allText, ['produktion', 'werkstatt', 'fertigung', 'technik', 'operations'])
  if (contact.found) {
    contact.role = 'Produktion'
    return contact
  }
  
  // Prio 3: Geschäftsführung
  contact = extractContactByRole(allText, ['geschäftsführ', 'geschaeftsfuehr', 'gf', 'ceo', 'managing director'])
  if (contact.found) {
    contact.role = 'Geschäftsführung'
    return contact
  }
  
  // Prio 4: Generisch
  contact = extractGenericContact(allText)
  contact.role = 'Allgemein'
  
  return contact
}

function extractContactByRole(text: string, keywords: string[]): {
  found: boolean
  name: string
  role: string
  email: string
  phone: string
} {
  const lowerText = text.toLowerCase()
  
  for (const keyword of keywords) {
    if (lowerText.includes(keyword)) {
      // Extrahiere Email in der Nähe
      const keywordPos = lowerText.indexOf(keyword)
      const context = text.substring(Math.max(0, keywordPos - 200), Math.min(text.length, keywordPos + 200))
      
      const email = extractEmail(context)
      const phone = extractPhone(context)
      const name = extractName(context)
      
      if (email || phone) {
        return {
          found: true,
          name: name || '',
          role: keyword,
          email: email || '',
          phone: phone || ''
        }
      }
    }
  }
  
  return {
    found: false,
    name: '',
    role: '',
    email: '',
    phone: ''
  }
}

function extractGenericContact(text: string): {
  found: boolean
  name: string
  role: string
  email: string
  phone: string
} {
  const email = extractEmail(text)
  const phone = extractPhone(text)
  
  // Mindestens Email muss vorhanden sein
  if (!email) {
    // Generiere generische Email
    const domain = extractDomain(text)
    return {
      found: true,
      name: '',
      role: 'Allgemein',
      email: domain ? `info@${domain}` : '',
      phone: phone || ''
    }
  }
  
  return {
    found: true,
    name: '',
    role: 'Allgemein',
    email,
    phone: phone || ''
  }
}

function extractEmail(text: string): string {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailRegex)
  
  if (!matches || matches.length === 0) return ''
  
  // Priorisiere nicht-generische Emails
  const nonGeneric = matches.find(e => !/(info|kontakt|mail|office|hello)@/.test(e.toLowerCase()))
  return nonGeneric || matches[0]
}

function extractPhone(text: string): string {
  const phoneRegex = /(\+49|0)[0-9\s\-\/()]{8,20}/g
  const matches = text.match(phoneRegex)
  return matches ? matches[0].replace(/\s+/g, ' ').trim() : ''
}

function extractName(text: string): string {
  // Vereinfachte Namenserkennung
  const nameRegex = /([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][a-zäöüß]+)/g
  const matches = text.match(nameRegex)
  return matches ? matches[0] : ''
}

function extractDomain(text: string): string {
  const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+)/
  const match = text.match(urlRegex)
  return match ? match[1] : ''
}

/**
 * Bewertet Relevanz des Unternehmens
 */
function assessRelevance(
  mappedTerms: ReturnType<typeof mapToGlossary>,
  crawlData: any,
  industry?: string
): {
  relevance_score: number
  why_fit: string
  recommended_products: string[]
} {
  let score = 0
  const reasons: string[] = []
  
  // Metall/Stahl/Maschinen/Schweißen/Fertigung = hohe Relevanz
  const highValueKeywords = ['metall', 'stahl', 'maschinen', 'schweißen', 'fertigung', 'produktion', 'werkstatt']
  const allText = Object.values(crawlData).join(' ').toLowerCase()
  
  for (const keyword of highValueKeywords) {
    if (allText.includes(keyword)) {
      score += 15
      reasons.push(`${keyword.charAt(0).toUpperCase() + keyword.slice(1)}-Branche`)
    }
  }
  
  // Gemappte Begriffe erhöhen Score
  score += mappedTerms.applications.length * 5
  score += mappedTerms.materials.length * 5
  score += mappedTerms.machines.length * 3
  
  if (mappedTerms.applications.length > 0) {
    reasons.push(`${mappedTerms.applications.length} relevante Anwendungen`)
  }
  if (mappedTerms.materials.length > 0) {
    reasons.push(`${mappedTerms.materials.length} passende Werkstoffe`)
  }
  
  // Cap bei 100
  score = Math.min(score, 100)
  
  const recommended_products = getProductRecommendations(mappedTerms)
  
  return {
    relevance_score: score,
    why_fit: reasons.join(', ') || 'Potenzial im B2B-Bereich',
    recommended_products
  }
}

/**
 * Prüft ob Unternehmen kontaktiert werden sollte
 */
function shouldNotContact(crawlData: any, mappedTerms: ReturnType<typeof mapToGlossary>): {
  flag: boolean
  reason?: string
} {
  const allText = Object.values(crawlData).join(' ').toLowerCase()
  
  // Private Seiten
  if (allText.includes('privatperson') || allText.includes('blog') || allText.includes('portfolio')) {
    return { flag: true, reason: 'Reine Privatseite/Blog' }
  }
  
  // Keine Relevanz
  if (mappedTerms.applications.length === 0 && 
      mappedTerms.materials.length === 0 && 
      !allText.includes('metall') &&
      !allText.includes('fertigung')) {
    return { flag: true, reason: 'Kein Fit - keine relevanten Anwendungen/Materialien' }
  }
  
  return { flag: false }
}

// Helper Functions
function extractCompanyName(crawlData: any): string {
  // Vereinfacht - würde aus Title/Meta extrahiert
  return 'Firma'
}

function extractServices(crawlData: any): string[] {
  // Vereinfacht
  return []
}

function extractMaterials(crawlData: any, mapped: any): string[] {
  return mapped.materials
}

function extractProcessesMachines(crawlData: any, mapped: any): string[] {
  return [...mapped.applications, ...mapped.machines]
}

function extractReferences(crawlData: any): string[] {
  return []
}

function extractLocation(crawlData: any, region?: string): string {
  return region || ''
}

function generateNotes(crawlData: any): string {
  return 'Website erfolgreich analysiert'
}
