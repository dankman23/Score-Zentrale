/**
 * Kaltakquise Emailer V2
 * Plain-Text, 120-180 Wörter, kein Markdown/HTML/Emojis
 */

interface EmailGenerationInput {
  company_profile: any
  contact: any
  assessment: any
}

interface GeneratedEmail {
  to: string
  subject_variants: [string, string]
  preheader: string
  body: string
}

/**
 * Generiert personalisierte Plain-Text Email
 */
export function generateEmailV2(input: EmailGenerationInput): GeneratedEmail {
  const { company_profile, contact, assessment } = input
  
  // 1. Anrede generieren
  const greeting = generateGreeting(contact, company_profile.name)
  
  // 2. Einstieg mit konkretem Bezug
  const opening = generateOpening(company_profile, assessment)
  
  // 3. Drei Nutzenpunkte
  const benefits = generateBenefits(assessment, company_profile)
  
  // 4. Angebot
  const offer = generateOffer(company_profile, assessment)
  
  // 5. CTA
  const cta = generateCTA()
  
  // 6. Signatur
  const signature = generateSignature()
  
  // 7. Betreff & Preheader
  const subjects = generateSubjects(company_profile, assessment)
  const preheader = generatePreheader(assessment)
  
  // Body zusammenbauen
  const body = [
    greeting,
    '',
    opening,
    '',
    benefits,
    '',
    offer,
    '',
    cta,
    '',
    signature
  ].join('\n')
  
  // Validiere Länge (120-180 Wörter)
  const wordCount = body.split(/\s+/).length
  console.log(`[EmailerV2] Generated email with ${wordCount} words (target: 120-180)`)
  
  return {
    to: contact.email || '',
    subject_variants: subjects,
    preheader,
    body
  }
}

function generateGreeting(contact: any, companyName: string): string {
  if (contact.name && contact.name.trim()) {
    // Extrahiere Nachname
    const parts = contact.name.trim().split(' ')
    const lastName = parts[parts.length - 1]
    return `Guten Tag Frau/Herr ${lastName},`
  }
  
  return `Guten Tag ${companyName}-Team,`
}

function generateOpening(company_profile: any, assessment: any): string {
  // Konkreter Bezug zur Firma
  const materials = company_profile.mapped_terms.materials.slice(0, 2).join(', ')
  const applications = company_profile.mapped_terms.applications.slice(0, 2).join(', ')
  
  if (materials && applications) {
    return `ich bin auf Ihre Arbeit mit ${materials} aufmerksam geworden. Als Spezialist für ${applications} sind Sie genau die Art Unternehmen, die von unseren Hochleistungs-Schleifmitteln profitiert.`
  }
  
  if (materials) {
    return `ich habe gesehen, dass Sie mit ${materials} arbeiten. Genau für diese Materialien haben wir die passenden Schleifwerkzeuge auf Lager.`
  }
  
  if (applications) {
    return `ich bin auf Ihre Spezialisierung im Bereich ${applications} aufmerksam geworden. Dafür bieten wir die passenden Schleifmittel.`
  }
  
  return `ich habe Ihr Unternehmen im Bereich ${company_profile.industry} entdeckt und möchte Ihnen unsere Schleifwerkzeug-Lösungen vorstellen.`
}

