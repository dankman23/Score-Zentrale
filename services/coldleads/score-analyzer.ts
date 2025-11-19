/**
 * SCORE Firmen-Analyzer
 * Optimiert für B2B Schleifwerkzeuge-Vertrieb
 * 
 * Extrahiert:
 * 1. Branche
 * 2. Werkstoffe (Stahl, Edelstahl, Aluminium, etc.)
 * 3. Werkstücke (Schienen, Karosserien, etc.)
 * 4. Anwendungen
 * 5. Kontaktpersonen mit E-Mail
 * 6. Potenzielle SCORE-Produkte
 */

import { chatCompletion } from '@/lib/openai-client'

// SCORE Produktkategorien
const SCORE_PRODUCTS = [
  'Schleifbänder',
  'Schleifscheiben',
  'Trennscheiben',
  'Fiberscheiben',
  'Fächerscheiben',
  'Schleifvliese',
  'Schleifpapier',
  'Polierscheiben',
  'Schleifmittel auf Unterlage',
  'Schleifwerkzeuge gebunden'
]

// Typische Werkstoffe in der Metallverarbeitung
const WERKSTOFFE = [
  'Stahl', 'Edelstahl', 'V2A', 'V4A',
  'Aluminium', 'Alu',
  'Holz', 'Hartholz', 'Weichholz',
  'Kunststoff', 'Plastik',
  'Glas',
  'Stein', 'Naturstein', 'Marmor', 'Granit',
  'Beton',
  'Keramik',
  'Kupfer', 'Messing', 'Bronze',
  'Titan',
  'Stahl legiert', 'Stahl unlegiert',
  'Gusseisen', 'Grauguss'
]

export interface ScoreAnalyzerResult {
  // Basisdaten
  firmenname: string
  website: string
  branche: string
  
  // Technische Daten
  werkstoffe: Array<{ name: string; kontext: string }>
  werkstücke: Array<{ name: string; beschreibung: string }>
  anwendungen: string[]
  
  // Kontakte
  kontaktpersonen: Array<{
    name: string
    position: string
    bereich: string  // Geschäftsführung, Einkauf, Produktion, etc.
    email: string
    telefon?: string
    confidence: number
  }>
  
  // Produktempfehlungen
  potenzielle_produkte: Array<{
    kategorie: string  // Schleifbänder, Schleifscheiben, etc.
    für_werkstoff: string
    für_anwendung: string
    begründung: string
  }>
  
  // Zusammenfassung
  firmenprofil: string  // Kurze Zusammenfassung was die Firma macht
  
  // Qualität
  analyse_qualität: number  // 0-100
}

/**
 * Hauptfunktion: Analysiert eine Firma komplett
 */
export async function analyzeFirmaForScore(
  websiteUrl: string,
  firmenname?: string,
  branche?: string
): Promise<ScoreAnalyzerResult> {
  
  console.log(`[SCORE Analyzer] Analysiere: ${websiteUrl}`)
  
  // Schritt 1: Website-Content laden
  const content = await crawlWebsite(websiteUrl)
  
  if (!content || content.length < 100) {
    throw new Error('Website-Content zu kurz oder nicht erreichbar')
  }
  
  // Schritt 2: LLM-Analyse mit strukturiertem Prompt
  const analysisResult = await analyzeWithLLM(content, firmenname, branche, websiteUrl)
  
  return analysisResult
}

/**
 * Crawlt Website und extrahiert relevanten Text
 */
async function crawlWebsite(url: string): Promise<string> {
  try {
    console.log(`[SCORE Analyzer] Fetching: ${url}`)
    
    // Haupt-Seite laden
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000)
    })
    
    console.log(`[SCORE Analyzer] Response status: ${response.status}`)
    
    if (!response.ok) {
      console.error(`[SCORE Analyzer] HTTP ${response.status} für ${url}`)
      return ''
    }
    
    const html = await response.text()
    console.log(`[SCORE Analyzer] HTML length: ${html.length}`)
    
    // Extrahiere Text (einfache Variante - entfernt HTML-Tags)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    console.log(`[SCORE Analyzer] Extracted text length: ${text.length}`)
    
    // Limitiere auf erste 15.000 Zeichen für LLM
    const result = text.substring(0, 15000)
    console.log(`[SCORE Analyzer] Final content length: ${result.length}`)
    
    return result
    
  } catch (error: any) {
    console.error(`[SCORE Analyzer] Fehler beim Crawlen von ${url}:`, error.message)
    return ''
  }
}

/**
 * LLM-Analyse mit strukturiertem Prompt
 */
