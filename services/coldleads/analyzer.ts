/**
 * Kaltakquise - Phase 2: Analyzer
 * Crawlt Website und analysiert mit OpenAI
 */

import * as cheerio from 'cheerio'
import OpenAI from 'openai'

interface AnalysisResult {
  company_info: {
    name: string
    description: string
    products: string[]
    services: string[]
    employees_estimate?: string
  }
  contact_persons: Array<{
    name: string
    title: string
    department?: string
    email?: string
    phone?: string
  }>
  needs_assessment: {
    potential_products: string[]
    estimated_volume: 'low' | 'medium' | 'high'
    reasoning: string
    score: number // 0-100
  }
  website_quality: {
    has_impressum: boolean
    has_contact_page: boolean
    professional: boolean
  }
}

/**
 * Crawlt und analysiert eine Firmen-Website
 */
export async function analyzeCompany(websiteUrl: string, industry: string): Promise<AnalysisResult> {
  console.log(`[Analyzer] Analyzing: ${websiteUrl}`)

  // 1. Website crawlen
  const websiteData = await crawlWebsite(websiteUrl)

  // 2. OpenAI-Analyse
  const aiAnalysis = await analyzeWithAI(websiteData, industry)

  return {
    company_info: aiAnalysis.company_info,
    contact_persons: websiteData.contacts,
    needs_assessment: aiAnalysis.needs_assessment,
    website_quality: websiteData.quality
  }
}

/**
 * Crawlt Website und extrahiert relevante Informationen
 */
async function crawlWebsite(url: string) {
  const data = {
    text_content: '',
    contacts: [] as any[],
    quality: {
      has_impressum: false,
      has_contact_page: false,
      professional: true
    }
  }

  try {
    // Hauptseite laden
    const mainPage = await fetchPage(url)
    data.text_content += mainPage.text
    data.quality = mainPage.quality

    // Kontaktseite suchen
    const contactUrl = findContactPage(mainPage.html, url)
    if (contactUrl) {
      const contactPage = await fetchPage(contactUrl)
      data.contacts = extractContacts(contactPage.html)
    }

    // Impressum prüfen
    const impressumUrl = findImpressumPage(mainPage.html, url)
    if (impressumUrl) {
      data.quality.has_impressum = true
      const impressum = await fetchPage(impressumUrl)
      const impressumContacts = extractContacts(impressum.html)
      data.contacts.push(...impressumContacts)
    }

    // Deduplizieren
    data.contacts = deduplicateContacts(data.contacts)

  } catch (error) {
    console.error('[Analyzer] Crawling error:', error)
  }

  return data
}

/**
 * Lädt eine einzelne Seite
 */
async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ScoreCRM/1.0; +https://score-schleifwerkzeuge.de)'
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Text extrahieren
  $('script, style, nav, footer').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000) // Limit 5000 chars

  // Qualität bewerten
  const quality = {
    has_impressum: html.toLowerCase().includes('impressum'),
    has_contact_page: html.toLowerCase().includes('kontakt'),
    professional: !html.toLowerCase().includes('unter konstruktion')
  }

  return { html, text, quality }
}

/**
 * Findet Kontaktseite
 */
function findContactPage(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html)
  const contactLinks = $('a').filter((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().toLowerCase()
    return text.includes('kontakt') || href.includes('kontakt') || href.includes('contact')
  })

  if (contactLinks.length > 0) {
    const href = contactLinks.first().attr('href')
    return href ? new URL(href, baseUrl).href : null
  }

  return null
}

/**
 * Findet Impressum-Seite
 */
function findImpressumPage(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html)
  const impressumLinks = $('a').filter((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().toLowerCase()
    return text.includes('impressum') || href.includes('impressum')
  })

  if (impressumLinks.length > 0) {
    const href = impressumLinks.first().attr('href')
    return href ? new URL(href, baseUrl).href : null
  }

  return null
}

/**
 * Extrahiert Kontaktpersonen aus HTML
 */
function extractContacts(html: string) {
  const $ = cheerio.load(html)
  const contacts: any[] = []

  // Suche nach typischen Mustern
  const text = $('body').text()

  // Email-Adressen
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []

  // Telefonnummern
  const phones = text.match(/(\+49|0)\s*\d{2,5}[\s\-\/]*\d{3,}/g) || []

  // Namen mit Titeln (einfaches Pattern)
  const namePattern = /(Herr|Frau|Hr\.|Fr\.)\s+([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)/g
  const nameMatches = [...text.matchAll(namePattern)]

  for (const match of nameMatches) {
    contacts.push({
      name: match[2],
      title: '', // Wird von AI ergänzt
      email: emails[0] || null, // Erste Email als Fallback
      phone: phones[0] || null
    })
  }

  // Wenn keine Namen gefunden: Generic Contact
  if (contacts.length === 0 && emails.length > 0) {
    contacts.push({
      name: 'Vertrieb',
      title: 'Vertriebsleitung',
      email: emails[0],
      phone: phones[0] || null
    })
  }

  return contacts.slice(0, 3) // Max 3 Kontakte
}

/**
 * Dedupliziert Kontakte
 */
function deduplicateContacts(contacts: any[]) {
  const seen = new Set()
  return contacts.filter(c => {
    const key = c.email || c.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Analysiert mit OpenAI
 */
async function analyzeWithAI(websiteData: any, industry: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nicht konfiguriert')
  }

  const openai = new OpenAI({ apiKey })

  const prompt = `
Du bist ein B2B-Sales-Analyst für SCORE Schleifwerkzeuge (Hersteller von Schleifbändern, Schleifscheiben, Trennscheiben, etc.).

Analysiere diese Firma aus der Branche "${industry}":

Website-Content: ${websiteData.text_content}

Bitte liefere eine strukturierte Analyse als JSON:

{
  "company_info": {
    "name": "Firmenname",
    "description": "Kurze Beschreibung (max 100 Wörter)",
    "products": ["Produkt 1", "Produkt 2"],
    "services": ["Service 1"]
  },
  "needs_assessment": {
    "potential_products": ["Schleifbänder für Edelstahl", "Trennscheiben", etc.],
    "estimated_volume": "low|medium|high",
    "reasoning": "Warum passt diese Firma zu uns?",
    "score": 0-100
  }
}

Scoring-Kriterien:
- 80-100: Perfekter Match (große Fertigung, viel Metallverarbeitung)
- 60-79: Guter Lead (mittlere Fertigung)
- 40-59: Potenzial vorhanden
- 0-39: Wahrscheinlich nicht relevant
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Du bist ein präziser B2B-Analyst. Antworte nur mit validem JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 800
  })

  const content = response.choices[0].message.content || '{}'
  
  try {
    return JSON.parse(content)
  } catch {
    // Fallback wenn JSON-Parsing fehlschlägt
    return {
      company_info: {
        name: 'Unbekannt',
        description: content.slice(0, 200),
        products: [],
        services: []
      },
      needs_assessment: {
        potential_products: [],
        estimated_volume: 'medium',
        reasoning: 'Analyse konnte nicht vollständig durchgeführt werden',
        score: 50
      }
    }
  }
}
