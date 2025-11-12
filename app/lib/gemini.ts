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
 */
export async function extractInvoiceData(
  pdfContent: Buffer,
  extractionPrompt?: string
): Promise<ExtractedInvoiceData> {
  try {
    const model = getGeminiModel()
    
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