async function analyzeWithLLM(
  websiteContent: string,
  firmenname?: string,
  branche?: string,
  websiteUrl?: string
): Promise<ScoreAnalyzerResult> {
  
  const prompt = `Du bist ein B2B-Analyst für Schleifwerkzeuge. Analysiere diese Firmenwebsite und extrahiere strukturierte Informationen.

WEBSITE-CONTENT:
${websiteContent}

${firmenname ? `FIRMENNAME: ${firmenname}` : ''}
${branche ? `BRANCHE (Hinweis): ${branche}` : ''}
${websiteUrl ? `URL: ${websiteUrl}` : ''}

AUFGABE:
Analysiere die Firma und extrahiere folgende Informationen im JSON-Format:

{
  "firmenname": "Vollständiger Firmenname",
  "branche": "Hauptbranche (z.B. Metallbau, Maschinenbau, Schreinerei, etc.)",
  "werkstoffe": [
    {
      "name": "Werkstoff (z.B. Stahl, Edelstahl, Aluminium, Holz, etc.)",
      "kontext": "Wo/wie wird dieser Werkstoff verwendet?"
    }
  ],
  "werkstücke": [
    {
      "name": "Was wird produziert? (z.B. Schienen, Karosserieteile, Möbel, etc.)",
      "beschreibung": "Kurze Beschreibung"
    }
  ],
  "anwendungen": [
    "Liste der Hauptanwendungen/Tätigkeiten (z.B. Schweißen, Schleifen, Polieren, Entgraten, Oberflächenbearbeitung, etc.)"
  ],
  "kontaktpersonen": [
    {
      "name": "Vollständiger Name",
      "position": "Position (z.B. Geschäftsführer, Einkaufsleiter, etc.)",
      "bereich": "Geschäftsführung|Einkauf|Produktion|Vertrieb",
      "email": "E-Mail-Adresse",
      "telefon": "Telefonnummer (optional)",
      "confidence": 90
    }
  ],
  "potenzielle_produkte": [
    {
      "kategorie": "Schleifbänder|Schleifscheiben|Trennscheiben|Fiberscheiben|Fächerscheiben|Schleifvliese|Schleifpapier",
      "für_werkstoff": "Für welchen Werkstoff?",
      "für_anwendung": "Für welche Anwendung?",
      "begründung": "Warum brauchen sie dieses Produkt?"
    }
  ],
  "firmenprofil": "Kurze Zusammenfassung (2-3 Sätze): Was macht die Firma? Welche Produkte/Dienstleistungen?"
}

WICHTIGE HINWEISE:
- Werkstoffe: Achte auf: Stahl, Edelstahl, Aluminium, Holz, Kunststoff, Glas, Stein, etc.
- Werkstücke: Was wird konkret produziert oder bearbeitet?
- Kontaktpersonen: Suche nach Geschäftsführern, Einkaufsleitern, Produktionsleitern
- E-Mail-Adressen: Format prüfen (muss @ enthalten)
- Confidence: 100 = sehr sicher, 50 = mittel, 0 = unsicher
- Potenzielle Produkte: Nur SCORE-Kategorien verwenden (siehe oben)
- Wenn eine Info nicht gefunden wird, lasse das Feld leer oder verwende leere Arrays

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`

  try {
    const llmResponse = await chatCompletion({
      messages: [
        { role: 'system', content: 'Du bist ein präziser B2B-Datenanalyst. Du antwortest immer im exakten JSON-Format.' },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 2000
    })
    
    const responseText = llmResponse.choices[0].message.content.trim()
    
    // Extrahiere JSON (falls in ```json``` wrapped)
    let jsonText = responseText
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim()
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim()
    }
    
    const result = JSON.parse(jsonText)
    
    // Validierung & Defaults
    return {
      firmenname: result.firmenname || firmenname || 'Unbekannt',
      website: websiteUrl || '',
      branche: result.branche || branche || 'Unbekannt',
      werkstoffe: result.werkstoffe || [],
      werkstücke: result.werkstücke || [],
      anwendungen: result.anwendungen || [],
      kontaktpersonen: result.kontaktpersonen || [],
      potenzielle_produkte: result.potenzielle_produkte || [],
      firmenprofil: result.firmenprofil || '',
      analyse_qualität: calculateQuality(result)
    }
    
  } catch (error) {
    console.error('[SCORE Analyzer] LLM-Analyse Fehler:', error)
    
    // Fallback: Leeres Ergebnis mit Basisdaten
    return {
      firmenname: firmenname || 'Unbekannt',
      website: websiteUrl || '',
      branche: branche || 'Unbekannt',
      werkstoffe: [],
      werkstücke: [],
      anwendungen: [],
      kontaktpersonen: [],
      potenzielle_produkte: [],
      firmenprofil: 'Analyse fehlgeschlagen - Website nicht erreichbar oder Content nicht ausreichend',
      analyse_qualität: 0
    }
  }
}

/**
 * Berechnet Analyse-Qualität basierend auf Vollständigkeit
 */
function calculateQuality(result: any): number {
  let score = 0
  
  // Basisdaten (20 Punkte)
  if (result.firmenname && result.firmenname !== 'Unbekannt') score += 10
  if (result.branche && result.branche !== 'Unbekannt') score += 10
  
  // Technische Daten (30 Punkte)
  if (result.werkstoffe && result.werkstoffe.length > 0) score += 10
  if (result.werkstücke && result.werkstücke.length > 0) score += 10
  if (result.anwendungen && result.anwendungen.length > 0) score += 10
  
  // Kontakte (30 Punkte)
  if (result.kontaktpersonen && result.kontaktpersonen.length > 0) {
    score += 15
    // Bonus wenn E-Mail vorhanden
    const hasEmail = result.kontaktpersonen.some(k => k.email && k.email.includes('@'))
    if (hasEmail) score += 15
  }
  
  // Produktempfehlungen (20 Punkte)
  if (result.potenzielle_produkte && result.potenzielle_produkte.length > 0) score += 10
  if (result.firmenprofil && result.firmenprofil.length > 20) score += 10
  
  return Math.min(100, score)
}
