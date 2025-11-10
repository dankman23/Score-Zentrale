/**
 * Kaltakquise - Phase 2: Analyzer (Erweitert & Intelligent)
 * Crawlt Website gründlich und generiert intelligente Produktempfehlungen
 */

import * as cheerio from 'cheerio'
import { detectApplications, generateProductRecommendations, APPLICATIONS, type Application } from './product-catalog'

interface AnalysisResult {
  company_info: {
    name: string
    description: string
    products: string[]
    services: string[]
    business_type?: 'manufacturer' | 'trader' | 'service' | 'mixed' | 'unknown'
    main_activity?: string
    company_size?: {
      estimate: string
      confidence: 'low' | 'medium' | 'high'
      indicators: string[]
    }
    detected_applications: Array<{
      name: string
      confidence: number
      description: string
    }>
    target_materials: string[]
  }
  contact_persons: Array<{
    name: string
    title: string
    department?: string
    email?: string
    phone?: string
    priority?: number
  }>
  needs_assessment: {
    potential_products: Array<{
      name: string
      category: string
      reason: string
    }>
    estimated_volume: 'low' | 'medium' | 'high'
    reasoning: string
    individual_hook: string
    score: number
  }
}

/**
 * Hauptfunktion: Analysiert Firma ROBUST
 */
export async function analyzeCompany(websiteUrl: string, industry: string): Promise<AnalysisResult> {
  console.log(`[Analyzer] ROBUST Analysis: ${websiteUrl}`)

  try {
    // 1. Website crawlen
    const websiteData = await crawlWebsite(websiteUrl)
    
    // 2. Kontakte extrahieren (funktioniert immer)
    const contacts = extractContacts(websiteData.html)
    
    // 3. ROBUST Analyse (AI → Fallback)
    const analysis = await robustAnalyze(websiteData, industry)
    
    return {
      company_info: analysis.company_info,
      contact_persons: contacts,
      needs_assessment: analysis.needs_assessment
    }
    
  } catch (error: any) {
    console.error('[Analyzer] Complete failure, using minimal fallback:', error)
    return createMinimalAnalysis(websiteUrl, industry)
  }
}

/**
 * Robuste Analyse mit mehreren Fallbacks
 */
async function robustAnalyze(websiteData: any, industry: string): Promise<any> {
  // FALLBACK 1: Keyword-basierte Analyse (IMMER verfügbar)
  console.log('[Analyzer] Using keyword-based analysis as primary method')
  return createKeywordAnalysis(websiteData, industry)
}

/**
 * Keyword-basierte Analyse (ROBUST fallback - funktioniert immer)
 */
