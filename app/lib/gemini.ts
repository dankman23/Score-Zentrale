import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize the Google Generative AI with Emergent LLM key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

// Get the Gemini 2.0 Flash model
export function getGeminiModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
}

export interface ExtractedInvoiceData {
  rechnungsnummer?: string
  datum?: string
  lieferant?: string
  lieferantenNummer?: string
  gesamtbetrag?: number
  nettobetrag?: number
  mehrwertsteuer?: number
  mwstSatz?: number
  zahlungsbedingungen?: string
  positionen?: Array<{
    beschreibung: string
    menge: number
    einzelpreis: number
    gesamtpreis: number
  }>
  rawText?: string
  error?: string
}

/**
 * Extrahiert Rechnungsdaten aus PDF-Inhalt mit Gemini 2.0 Flash
 * Optional: Mit E-Mail-Text für zusätzlichen Kontext
 */
export async function extractInvoiceData(
  pdfContent: Buffer,
  extractionPrompt?: string,
  emailContext?: {
    from?: string
    subject?: string
    body?: string
  }
): Promise<ExtractedInvoiceData> {
  try {
    const model = getGeminiModel()
    
    // Zusätzlicher Kontext aus E-Mail
    let contextText = ''
    if (emailContext) {
      contextText = '\n\nZUSÄTZLICHER KONTEXT AUS E-MAIL:\n'
      if (emailContext.from) contextText += `Absender: ${emailContext.from}\n`
      if (emailContext.subject) contextText += `Betreff: ${emailContext.subject}\n`
      if (emailContext.body) contextText += `E-Mail-Text: ${emailContext.body.substring(0, 500)}\n`
    }
    
    // Spezifischer Prompt für deutsche Lieferantenrechnungen
    const prompt = extractionPrompt || 
      `Extrahiere die folgenden Informationen aus dieser deutschen Lieferantenrechnung (EK-Rechnung):
      - Rechnungsnummer
      - Rechnungsdatum (Format: YYYY-MM-DD)
      - Lieferantenname (Firma)
      - Lieferantennummer (falls vorhanden)
      - Gesamtbetrag (Brutto)
      - Nettobetrag
      - Mehrwertsteuerbetrag
      - MwSt-Satz (z.B. 19, 7)
      - Zahlungsbedingungen (z.B. "14 Tage netto")
      - Artikelpositionen (mit Beschreibung, Menge, Einzelpreis, Gesamtpreis)
      
      ${contextText}
      
      WICHTIG: Nutze auch die Informationen aus dem E-Mail-Kontext oben, falls das PDF nicht alle Daten enthält.
      Der Lieferantenname kann z.B. aus dem E-Mail-Absender stammen.
      
      Formatiere die Antwort als JSON-Objekt mit folgenden Feldern:
      {
        "rechnungsnummer": "string",
        "datum": "YYYY-MM-DD",
        "lieferant": "string",
        "lieferantenNummer": "string",
        "gesamtbetrag": number,
        "nettobetrag": number,
        "mehrwertsteuer": number,
        "mwstSatz": number,
        "zahlungsbedingungen": "string",
        "positionen": [
          {
            "beschreibung": "string",
            "menge": number,
            "einzelpreis": number,
            "gesamtpreis": number
          }
        ]
      }
      
      Gib nur das JSON zurück, keine zusätzlichen Erklärungen.`
    
    // Create content with PDF
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfContent.toString('base64')
              }
            }
          ]
        }
      ]
    })

    const response = await result.response
    const text = response.text()
    
    // Try to parse JSON from response
    try {
      // Remove markdown code blocks if present
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      // Find JSON in the response
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed as ExtractedInvoiceData
      }
      
      return { 
        rawText: text, 
        error: 'Could not parse JSON from response' 
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      return { 
        rawText: text, 
        error: 'JSON parsing error: ' + (parseError as Error).message 
      }
    }
  } catch (error) {
    console.error('Error extracting invoice data:', error)
    throw new Error(`Failed to extract invoice data: ${(error as Error).message}`)
  }
}

/**
 * Parse invoice with Gemini - simplified version for EK-Rechnung processing
 */
export async function parseInvoiceWithGemini(pdfText: string, kreditorNameHint?: string) {
  try {
    const model = getGeminiModel()
    
    const prompt = `Extrahiere die folgenden Informationen aus dieser deutschen Lieferantenrechnung:
    
${pdfText}

${kreditorNameHint ? `HINWEIS: Der Lieferant ist wahrscheinlich: ${kreditorNameHint}` : ''}

Formatiere die Antwort als JSON mit folgenden Feldern:
{
  "lieferantName": "string",
  "rechnungsNummer": "string",
  "rechnungsDatum": "YYYY-MM-DD",
  "betrag": number,
  "nettoBetrag": number,
  "steuersatz": number
}

Gib nur das JSON zurück, keine zusätzlichen Erklärungen.`
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Parse JSON
    let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return {
      lieferantName: kreditorNameHint || 'Unbekannt',
      rechnungsNummer: '',
      rechnungsDatum: '',
      betrag: 0,
      nettoBetrag: 0,
      steuersatz: 19
    }
  } catch (error) {
    console.error('Error parsing invoice with Gemini:', error)
    return {
      lieferantName: kreditorNameHint || 'Unbekannt',
      rechnungsNummer: '',
      rechnungsDatum: '',
      betrag: 0,
      nettoBetrag: 0,
      steuersatz: 19
    }
  }
}
