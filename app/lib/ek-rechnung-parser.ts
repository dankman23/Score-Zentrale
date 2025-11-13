/**
 * Intelligenter EK-Rechnungs-Parser
 * 
 * Erkennt wiederkehrende Lieferanten und wendet spezifische Parsing-Templates an
 * Lernt aus bereits verarbeiteten Rechnungen
 */

export interface ParsedInvoice {
  lieferantName: string
  rechnungsNummer: string
  rechnungsDatum: string
  betrag: number
  nettoBetrag?: number
  steuersatz?: number
  lieferantAdresse?: string
  artikelListe?: Array<{
    bezeichnung: string
    menge?: number
    einzelpreis?: number
    gesamtpreis?: number
  }>
  confidence: number  // 0-100%
  parsingMethod: string
  rawText?: string
}

export interface LieferantTemplate {
  name: string
  kontonummer: string
  patterns: {
    name: RegExp[]
    rechnungsNr: RegExp[]
    datum: RegExp[]
    betrag: RegExp[]
    mehrwertsteuer?: RegExp[]
  }
  emailDomains?: string[]  // z.B. "@klingspor.de"
  priority: number  // 1-10, höher = wichtiger
}

/**
 * TEMPLATES FÜR WIEDERKEHRENDE LIEFERANTEN
 * Basierend auf Kreditoren-Liste (70001-70100)
 */
