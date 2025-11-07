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
 * Dedupliziert Kontakte basierend auf Email
 */
function deduplicateContacts(contacts: any[]): any[] {
  const seen = new Set()
  return contacts.filter(c => {
    const key = c.email || c.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Extrahiert Kontaktpersonen aus HTML mit Fokus auf Einkauf & Produktion
 */
function extractContacts(html: string) {
  const $ = cheerio.load(html)
  const contacts: any[] = []

  // Suche nach typischen Mustern
  const text = $('body').text()
  const lowerText = text.toLowerCase()

  // Email-Adressen
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  
  // Telefonnummern (verbessertes Pattern)
  const phones = text.match(/(\+49|0)\s*\(?\d{2,5}\)?[\s\-\/]*\d{3,}[\s\-]*\d*/g) || []

  // PRIORITY 1: Einkauf (Material)
  const einkaufPatterns = [
    /einkauf[^\n]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /material.*einkauf[^\n]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /beschaffung[^\n]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
  ]
  
  for (const pattern of einkaufPatterns) {
    const matches = [...text.matchAll(pattern)]
    for (const match of matches) {
      if (match[1]) {
        contacts.push({
          name: 'Einkauf Material',
          title: 'Einkaufsleitung Material',
          department: 'Einkauf',
          email: match[1],
          phone: phones[0] || null,
          priority: 1
        })
        break
      }
    }
  }

  // PRIORITY 2: Produktion
  const produktionPatterns = [
    /produktion[^\n]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /fertigungs?leitung[^\n]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /betriebsleiter[^\n]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
  ]
  
  for (const pattern of produktionPatterns) {
    const matches = [...text.matchAll(pattern)]
    for (const match of matches) {
      if (match[1]) {
        contacts.push({
          name: 'Produktionsleitung',
          title: 'Produktionsleiter',
          department: 'Produktion',
          email: match[1],
          phone: phones[1] || phones[0] || null,
          priority: 2
        })
        break
      }
    }
  }

  // Namen mit Titeln und Rollen
  const rolePatterns = [
    /(Herr|Frau|Hr\.|Fr\.)\s+([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß-]+)[^\n]{0,50}?(Einkauf|Produktion|Fertigung|Geschäftsführung)/gi,
    /([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß-]+)[,\s]+(Einkaufs?leiter|Produktions?leiter|Fertigungs?leiter)/gi
  ]

  for (const pattern of rolePatterns) {
    const matches = [...text.matchAll(pattern)]
    for (const match of matches) {
      const name = match[2] || match[1]
      const role = match[3] || match[2]
      
      contacts.push({
        name: name,
        title: role,
        department: role.toLowerCase().includes('einkauf') ? 'Einkauf' : 'Produktion',
        email: emails[contacts.length] || emails[0] || null,
        phone: phones[contacts.length] || phones[0] || null,
        priority: role.toLowerCase().includes('einkauf') ? 1 : 2
      })
    }
  }

  // Wenn keine spezifischen Kontakte gefunden: Fallback
  if (contacts.length === 0) {
    // Einkauf als Fallback
    if (lowerText.includes('einkauf') && emails.length > 0) {
      contacts.push({
        name: 'Einkauf',
        title: 'Einkaufsabteilung',
        department: 'Einkauf',
        email: emails[0],
        phone: phones[0] || null,
        priority: 1
      })
    }
    // Generic Vertrieb
    if (contacts.length === 0 && emails.length > 0) {
      contacts.push({
        name: 'Vertrieb',
        title: 'Vertriebsleitung',
        department: 'Vertrieb',
        email: emails[0],
        phone: phones[0] || null,
        priority: 3
      })
    }
  }

  // Nach Priorität sortieren und deduplizieren
  return deduplicateContacts(contacts)
    .sort((a, b) => (a.priority || 3) - (b.priority || 3))
    .slice(0, 5) // Max 5 Kontakte
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
Du bist ein B2B-Sales-Analyst für SCORE Schleifwerkzeuge - spezialisiert auf Oberflächenbearbeitung.

**ÜBER SCORE:**
- 15 Jahre Erfahrung im Schleifmittel-Vertrieb
- Kontakte zu ALLEN führenden Herstellern: Klingspor, VSM, Starke, 3M, Bosch, etc.
- Komplettes Portfolio: Schleifbänder, Fächerscheiben, Fiberscheiben, Trennscheiben, Schruppscheiben
- Für jede Oberflächenbearbeitungs-Anwendung die passende Lösung

**ZIELGRUPPEN (Oberflächenbearbeitung):**
- Metallbau & Stahlbau (Schweißnahtbearbeitung, Entgraten, Polieren)
- Edelstahlverarbeitung (Finish, Spiegeloberflächen, Korrosionsschutz)
- Maschinenbau & Anlagenbau (Bauteile, Komponenten)
- Automotive (Karosseriebau, Zulieferer)
- Schlossereien & Metallwerkstätten
- Holzbearbeitung (Möbelbau, Schreinereien, Tischlereien)
- Lackierereien (Oberflächenvorbereitung)
- Fertigungsbetriebe mit Schleifprozessen

**ANALYSIERE DIESE FIRMA:**
Branche: "${industry}"
Website-Content: ${websiteData.text_content}

**AUFGABE:**
Analysiere ob und warum diese Firma Schleifmittel benötigt. Identifiziere spezifische Anwendungen und Entscheidungspersonen.

**OUTPUT (JSON):**
{
  "company_info": {
    "name": "Firmenname",
    "description": "Was macht die Firma? Produkte/Dienstleistungen (max 80 Wörter)",
    "products": ["Hauptprodukt 1", "Hauptprodukt 2"],
    "services": ["Hauptservice 1"],
    "surface_processing_indicators": ["Schweißen", "Polieren", "Schleifen", etc.],
    "target_materials": ["Edelstahl", "Stahl", "Aluminium", "Holz", etc.]
  },
  "needs_assessment": {
    "potential_products": ["Schleifbänder K80", "Fächerscheiben 125mm", etc.],
    "estimated_volume": "low|medium|high",
    "reasoning": "DETAILLIERT: Welche konkreten Schleif-Anwendungen hat die Firma? Warum brauchen sie unsere Produkte? Welche Prozesse verwenden Schleifmittel?",
    "score": 0-100,
    "individual_hook": "Spezifischer Aufhänger für Email (z.B. 'spezialisiert auf Edelstahl-Schweißkonstruktionen')"
  }
}

**SCORING (0-100):**
- 85-100: TOP-Lead - Kernzielgruppe mit hohem Volumen (Fertigung, viele Mitarbeiter, Schweißen/Schleifen erwähnt)
- 70-84: Sehr guter Lead - Klare Schleifmittel-Anwendung erkennbar
- 55-69: Guter Lead - Potenzial vorhanden, Oberflächenbearbeitung wahrscheinlich
- 40-54: Mittleres Potenzial - Branche passt, Details unklar
- 0-39: Geringes Potenzial - Kein klarer Bedarf erkennbar

**WICHTIG:**
- "individual_hook" muss SPEZIFISCH sein (nicht generisch)
- "reasoning" muss KONKRET auf deren Anwendungen eingehen
- "surface_processing_indicators" sind Schlüsselwörter von der Website
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Du bist ein präziser B2B-Analyst für Schleifmittel. Antworte nur mit validem JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1000
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
        services: [],
        surface_processing_indicators: [],
        target_materials: []
      },
      needs_assessment: {
        potential_products: ['Schleifbänder', 'Fächerscheiben'],
        estimated_volume: 'medium',
        reasoning: 'Analyse konnte nicht vollständig durchgeführt werden. Branche deutet auf Schleifmittel-Bedarf hin.',
        score: 50,
        individual_hook: `Unternehmen aus dem Bereich ${industry}`
      }
    }
  }
}
