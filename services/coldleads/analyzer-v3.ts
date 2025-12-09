/**
 * Kaltakquise Analyzer V3
 * Vollständig optimiert nach ChatGPT-Prompt-Specs
 * - Multi-Page Website Crawling
 * - Glossar-Mapping (311 Begriffe)
 * - Strukturiertes JSON Output
 * - Contact Extraction mit Confidence
 * - Brand Matching
 */

import { mapToGlossary } from '@/lib/glossary'
import { selectBrandsForProspect } from '@/lib/score-coldleads-config'
import { emergentChatCompletion } from '@/lib/emergent-llm'

export interface AnalyzerV3Result {
  company: string
  url: string
  branch_guess: string[]
  applications: Array<{ term: string; evidence: string }>
  materials: Array<{ term: string; evidence: string }>
  machines: Array<{ term: string; evidence: string }>
  product_categories: Array<{ term: string; evidence: string }>
  contact_person: {
    name: string
    role: string
    email: string
    phone?: string
    confidence: number
  }
  confidence_overall: number
  notes: string
  recommended_brands: string[]
}

/**
 * Analysiert eine Firmen-Website komplett
 */
export async function analyzeCompanyV3(
  websiteUrl: string,
  companyName?: string,
  industry?: string,
  region?: string
): Promise<AnalyzerV3Result> {
  
  console.log(`[AnalyzerV3] Starting analysis for: ${websiteUrl}`)
  
  // Step 1: Multi-Page Website Crawling
  const websiteContent = await crawlWebsiteMultiPage(websiteUrl)
  
  // Step 2: LLM-basierte Strukturierte Extraktion
  const llmAnalysis = await analyzWithLLM(websiteContent, companyName, industry)
  
  // Step 3: Glossar-Mapping (311 Begriffe)
  const glossarMapping = performGlossarMapping(websiteContent.combined_text)
  
  // Step 4: Contact Person Extraction
  const contactPerson = extractBestContact(websiteContent, llmAnalysis)
  
  // Step 5: Branch Guess
  const branchGuess = determineBranch(llmAnalysis, glossarMapping, industry)
  
  // Step 6: Evidence-based Term Mapping
  const termMappings = createEvidenceBasedMappings(
    glossarMapping,
    websiteContent,
    llmAnalysis
  )
  
  // Step 7: Brand Selection
  const recommendedBrands = selectBrandsForProspect(
    termMappings.materials.map(m => m.term),
    termMappings.applications.map(a => a.term)
  )
  
  // Step 8: Confidence Score
  const confidenceOverall = calculateOverallConfidence(
    termMappings,
    contactPerson,
    llmAnalysis
  )
  
  // Step 9: Notes Generation
  const notes = generateAnalysisNotes(llmAnalysis, glossarMapping, confidenceOverall)
  
  return {
    company: companyName || llmAnalysis.company_name || extractDomainName(websiteUrl),
    url: websiteUrl,
    branch_guess: branchGuess,
    applications: termMappings.applications,
    materials: termMappings.materials,
    machines: termMappings.machines,
    product_categories: termMappings.product_categories,
    contact_person: contactPerson,
    confidence_overall: confidenceOverall,
    notes,
    recommended_brands: recommendedBrands
  }
}

/**
 * Crawlt mehrere Seiten der Website
 */