function createKeywordAnalysis(websiteData: any, industry: string): any {
  const text = websiteData.text_content.toLowerCase()
  const fullText = websiteData.text_content // Original für bessere Extraktion
  const title = websiteData.title || ''
  
  // === 1. FIRMEN-KERNGESCHÄFT IDENTIFIZIEREN ===
  const businessType = identifyBusinessType(text, fullText)
  const companySize = estimateCompanySize(text, fullText)
  
  // === 2. MATERIALIEN & ANWENDUNGEN DETECTIEREN ===
  const detectedApps = detectApplications(text, industry)
  const recommendations = generateProductRecommendations(detectedApps)
  
  // === 3. SCORE BERECHNEN ===
  let score = 50 // Basis
  score += detectedApps.length * 15
  score += (recommendations.products.length > 0 ? 20 : 0)
  score += (businessType.isManufacturer ? 15 : 0) // Hersteller höher bewerten
  score = Math.min(score, 95)
  
  // === 4. MATERIALIEN FINDEN ===
  const materials = new Set<string>()
  const materialKeywords = ['stahl', 'edelstahl', 'aluminium', 'metall', 'holz', 'kunststoff', 'glas', 'keramik', 'titan', 'messing', 'kupfer']
  materialKeywords.forEach(mat => {
    if (text.includes(mat)) materials.add(mat)
  })
  
  // === 5. REASONING ERWEITERN ===
  const reasoning = []
  if (businessType.mainActivity) {
    reasoning.push(businessType.mainActivity)
  }
  if (businessType.products.length > 0) {
    reasoning.push(`Produkte/Leistungen: ${businessType.products.slice(0, 3).join(', ')}`)
  }
  if (detectedApps.length > 0) {
    reasoning.push(`Anwendungsbereiche: ${detectedApps.map(a => a.name).join(', ')}`)
  }
  if (materials.size > 0) {
    reasoning.push(`Materialien: ${Array.from(materials).join(', ')}`)
  }
  if (companySize.estimate) {
    reasoning.push(`Firmengröße: ${companySize.estimate}`)
  }
  
  // === 6. PERSÖNLICHEN HOOK GENERIEREN ===
  let hook = businessType.mainActivity || `Potenzial im Bereich ${industry}`
  if (detectedApps.length > 0) {
    hook = `Spezialisiert auf ${detectedApps[0].name}`
  }
  
  return {
    company_info: {
      name: title.split('-')[0].trim() || title.slice(0, 50) || 'Firma',
      description: reasoning.length > 0 
        ? `${reasoning[0]}. ${reasoning.slice(1).join('. ')}.`
        : `Unternehmen im Bereich ${industry}`,
      products: businessType.products,
      services: businessType.services,
      business_type: businessType.type, // 'manufacturer', 'trader', 'service', 'mixed'
      main_activity: businessType.mainActivity,
      company_size: companySize,
      detected_applications: detectedApps.map(a => ({
        name: a.name,
        confidence: (a as any).confidence || 0,
        description: a.description
      })),
      target_materials: Array.from(materials)
    },
    needs_assessment: {
      potential_products: recommendations.products.map(p => ({
        name: p.name,
        category: p.category,
        reason: p.reason,
        // Entferne grain_sizes!
      })),
      estimated_volume: recommendations.estimated_volume,
      reasoning: reasoning.join('. ') + '.',
      individual_hook: hook,
      score: score
    }
  }
}

/**
 * Identifiziert Geschäftstyp und Kernaktivitäten
 */
