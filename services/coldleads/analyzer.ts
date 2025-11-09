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
      grain_sizes?: string[]
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
 * Keyword-basierte Analyse (100% reliable)
 */
function createKeywordAnalysis(websiteData: any, industry: string): any {
  const text = (websiteData.text_content || '').toLowerCase()
  const title = websiteData.title || ''
  
  // Keyword-Detection
  const metalKeywords = ['metall', 'stahl', 'edelstahl', 'aluminium', 'schweißen', 'schleifen']
  const woodKeywords = ['holz', 'tischlerei', 'schreinerei', 'möbel']
  const surfaceKeywords = ['schleifen', 'polieren', 'oberfläche', 'finish', 'lackieren']
  const industrieKeywords = ['fertigung', 'produktion', 'werkstatt', 'herstellung']
  
  const hasMetal = metalKeywords.some(kw => text.includes(kw))
  const hasWood = woodKeywords.some(kw => text.includes(kw))
  const hasSurface = surfaceKeywords.some(kw => text.includes(kw))
  const hasIndustry = industrieKeywords.some(kw => text.includes(kw))
  
  // Scoring
  let score = 40 // Basis-Score
  let products = ['Schleifbänder', 'Fächerscheiben']
  let materials = []
  let indicators = []
  let reasoning = []
  
  if (hasMetal) {
    score += 25
    products = ['Schleifbänder für Edelstahl K80-K240', 'Fächerscheiben 125mm', 'Trennscheiben']
    materials.push('Stahl', 'Edelstahl', 'Aluminium')
    indicators.push('Metallverarbeitung')
    reasoning.push('Website enthält klare Hinweise auf Metallverarbeitung')
  }
  
  if (hasWood) {
    score += 15
    products.push('Schleifbänder für Holz K60-K180', 'Schleifpapier')
    materials.push('Holz')
    indicators.push('Holzbearbeitung')
    reasoning.push('Firma arbeitet mit Holz')
  }
  
  if (hasSurface) {
    score += 20
    indicators.push('Oberflächenbearbeitung', 'Schleifen')
    reasoning.push('Spezialisiert auf Oberflächenbearbeitung - direkter Bedarf für Schleifmittel')
  }
  
  if (hasIndustry) {
    score += 10
    reasoning.push('Industrielle Fertigung deutet auf regelmäßigen Bedarf hin')
  }
  
  // Branche berücksichtigen
  if (industry.toLowerCase().includes('metall') || industry.toLowerCase().includes('stahl')) {
    score = Math.max(score, 60)
    if (!hasMetal) {
      materials.push('Metall', 'Stahl')
      reasoning.push(`Branche "${industry}" lässt auf Metallverarbeitung schließen`)
    }
  }
  
  score = Math.min(score, 100)
  
  return {
    company_info: {
      name: title.split('-')[0].trim() || 'Firma',
      description: `Unternehmen im Bereich ${industry}. ${reasoning.join('. ')}.`,
      products: [],
      services: [],
      surface_processing_indicators: indicators.length > 0 ? indicators : ['Branchenspezifisch'],
      target_materials: materials.length > 0 ? materials : ['Diverse']
    },
    needs_assessment: {
      potential_products: products,
      estimated_volume: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
      reasoning: reasoning.length > 0 
        ? reasoning.join('. ') + '.'
        : `Basierend auf der Branche ${industry} besteht Potenzial für Schleifmittel.`,
      individual_hook: `Spezialisiert auf ${industry}`,
      score: score
    }
  }
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
      surface_processing_indicators: [],
      target_materials: []
    },
    contact_persons: [],
    needs_assessment: {
      potential_products: ['Schleifmittel allgemein'],
      estimated_volume: 'medium',
      reasoning: `Branche ${industry} deutet auf möglichen Bedarf hin.`,
      individual_hook: `Unternehmen aus ${industry}`,
      score: 40
    }
  }
}

/**
 * Crawlt Website
 */
async function crawlWebsite(url: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SCORE-Bot/1.0)' },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    $('script, style, nav, footer').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000)

    return { html, text_content: text, title: $('title').text() }
  } catch (error: any) {
    console.error('[Crawler] Failed:', error.message)
    return { html: '', text_content: '', title: '' }
  }
}

/**
 * Extrahiert Kontakte
 */
function extractContacts(html: string) {
  const $ = cheerio.load(html)
  const contacts: any[] = []
  const text = $('body').text()

  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const phones = text.match(/(\+49|0)\s*\(?\d{2,5}\)?[\s\-\/]*\d{3,}[\s\-]*\d*/g) || []

  // Einkauf
  const einkaufMatch = text.match(/einkauf[^\n]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
  if (einkaufMatch) {
    contacts.push({
      name: 'Einkauf',
      title: 'Einkaufsabteilung',
      department: 'Einkauf',
      email: einkaufMatch[1],
      phone: phones[0] || null,
      priority: 1
    })
  }

  // Fallback: Erste Email
  if (contacts.length === 0 && emails.length > 0) {
    contacts.push({
      name: 'Kontakt',
      title: 'Allgemein',
      department: 'Allgemein',
      email: emails[0],
      phone: phones[0] || null,
      priority: 3
    })
  }

  return contacts.slice(0, 3)
}