async function crawlWebsiteMultiPage(baseUrl: string): Promise<{
  home: string
  leistungen: string
  produkte: string
  referenzen: string
  team: string
  kontakt: string
  impressum: string
  combined_text: string
}> {
  const pages = {
    home: '',
    leistungen: '',
    produkte: '',
    referenzen: '',
    team: '',
    kontakt: '',
    impressum: ''
  }
  
  // Haupt-Seite crawlen
  try {
    const homeRes = await fetch(`https://r.jina.ai/${baseUrl}`, {
      headers: { 'Accept': 'text/plain' }
    })
    if (homeRes.ok) {
      pages.home = await homeRes.text()
    }
  } catch (e) {
    console.error('Error crawling home:', e)
  }
  
  // Versuche Standard-Unterseiten
  const subpages = [
    { key: 'leistungen', paths: ['/leistungen', '/services', '/angebot'] },
    { key: 'produkte', paths: ['/produkte', '/products', '/sortiment'] },
    { key: 'referenzen', paths: ['/referenzen', '/references', '/projekte', '/kunden'] },
    { key: 'team', paths: ['/team', '/ueber-uns', '/about', '/unternehmen'] },
    { key: 'kontakt', paths: ['/kontakt', '/contact'] },
    { key: 'impressum', paths: ['/impressum', '/imprint'] }
  ]
  
  for (const subpage of subpages) {
    for (const path of subpage.paths) {
      try {
        const url = `${baseUrl}${path}`
        const res = await fetch(`https://r.jina.ai/${url}`, {
          headers: { 'Accept': 'text/plain' }
        })
        if (res.ok) {
          pages[subpage.key as keyof typeof pages] = await res.text()
          break // Erste erfolgreiche Variante nehmen
        }
      } catch (e) {
        // Nächste Variante probieren
      }
    }
    
    // Kleine Pause zwischen Requests
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  const combined_text = Object.values(pages).join('\n\n')
  
  return { ...pages, combined_text }
}

/**
 * LLM-basierte Analyse
 */
async function analyzWithLLM(
  content: any,
  companyName?: string,
  industry?: string
): Promise<any> {
  
  const prompt = `Du bist ein B2B-Analyst für die Schleifwerkzeug-Industrie.

Analysiere diese Firmen-Website und extrahiere:

**Website-Content:**
${content.combined_text.substring(0, 8000)}

**Aufgabe:**
1. Firmenname (falls nicht "${companyName || 'unbekannt'}")
2. Kerngeschäft & Haupttätigkeiten (2-3 Sätze)
3. Fertigungsschritte / Bearbeitungen (z.B. Schweißen, Schleifen, Polieren, Trennen)
4. Verarbeitete Materialien (z.B. Edelstahl, Aluminium, Holz, Kunststoff)
5. Verwendete Maschinen (z.B. Winkelschleifer, Bandschleifer, CNC)
6. Schlüsselwörter für Glossar-Matching (max. 12 Begriffe)
7. Branche (1-2 Kategorien: Metallverarbeitung, Holzverarbeitung, Automotive, etc.)

**Antwort als JSON:**
{
  "company_name": "...",
  "core_business": "...",
  "processing_steps": ["...", "..."],
  "materials": ["...", "..."],
  "machines": ["...", "..."],
  "keywords": ["...", "..."],
  "branch_guess": ["...", "..."]
}

Nur JSON, keine Erklärungen.`

  try {
    const response = await emergentChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 1000
    })
    
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    throw new Error('Kein gültiges JSON in LLM-Response')
  } catch (e) {
    console.error('LLM Analysis Error:', e)
    return {
      company_name: companyName || '',
      core_business: 'Nicht extrahiert',
      processing_steps: [],
      materials: [],
      machines: [],
      keywords: [],
      branch_guess: [industry || 'Unbekannt']
    }
  }
}

/**
 * Glossar-Mapping durchführen
 */
function performGlossarMapping(text: string) {
  return mapToGlossary(text)
}

/**
 * Besten Ansprechpartner extrahieren
 */
function extractBestContact(content: any, llmAnalysis: any): {
  name: string
  role: string
  email: string
  phone?: string
  confidence: number
} {
  // Suche nach Email-Adressen in Kontakt/Impressum/Team
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const phoneRegex = /(\+49|0)[0-9\s\-\/]{8,20}/g
  
  const searchText = [content.kontakt, content.impressum, content.team].join('\n')
  
  const emails = searchText.match(emailRegex) || []
  const phones = searchText.match(phoneRegex) || []
  
  // Filtere generische Emails
  const priorityEmails = emails.filter((email: string) => 
    !email.includes('info@') && 
    !email.includes('mail@') && 
    !email.includes('kontakt@') &&
    !email.includes('office@')
  )
  
  const bestEmail = priorityEmails[0] || emails[0] || ''
  
  // Versuche Namen zu extrahieren (sehr einfache Heuristik)
  let name = ''
  let role = ''
  let confidence = 0.3
  
  if (bestEmail) {
    const namePart = bestEmail.split('@')[0]
    const parts = namePart.split('.')
    if (parts.length === 2) {
      name = `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)} ${parts[1].charAt(0).toUpperCase()}${parts[1].slice(1)}`
      confidence = 0.6
    }
    
    // Suche nach Rolle in Team/Kontakt
    if (searchText.toLowerCase().includes('geschäftsführ')) {
      role = 'Geschäftsführung'
      confidence = 0.8
    } else if (searchText.toLowerCase().includes('vertrieb')) {
      role = 'Vertrieb'
      confidence = 0.7
    } else if (searchText.toLowerCase().includes('einkauf')) {
      role = 'Einkauf'
      confidence = 0.7
    } else {
      role = 'Ansprechpartner'
    }
  }
  
  return {
    name: name || 'Nicht gefunden',
    role: role || 'Ansprechpartner',
    email: bestEmail,
    phone: phones[0] || undefined,
    confidence
  }
}