function identifyBusinessType(text: string, fullText: string) {
  const result = {
    type: 'unknown' as 'manufacturer' | 'trader' | 'service' | 'mixed' | 'unknown',
    mainActivity: '',
    products: [] as string[],
    services: [] as string[],
    isManufacturer: false
  }
  
  // HERSTELLER-Indikatoren
  const manufacturerKeywords = [
    'herstell', 'produzi', 'fertigung', 'fabrik', 'werk', 'produktion',
    'eigene produktion', 'in-house', 'manufaktur', 'montage', 'fabrizier',
    'entwicklung und fertigung', 'konstruktion', 'maschinenpark',
    'produzent', 'erzeugen', 'anfertigung', 'gewerbe', 'industriell'
  ]
  
  // HÄNDLER-Indikatoren
  const traderKeywords = [
    'handel', 'vertrieb', 'verkauf', 'handelsunternehmen',
    'großhandel', 'einzelhandel', 'lieferant', 'vertriebspartner'
  ]
  
  // DIENSTLEISTUNGS-Indikatoren
  const serviceKeywords = [
    'dienstleistung', 'service', 'wartung', 'reparatur',
    'beratung', 'planung', 'installation', 'montageservice'
  ]
  
  let manufacturerScore = 0
  let traderScore = 0
  let serviceScore = 0
  
  manufacturerKeywords.forEach(kw => { if (text.includes(kw)) manufacturerScore += 2 }) // Höhere Gewichtung!
  traderKeywords.forEach(kw => { if (text.includes(kw)) traderScore++ })
  serviceKeywords.forEach(kw => { if (text.includes(kw)) serviceScore++ })
  
  // Bestimme Haupttyp mit klarer Priorisierung
  if (manufacturerScore >= 2) { // Mindestens 1 Hersteller-Keyword gefunden
    if (traderScore > 0) {
      result.type = 'mixed'
      result.isManufacturer = true
      result.mainActivity = 'Hersteller und Handel'
    } else {
      result.type = 'manufacturer'
      result.isManufacturer = true
      result.mainActivity = 'Hersteller'
    }
  } else if (traderScore > manufacturerScore && traderScore > serviceScore) {
    result.type = 'trader'
    result.mainActivity = 'Handel/Vertrieb'
  } else {
    result.type = 'service'
    result.mainActivity = 'Dienstleister'
  }
  
  // Extrahiere konkrete Produkte/Dienstleistungen - VERBESSERT
  const productPatterns = [
    /(?:herstell(?:en|ung|t)|produzi(?:eren|ert)|fertigung|fertigen) (?:von |für )?([A-ZÄÖÜ][a-zäöüß\s,\-]{8,45})/g,
    /(?:produkte?:|angebot:|leistungen?:)\s*([A-ZÄÖÜ][a-zäöüß\s,\-]{8,45})/g,
    /(?:spezialisiert auf|expertise (?:in|für)|schwerpunkt|kernkompetenz)\s*([A-ZÄÖÜ][a-zäöüß\s,\-]{8,45})/g
  ]
  
  const foundProducts = new Set<string>()
  
  productPatterns.forEach(pattern => {
    const matches = fullText.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        let cleaned = match[1].trim()
        // Entferne trailing Satzzeichen und Artikel
        cleaned = cleaned.replace(/[,.\-:;!?]+$/, '').trim()
        cleaned = cleaned.replace(/^(der|die|das|den|dem|des|ein|eine|eines)\s+/i, '')
        cleaned = cleaned.replace(/\s+/g, ' ')
        
        // Filter: Mindestlänge, keine reinen Zahlen, keine sehr kurzen Wörter
        if (cleaned.length >= 10 && cleaned.length <= 50 && !/^\d+$/.test(cleaned)) {
          // Filter zu generische Begriffe aus
          const generic = ['unternehmen', 'firma', 'betrieb', 'gesellschaft', 'gmbh', 'ag']
          if (!generic.some(g => cleaned.toLowerCase().includes(g))) {
            foundProducts.add(cleaned)
          }
        }
      }
    }
  })
  
  result.products = Array.from(foundProducts).slice(0, 5)
  
  return result
}

/**
 * Schätzt Firmengröße
 */
function estimateCompanySize(text: string, fullText: string) {
  const result = {
    estimate: 'Unbekannt',
    confidence: 'low' as 'low' | 'medium' | 'high',
    indicators: [] as string[]
  }
  
  // Direkte Mitarbeiter-Angaben
  const employeeMatches = fullText.match(/(\d+)\s*(?:mitarbeiter|beschäftigte|angestellte)/i)
  if (employeeMatches) {
    const count = parseInt(employeeMatches[1])
    if (count < 50) {
      result.estimate = 'Klein (< 50 MA)'
    } else if (count < 250) {
      result.estimate = 'Mittel (50-250 MA)'
    } else {
      result.estimate = 'Groß (> 250 MA)'
    }
    result.confidence = 'high'
    result.indicators.push(`${count} Mitarbeiter angegeben`)
    return result
  }
  
  // Indirekte Indikatoren
  let sizeScore = 0
  
  // Klein-Indikatoren
  if (text.includes('familienunternehmen') || text.includes('inhabergeführt')) {
    sizeScore -= 2
    result.indicators.push('Familienunternehmen/inhabergeführt')
  }
  if (text.includes('meisterbetrieb') || text.includes('handwerksbetrieb')) {
    sizeScore -= 2
    result.indicators.push('Handwerksbetrieb')
  }
  
  // Mittel-Indikatoren
  if (text.includes('standort') && !text.includes('standorte')) {
    sizeScore += 0
  }
  if (text.match(/\d+ jahre? erfahrung/i)) {
    sizeScore += 1
    result.indicators.push('Langjährige Erfahrung')
  }
  
  // Groß-Indikatoren
  if (text.includes('standorte') || text.includes('niederlassungen')) {
    sizeScore += 3
    result.indicators.push('Mehrere Standorte')
  }
  if (text.includes('konzern') || text.includes('unternehmensgruppe')) {
    sizeScore += 4
    result.indicators.push('Konzern/Unternehmensgruppe')
  }
  if (text.includes('weltweit') || text.includes('international')) {
    sizeScore += 2
    result.indicators.push('Internationale Tätigkeit')
  }
  if (text.includes('iso') || text.includes('zertifizierung')) {
    sizeScore += 1
    result.indicators.push('Zertifizierungen')
  }
  
  // Schätzung basierend auf Score
  if (sizeScore <= -2) {
    result.estimate = 'Klein (< 50 MA)'
    result.confidence = 'medium'
  } else if (sizeScore >= 4) {
    result.estimate = 'Groß (> 250 MA)'
    result.confidence = 'medium'
  } else if (sizeScore >= 1) {
    result.estimate = 'Mittel (50-250 MA)'
    result.confidence = 'medium'
  } else {
    result.estimate = 'Klein bis Mittel'
    result.confidence = 'low'
  }
  
  return result
}