export const LIEFERANT_TEMPLATES: LieferantTemplate[] = [
  // SCHLEIFMITTEL-HERSTELLER (Hauptlieferanten)
  {
    name: 'Klingspor',
    kontonummer: '70004',
    patterns: {
      name: [/Klingspor/i, /KL?INGSPOR/i],
      rechnungsNr: [/Rechnung[:\s]*(\d{7,10})/i, /Rg[.-]?Nr[.:\s]*(\d+)/i, /Invoice[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i, /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})/],
      betrag: [/Gesamt[betrag]*[:\s]*([\d.,]+)\s*€?/i, /Rechnungsbetrag[:\s]*([\d.,]+)/i, /Total[:\s]*([\d.,]+)/i],
      mehrwertsteuer: [/MwSt[.:\s]*19%/i, /USt[.:\s]*19/i]
    },
    emailDomains: ['@klingspor.de', '@klingspor.com'],
    priority: 10
  },
  {
    name: 'VSM (Vereinigte Schmirgel- und Maschinen-Fabriken)',
    kontonummer: '70009',
    patterns: {
      name: [/VSM/i, /Vereinigte\s+Schmirgel/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /RE[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i, /Endbetrag[:\s]*([\d.,]+)/i],
      mehrwertsteuer: [/19%/i]
    },
    emailDomains: ['@vsm-abrasives.com'],
    priority: 10
  },
  {
    name: 'Starcke',
    kontonummer: '70006',
    patterns: {
      name: [/Starcke/i, /STARCKE/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /RG[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    emailDomains: ['@starcke.de'],
    priority: 10
  },
  {
    name: 'Rüggeberg (PFERD)',
    kontonummer: '70005',
    patterns: {
      name: [/R[üu]ggeberg/i, /PFERD/i, /RUGGEBERG/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /Rechnungs-Nr[.:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    emailDomains: ['@pferd.com', '@rueggeberg.com'],
    priority: 10
  },
  {
    name: 'LUKAS-ERZETT',
    kontonummer: '70010',
    patterns: {
      name: [/LUKAS[- ]?ERZETT/i, /LUKAS/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    priority: 9
  },

  // VERPACKUNG & LOGISTIK
  {
    name: 'MK Plastimex',
    kontonummer: '70015',
    patterns: {
      name: [/MK\s+Plastimex/i, /PLASTIMEX/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /RE[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    emailDomains: ['@mk-plastimex.de'],
    priority: 8
  },
  {
    name: 'NISSEN Klebetechnik',
    kontonummer: '70018',
    patterns: {
      name: [/NISSEN/i, /Klebetechnik/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    priority: 8
  },
  {
    name: 'DPD Deutschland',
    kontonummer: '70007',
    patterns: {
      name: [/DPD/i, /DPD\s+Deutschland/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /Invoice[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i, /Total[:\s]*([\d.,]+)/i],
    },
    emailDomains: ['@dpd.de', '@dpd.com'],
    priority: 7
  },
  {
    name: 'Der Grüne Punkt',
    kontonummer: '70014',
    patterns: {
      name: [/Gr[üu]ne\s+Punkt/i, /Duales\s+System/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    priority: 7
  },

  // SERVICES & DIENSTLEISTER
  {
    name: 'Händlerbund',
    kontonummer: '70008',
    patterns: {
      name: [/H[äa]ndlerbund/i, /HAENDLERBUND/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    emailDomains: ['@haendlerbund.de'],
    priority: 5
  },
  {
    name: 'Haufe Service Center',
    kontonummer: '70001',
    patterns: {
      name: [/Haufe/i, /HAUFE/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    emailDomains: ['@haufe.de'],
    priority: 5
  },

  // AMAZON
  {
    name: 'Amazon Logistics',
    kontonummer: '70030',
    patterns: {
      name: [/Amazon/i, /AMAZON/i],
      rechnungsNr: [/(\d{3}-\d{7}-\d{7})/i, /Invoice[:\s]*(\d+)/i],  // Amazon Format
      datum: [/(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})/],
      betrag: [/Total[:\s]*([\d.,]+)/i, /Gesamt[:\s]*([\d.,]+)/i],
    },
    emailDomains: ['@amazon.de', '@amazon.com'],
    priority: 6
  }
]

/**
 * Haupt-Parser-Funktion
 */
export async function parseEKRechnung(
  text: string,
  emailFrom?: string,
  filename?: string
): Promise<ParsedInvoice> {
  
  // 1. Versuche Template-basiertes Parsing
  const templateResult = tryTemplateBasedParsing(text, emailFrom, filename)
  if (templateResult && templateResult.confidence > 70) {
    return templateResult
  }
  
  // 2. Fallback: Generisches AI-Parsing (Gemini)
  // Wird vom calling code gemacht
  
  return {
    lieferantName: 'Unbekannt',
    rechnungsNummer: '',
    rechnungsDatum: '',
    betrag: 0,
    confidence: 0,
    parsingMethod: 'failed',
    rawText: text
  }
}

/**
 * Template-basiertes Parsing
 */
function tryTemplateBasedParsing(
  text: string,
  emailFrom?: string,
  filename?: string
): ParsedInvoice | null {
  
  // Finde passendes Template
  let matchedTemplate: LieferantTemplate | null = null
  let maxPriority = 0
  
  for (const template of LIEFERANT_TEMPLATES) {
    // Check Email-Domain
    if (emailFrom && template.emailDomains) {
      const matchesEmail = template.emailDomains.some(domain => 
        emailFrom.toLowerCase().includes(domain.toLowerCase())
      )
      if (matchesEmail && template.priority > maxPriority) {
        matchedTemplate = template
        maxPriority = template.priority
      }
    }
    
    // Check Name im Text
    const matchesName = template.patterns.name.some(pattern => 
      pattern.test(text)
    )
    if (matchesName && template.priority > maxPriority) {
      matchedTemplate = template
      maxPriority = template.priority
    }
  }
  
  if (!matchedTemplate) return null
  
  // Parse mit Template
  const parsed: Partial<ParsedInvoice> = {
    lieferantName: matchedTemplate.name,
    parsingMethod: `template:${matchedTemplate.name}`,
    confidence: 60  // Basis-Confidence
  }
  
  // Rechnungsnummer extrahieren
  for (const pattern of matchedTemplate.patterns.rechnungsNr) {
    const match = text.match(pattern)
    if (match && match[1]) {
      parsed.rechnungsNummer = match[1].trim()
      parsed.confidence! += 10
      break
    }
  }
  
  // Datum extrahieren
  for (const pattern of matchedTemplate.patterns.datum) {
    const match = text.match(pattern)
    if (match && match[1]) {
      parsed.rechnungsDatum = match[1].trim()
      parsed.confidence! += 10
      break
    }
  }
  
  // Betrag extrahieren
  for (const pattern of matchedTemplate.patterns.betrag) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const betragStr = match[1].replace('.', '').replace(',', '.')
      parsed.betrag = parseFloat(betragStr)
      parsed.confidence! += 15
      break
    }
  }
  
  // MwSt extrahieren (optional)
  if (matchedTemplate.patterns.mehrwertsteuer) {
    for (const pattern of matchedTemplate.patterns.mehrwertsteuer) {
      if (pattern.test(text)) {
        parsed.steuersatz = 19
        parsed.confidence! += 5
        break
      }
    }
  }
  
  // Validierung
  if (!parsed.rechnungsNummer || !parsed.betrag) {
    return null
  }
  
  return parsed as ParsedInvoice
}

/**
 * Lern-Funktion: Analysiert bereits verarbeitete Rechnungen
 * und schlägt neue Templates vor
 */
export async function analyzeProcessedInvoices(invoices: any[]): Promise<{
  suggestions: Partial<LieferantTemplate>[]
  statistics: Record<string, number>
}> {
  const lieferantCounts: Record<string, number> = {}
  const suggestions: Partial<LieferantTemplate>[] = []
  
  // Zähle Häufigkeit
  for (const invoice of invoices) {
    const name = invoice.lieferantName || 'Unbekannt'
    lieferantCounts[name] = (lieferantCounts[name] || 0) + 1
  }
  
  // Finde häufige Lieferanten ohne Template
  for (const [name, count] of Object.entries(lieferantCounts)) {
    if (count >= 3) {  // Mind. 3 Rechnungen
      const hasTemplate = LIEFERANT_TEMPLATES.some(t => 
        t.name.toLowerCase().includes(name.toLowerCase())
      )
      
      if (!hasTemplate) {
        suggestions.push({
          name,
          priority: Math.min(count, 10),
          patterns: {
            name: [new RegExp(name, 'i')],
            rechnungsNr: [/Rechnung[:\s]*(\d+)/i],
            datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
            betrag: [/Gesamt[:\s]*([\d.,]+)/i]
          }
        })
      }
    }
  }
  
  return {
    suggestions,
    statistics: lieferantCounts
  }
}
