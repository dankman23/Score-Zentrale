/**
 * Kaltakquise - Phase 2: Analyzer (Stabilisiert)
 * Crawlt Website und analysiert mit OpenAI
 */

import * as cheerio from 'cheerio'
import { emergentGetJSON } from '../../lib/emergent-llm'

interface AnalysisResult {
  company_info: {
    name: string
    description: string
    products: string[]
    services: string[]
    surface_processing_indicators: string[]
    target_materials: string[]
    employees_estimate?: string
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
    potential_products: string[]
    estimated_volume: 'low' | 'medium' | 'high'
    reasoning: string
    individual_hook: string
    score: number // 0-100
  }
  website_quality: {
    has_impressum: boolean
    has_contact_page: boolean
    professional: boolean
  }
}

/**
 * Crawlt und analysiert eine Firmen-Website (mit Error-Handling)
 */
export async function analyzeCompany(websiteUrl: string, industry: string): Promise<AnalysisResult> {
  console.log(`[Analyzer] Analyzing: ${websiteUrl}`)

  try {
    // 1. Website crawlen (mit Timeout)
    const websiteData = await Promise.race([
      crawlWebsite(websiteUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Crawl Timeout')), 30000))
    ]) as any

    // 2. Kontakte extrahieren
    const contacts = extractContacts(websiteData.html)

    // 3. OpenAI-Analyse (mit Fallback)
    let aiAnalysis
    try {
      aiAnalysis = await analyzeWithAI(websiteData, industry)
    } catch (error) {
      console.error('[Analyzer] AI Analysis failed, using fallback:', error)
      aiAnalysis = createFallbackAnalysis(websiteData, industry)
    }

    return {
      company_info: aiAnalysis.company_info,
      contact_persons: contacts,
      needs_assessment: aiAnalysis.needs_assessment,
      website_quality: {
        has_impressum: websiteData.html.toLowerCase().includes('impressum'),
        has_contact_page: websiteData.html.toLowerCase().includes('kontakt'),
        professional: true
      }
    }
  } catch (error: any) {
    console.error('[Analyzer] Analysis failed:', error)
    // Return minimal viable analysis
    return {
      company_info: {
        name: 'Unbekannt',
        description: 'Website konnte nicht analysiert werden.',
        products: [],
        services: [],
        surface_processing_indicators: [],
        target_materials: []
      },
      contact_persons: [],
      needs_assessment: {
        potential_products: ['Schleifmittel allgemein'],
        estimated_volume: 'medium',
        reasoning: `Analyse konnte nicht vollständig durchgeführt werden: ${error.message}`,
        individual_hook: `Unternehmen aus dem Bereich ${industry}`,
        score: 30
      },
      website_quality: {
        has_impressum: false,
        has_contact_page: false,
        professional: false
      }
    }
  }
}

/**
 * Crawlt Website
 */
async function crawlWebsite(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SCORE-Bot/1.0)'
      },
      signal: AbortSignal.timeout(20000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Text extrahieren
    $('script, style, nav, footer').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000)

    return { html, text_content: text, title: $('title').text() }
  } catch (error: any) {
    console.error('[Crawler] Failed:', error.message)
    throw new Error(`Website nicht erreichbar: ${error.message}`)
  }
}

/**
 * Fallback-Analyse wenn OpenAI fehlschlägt
 */
function createFallbackAnalysis(websiteData: any, industry: string): any {
  const text = websiteData.text_content.toLowerCase()
  
  // Einfache Keyword-Detection
  const metalKeywords = ['metall', 'stahl', 'edelstahl', 'aluminium', 'schweißen']
  const woodKeywords = ['holz', 'tischlerei', 'schreinerei', 'möbel']
  const surfaceKeywords = ['schleifen', 'polieren', 'oberflä che', 'finish']
  
  const hasMetalIndicators = metalKeywords.some(kw => text.includes(kw))
  const hasWoodIndicators = woodKeywords.some(kw => text.includes(kw))
  const hasSurfaceIndicators = surfaceKeywords.some(kw => text.includes(kw))
  
  let score = 40
  let products = ['Schleifbänder', 'Fächerscheiben']
  let materials = []
  
  if (hasMetalIndicators) {
    score += 20
    materials.push('Stahl', 'Edelstahl')
    products = ['Schleifbänder für Edelstahl', 'Fächerscheiben', 'Trennscheiben']
  }
  if (hasWoodIndicators) {
    score += 15
    materials.push('Holz')
    products.push('Schleifbänder für Holz')
  }
  if (hasSurfaceIndicators) {
    score += 15
  }
  
  return {
    company_info: {
      name: websiteData.title || 'Unbekannt',
      description: `Unternehmen im Bereich ${industry}. Basiert auf automatischer Keyword-Analyse.`,
      products: [],
      services: [],
      surface_processing_indicators: hasSurfaceIndicators ? ['Oberflächenbearbeitung'] : [],
      target_materials: materials
    },
    needs_assessment: {
      potential_products: products,
      estimated_volume: 'medium',
      reasoning: `Basierend auf Branchen-Zuordnung (${industry}) und Website-Keywords besteht Potenzial für Schleifmittel.`,
      individual_hook: `Unternehmen im Bereich ${industry}`,
      score: Math.min(score, 100)
    }
  }
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
      
      if (name && role) {
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
 * Analysiert mit Emergent LLM (GPT-4)
 */
async function analyzeWithAI(websiteData: any, industry: string, retries = 2): Promise<any> {
  const systemPrompt = 'Du bist ein präziser B2B-Analyst für Schleifmittel. Antworte nur mit validem JSON.'
  
  const userPrompt = `
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
Analysiere ob und warum diese Firma Schleifmittel benötigt. Identifiziere spezifische Anwendungen.

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
    "reasoning": "DETAILLIERT: Welche konkreten Schleif-Anwendungen hat die Firma? Warum brauchen sie unsere Produkte?",
    "score": 0-100,
    "individual_hook": "Spezifischer Aufhänger für Email (z.B. 'spezialisiert auf Edelstahl-Schweißkonstruktionen')"
  }
}

**SCORING (0-100):**
- 85-100: TOP-Lead - Kernzielgruppe mit hohem Volumen
- 70-84: Sehr guter Lead - Klare Schleifmittel-Anwendung
- 55-69: Guter Lead - Potenzial vorhanden
- 40-54: Mittleres Potenzial
- 0-39: Geringes Potenzial
`

  try {
    const result = await emergentGetJSON(systemPrompt, userPrompt, retries)
    return result
  } catch (error: any) {
    console.error('[Analyzer] Emergent LLM failed:', error)
    throw error
  }
}