/**
 * Minimale Analyse als letzter Fallback
 */
function createMinimalAnalysis(websiteUrl: string, industry: string): AnalysisResult {
  return {
    company_info: {
      name: new URL(websiteUrl).hostname.replace('www.', ''),
      description: `Unternehmen im Bereich ${industry}`,
      products: [],
      services: [],
      detected_applications: [],
      target_materials: []
    },
    contact_persons: [],
    needs_assessment: {
      potential_products: [{
        name: 'Schleifmittel allgemein',
        category: 'Allgemein',
        reason: 'Branchenbasierte Empfehlung'
      }],
      estimated_volume: 'medium' as 'medium',
      reasoning: `Branche ${industry} deutet auf möglichen Bedarf hin.`,
      individual_hook: `Unternehmen aus ${industry}`,
      score: 40
    }
  }
}

/**
 * Crawlt Website gründlicher - mit mehreren Seiten
 */
async function crawlWebsite(url: string) {
  console.log(`[Crawler] Starting comprehensive crawl of ${url}`)
  
  try {
    // 1. Hauptseite crawlen
    const mainPage = await fetchPage(url)
    const $ = cheerio.load(mainPage.html)
    
    // 2. Sammle alle internen Links
    const links: string[] = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).toString()
          const mainDomain = new URL(url).hostname
          const linkDomain = new URL(absoluteUrl).hostname
          
          // Nur interne Links von gleicher Domain
          if (linkDomain === mainDomain) {
            links.push(absoluteUrl)
          }
        } catch (e) {
          // Ungültiger Link, ignorieren
        }
      }
    })
    
    console.log(`[Crawler] Found ${links.length} internal links`)
    
    // 3. Priorisiere interessante Seiten
    const priorityKeywords = ['leistung', 'service', 'über-uns', 'about', 'produkt', 'fertigung', 'kontakt']
    const priorityLinks = links.filter(link => 
      priorityKeywords.some(kw => link.toLowerCase().includes(kw))
    ).slice(0, 3) // Max 3 zusätzliche Seiten
    
    console.log(`[Crawler] Selected ${priorityLinks.length} priority pages to crawl`)
    
    // 4. Crawle zusätzliche Seiten
    let combinedText = mainPage.text_content
    
    for (const link of priorityLinks) {
      try {
        const page = await fetchPage(link)
        combinedText += ' ' + page.text_content
        console.log(`[Crawler] Crawled: ${link} (+${page.text_content.length} chars)`)
      } catch (e) {
        console.log(`[Crawler] Failed to crawl ${link}:`, e)
      }
    }
    
    console.log(`[Crawler] Total text content: ${combinedText.length} chars`)
    
    return { 
      html: mainPage.html, 
      text_content: combinedText.slice(0, 15000), // Mehr Text für bessere Analyse
      title: mainPage.title 
    }
    
  } catch (error: any) {
    console.error('[Crawler] Complete failure:', error.message)
    return { html: '', text_content: '', title: '' }
  }
}