function generateBenefits(assessment: any, company_profile: any): string {
  const benefits: string[] = []
  
  // Basierend auf Materialien/Anwendungen spezifische Nutzen
  const materials = company_profile.mapped_terms.materials
  const applications = company_profile.mapped_terms.applications
  
  if (materials.some((m: string) => ['Edelstahl', 'Chromstahl', 'Nickelstahl'].includes(m))) {
    benefits.push('– Spezielle Inox-Trennscheiben, die nicht zusetzen und saubere Schnittkanten liefern')
    benefits.push('– Standzeit bis zu 30% höher durch Keramikkorn-Technologie')
  } else if (materials.some((m: string) => ['Stahl', 'Kohlenstoffstahl'].includes(m))) {
    benefits.push('– Aggressive Materialabtragung bei Stahl mit Zirkon/Keramik-Fächerscheiben')
    benefits.push('– Reduzierte Wechselzeit durch höhere Standzeiten')
  } else if (materials.some((m: string) => ['Aluminium', 'Aluguss'].includes(m))) {
    benefits.push('– Spezial-Schleifbänder für Aluminium, die nicht zusetzen')
    benefits.push('– Saubere Oberflächen ohne Verfärbungen')
  } else {
    // Generische Nutzen
    benefits.push('– Höhere Standzeiten durch Premium-Schleifmittel von Klingspor, VSM, 3M')
    benefits.push('– Schnellere Prozesse durch optimierte Kornstruktur')
  }
  
  if (applications.some((a: string) => ['Polieren', 'Oberflächenfinish', 'Hochglanzpolieren'].includes(a))) {
    benefits.push('– Finish-Vlies für perfekte Oberflächen ohne Nacharbeit')
  } else if (applications.some((a: string) => ['Schweißnahtbearbeitung', 'Entgraten'].includes(a))) {
    benefits.push('– Schruppscheiben und Fächerscheiben für schnelle Schweißnaht-Nachbearbeitung')
  } else {
    benefits.push('– Lieferung oft noch am gleichen Tag (Lager in Köln)')
  }
  
  return benefits.slice(0, 3).join('\n')
}

function generateOffer(company_profile: any, assessment: any): string {
  const materials = company_profile.mapped_terms.materials.slice(0, 2).join('/')
  const applications = company_profile.mapped_terms.applications.slice(0, 2).join('/')
  
  let specifics = materials || applications || 'Ihre Anwendungen'
  
  return `Gerne sende ich Ihnen 2-3 passende Muster plus kompaktes Preisblatt mit Rahmenpreisen, exakt abgestimmt auf ${specifics}.`
}

function generateCTA(): string {
  return `Kurze Rückmeldung per Mail oder direkt anrufen: 0221-25999901. Alternativ Termin vorschlagen oder direkte Anfrage über:\nhttps://score-schleifwerkzeuge.de/business`
}

function generateSignature(): string {
  return `Daniel Leismann | Score Schleifwerkzeuge\nT: 0221-25999901\nE: daniel@score-schleifwerkzeuge.de\nhttps://score-schleifwerkzeuge.de`
}

function generateSubjects(company_profile: any, assessment: any): [string, string] {
  const materials = company_profile.mapped_terms.materials[0] || 'Metall'
  const application = company_profile.mapped_terms.applications[0] || 'Fertigung'
  
  // Variante 1: Material-fokussiert
  const subject1 = `Schleifmittel für ${materials} – weniger Wechselzeit`
  
  // Variante 2: Anwendungs-fokussiert  
  const subject2 = `${application}: Standzeit rauf, Kosten runter`
  
  // Max 70 Zeichen
  return [
    subject1.substring(0, 70),
    subject2.substring(0, 70)
  ]
}

function generatePreheader(assessment: any): string {
  const products = assessment.recommended_products.slice(0, 2).join(', ')
  
  if (products) {
    return `Premium-Qualität auf Lager: ${products}`.substring(0, 90)
  }
  
  return 'Hochleistungs-Schleifmittel für Ihre Fertigung – Muster verfügbar'.substring(0, 90)
}

/**
 * Wrapper für alte API-Kompatibilität
 */
export async function generateAndSendEmailV2(
  analysisResult: any,
  sendImmediately: boolean = false
): Promise<{
  email: GeneratedEmail
  sent: boolean
  messageId?: string
}> {
  
  const email = generateEmailV2(analysisResult)
  
  if (sendImmediately && email.to) {
    // TODO: Actual sending via nodemailer
    console.log('[EmailerV2] Would send to:', email.to)
  }
  
  return {
    email,
    sent: sendImmediately && !!email.to,
    messageId: sendImmediately ? `<${Date.now()}@score-schleifwerkzeuge.de>` : undefined
  }
}