/**
 * Branche bestimmen
 */
function determineBranch(
  llmAnalysis: any,
  glossarMapping: any,
  providedIndustry?: string
): string[] {
  const branches: string[] = []
  
  if (llmAnalysis.branch_guess) {
    branches.push(...llmAnalysis.branch_guess)
  }
  
  if (providedIndustry) {
    branches.push(providedIndustry)
  }
  
  // Fallback
  if (branches.length === 0) {
    branches.push('Allgemeine Fertigung')
  }
  
  return Array.from(new Set(branches)).slice(0, 2)
}

/**
 * Evidence-basierte Term-Mappings erstellen
 */
function createEvidenceBasedMappings(
  glossarMapping: any,
  websiteContent: any,
  llmAnalysis: any
) {
  const combined = websiteContent.combined_text.toLowerCase()
  
  // Applications
  const applications = glossarMapping.applications.slice(0, 7).map((term: string) => ({
    term,
    evidence: findEvidence(combined, term)
  }))
  
  // Materials
  const materials = glossarMapping.materials.slice(0, 6).map((term: string) => ({
    term,
    evidence: findEvidence(combined, term)
  }))
  
  // Machines
  const machines = glossarMapping.machines.slice(0, 5).map((term: string) => ({
    term,
    evidence: findEvidence(combined, term)
  }))
  
  // Product Categories
  const product_categories = glossarMapping.categories.slice(0, 6).map((term: string) => ({
    term,
    evidence: findEvidence(combined, term)
  }))
  
  return { applications, materials, machines, product_categories }
}

/**
 * Findet Evidence für einen Term
 */
function findEvidence(text: string, term: string): string {
  const lowerTerm = term.toLowerCase()
  const index = text.indexOf(lowerTerm)
  
  if (index === -1) {
    return `Bezug zu "${term}" identifiziert`
  }
  
  // Extrahiere Kontext (30 Zeichen vor und nach)
  const start = Math.max(0, index - 30)
  const end = Math.min(text.length, index + term.length + 30)
  let snippet = text.substring(start, end)
  
  // Bereinige
  snippet = snippet.replace(/\s+/g, ' ').trim()
  
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  
  return snippet.substring(0, 100)
}

/**
 * Overall Confidence berechnen
 */
function calculateOverallConfidence(
  termMappings: any,
  contactPerson: any,
  llmAnalysis: any
): number {
  let score = 0
  
  // Term Mappings (max 40 Punkte)
  score += Math.min(termMappings.applications.length * 3, 15)
  score += Math.min(termMappings.materials.length * 3, 12)
  score += Math.min(termMappings.machines.length * 3, 13)
  
  // Contact Person (max 30 Punkte)
  score += contactPerson.confidence * 30
  
  // LLM Analysis Quality (max 30 Punkte)
  if (llmAnalysis.core_business && llmAnalysis.core_business !== 'Nicht extrahiert') {
    score += 15
  }
  if (llmAnalysis.processing_steps && llmAnalysis.processing_steps.length > 0) {
    score += 15
  }
  
  return Math.min(Math.round(score), 100)
}

/**
 * Generiert Analysis Notes
 */
function generateAnalysisNotes(
  llmAnalysis: any,
  glossarMapping: any,
  confidence: number
): string {
  const notes = []
  
  notes.push(`Analyse-Konfidenz: ${confidence}%`)
  
  if (glossarMapping.applications.length > 0) {
    notes.push(`${glossarMapping.applications.length} Anwendungen erkannt`)
  }
  
  if (glossarMapping.materials.length > 0) {
    notes.push(`${glossarMapping.materials.length} Werkstoffe identifiziert`)
  }
  
  if (llmAnalysis.core_business) {
    notes.push(`Kerngeschäft: ${llmAnalysis.core_business.substring(0, 80)}`)
  }
  
  return notes.join('. ') + '.'
}

/**
 * Extrahiert Domain-Namen
 */
function extractDomainName(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    return url
  }
}