/**
 * Fetched einzelne Seite
 */
async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; SCORE-Bot/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    signal: AbortSignal.timeout(15000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Entferne unnötige Elemente
  $('script, style, nav, footer, header').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()

  return { 
    html, 
    text_content: text, 
    title: $('title').text() 
  }
}

/**
 * Extrahiert Kontakte mit intelligenter Priorisierung
 */
function extractContacts(html: string) {
  const $ = cheerio.load(html)
  const contacts: any[] = []
  const text = $('body').text()

  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const phones = text.match(/(\+49|0)\s*\(?\d{2,5}\)?[\s\-\/]*\d{3,}[\s\-]*\d*/g) || []

  console.log(`[Analyzer] Found ${emails.length} emails, ${phones.length} phones`)

  // Priorisierte Suche nach relevanten Kontakten
  const searchPatterns = [
    { regex: /einkauf[^\n]{0,150}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, name: 'Einkauf', dept: 'Einkauf', priority: 1 },
    { regex: /vertrieb[^\n]{0,150}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, name: 'Vertrieb', dept: 'Vertrieb', priority: 2 },
    { regex: /beschaffung[^\n]{0,150}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, name: 'Beschaffung', dept: 'Beschaffung', priority: 1 },
    { regex: /geschäftsführung[^\n]{0,150}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, name: 'Geschäftsführung', dept: 'GF', priority: 2 },
    { regex: /werkstatt[^\n]{0,150}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, name: 'Werkstatt', dept: 'Produktion', priority: 3 }
  ]

  for (const pattern of searchPatterns) {
    const match = text.match(pattern.regex)
    if (match && match[1]) {
      contacts.push({
        name: pattern.name,
        title: `${pattern.dept}sabteilung`,
        department: pattern.dept,
        email: match[1],
        phone: phones[0] || null,
        priority: pattern.priority
      })
      console.log(`[Analyzer] Found targeted contact: ${pattern.name} - ${match[1]}`)
    }
  }

  // Filtere generische Emails aus (info@, kontakt@, etc.)
  const genericPrefixes = ['info', 'kontakt', 'contact', 'mail', 'office', 'service', 'support']
  const qualityEmails = emails.filter(email => {
    const prefix = email.split('@')[0].toLowerCase()
    return !genericPrefixes.includes(prefix)
  })

  console.log(`[Analyzer] Quality emails (non-generic): ${qualityEmails.length}`)

  // Füge beste nicht-generische Email als Fallback hinzu
  if (contacts.length === 0 && qualityEmails.length > 0) {
    contacts.push({
      name: 'Kontakt',
      title: 'Ansprechpartner',
      department: 'Allgemein',
      email: qualityEmails[0],
      phone: phones[0] || null,
      priority: 4
    })
    console.log(`[Analyzer] Added fallback quality contact: ${qualityEmails[0]}`)
  }

  // Letzter Fallback: Erste Email (auch wenn generisch)
  if (contacts.length === 0 && emails.length > 0) {
    contacts.push({
      name: 'Kontakt',
      title: 'Allgemein',
      department: 'Allgemein',
      email: emails[0],
      phone: phones[0] || null,
      priority: 5
    })
    console.log(`[Analyzer] Added generic fallback contact: ${emails[0]}`)
  }

  // Sortiere nach Priorität
  contacts.sort((a, b) => a.priority - b.priority)

  return contacts.slice(0, 5) // Top 5 Kontakte
}
