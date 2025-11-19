/**
 * Kaltakquise Emailer V3
 * Nach ChatGPT-Prompt-Specs:
 * - 3 Mails (Erst + 2 Follow-ups)
 * - Kein Markdown
 * - Wortlimits
 * - Strukturierte CTAs
 */

import { getEmailSignature, SCORE_CONFIG, selectValuePropositions } from '@/lib/score-coldleads-config'
import { emergentChatCompletion } from '@/lib/emergent-llm'
import type { AnalyzerV3Result } from './analyzer-v3'

export interface EmailV3Result {
  mail_1: { subject: string; body: string; word_count: number }
  mail_2: { subject: string; body: string; word_count: number }
  mail_3: { subject: string; body: string; word_count: number }
  crm_tags: string[]
}

/**
 * Generiert alle 3 Mails (Erst + 2 Follow-ups)
 */
export async function generateEmailSequenceV3(
  analysis: AnalyzerV3Result
): Promise<EmailV3Result> {
  
  console.log(`[EmailerV3] Generating email sequence for: ${analysis.company}`)
  
  const anrede = determineGreeting(analysis.contact_person)
  const brandsText = analysis.recommended_brands.join(', ')
  const valueProps = selectValuePropositions(3)
  
  // Mail 1 - Erstansprache (≤180 Wörter)
  const mail1 = await generateMail1(
    analysis,
    anrede,
    brandsText,
    valueProps
  )
  
  // Mail 2 - Follow-up 1 (≤110 Wörter, nach 4-6 Tagen)
  const mail2 = generateMail2(
    analysis,
    anrede,
    brandsText
  )
  
  // Mail 3 - Follow-up 2 (≤90 Wörter, nach 10-14 Tagen)
  const mail3 = generateMail3(
    analysis,
    anrede
  )
  
  // CRM Tags
  const crmTags = generateCRMTags(analysis)
  
  return {
    mail_1: mail1,
    mail_2: mail2,
    mail_3: mail3,
    crm_tags: crmTags
  }
}


/**
 * Wrapper für analysis_v3 Format aus DB
 * Konvertiert analysis_v3 zu AnalyzerV3Result Format
 */
export async function generateEmailSequenceV3FromAnalysis(
  analysis_v3: any,
  company_name: string
): Promise<EmailV3Result> {
  
  // Konvertiere analysis_v3 Format zu AnalyzerV3Result
  const analysisResult: AnalyzerV3Result = {
    company: company_name,
    url: '',
    branch_guess: [],
    contact_person: analysis_v3.contact_person || { name: '', role: '', email: '', confidence: 0 },
    materials: (analysis_v3.materials || []).map((m: string) => ({ term: m, evidence: '' })),
    applications: (analysis_v3.applications || []).map((a: string) => ({ term: a, evidence: '' })),
    machines: (analysis_v3.machines || []).map((m: string) => ({ term: m, evidence: '' })),
    product_categories: [],
    confidence_overall: analysis_v3.analysis_quality || 50,
    notes: analysis_v3.firmenprofil || '',
    recommended_brands: SCORE_CONFIG.brands.slice(0, 3)
  }
  
  return generateEmailSequenceV3(analysisResult)
}


/**
 * Mail 1 - Erstansprache (HTML)
 */
async function generateMail1(
  analysis: AnalyzerV3Result,
  anrede: string,
  brandsText: string,
  valueProps: string[]
): Promise<{ subject: string; body: string; word_count: number }> {
  
  const signature = getEmailSignature()
  
  // Material/Anwendung für personalisierte Ansprache
  const mainApp = analysis.applications[0]?.term || 'Ihre Fertigung'
  const mainMat = analysis.materials[0]?.term || 'Metall'
  
  const subject = `Schleifwerkzeuge für ${mainApp} – Jahresbedarf & Beratung`
  
  const body = `${anrede},

ich bin auf Ihre Firma ${analysis.company} gestoßen und habe gesehen, dass Sie im Bereich ${mainApp} tätig sind.

Wir bei Score Schleifwerkzeuge arbeiten mit allen führenden Herstellern der Branche zusammen (${brandsText}) und können dadurch Ihren <b>kompletten Jahresbedarf</b> an Schleifwerkzeugen optimal abdecken.

<b>Was wir anbieten:</b>
• Passgenaue Produktauswahl für ${mainMat} und ${mainApp}
• Staffelpreise und Rahmenverträge für Ihren Jahresbedarf
• Schnelle Lieferung deutschlandweit

<b>Persönliche Beratung – jederzeit zwischen 10 und 18 Uhr:</b>
📞 <a href="tel:+4922125999901">(+49) 0221-25999901</a>

<b>Oder Beratungstermin per Mail vereinbaren:</b>
Antworten Sie einfach auf diese Mail, und ich melde mich bei Ihnen.

<b>Mehr Infos für Großkunden:</b>
🔗 <a href="https://score-schleifwerkzeuge.de/business">https://score-schleifwerkzeuge.de/business</a>

${signature}`
  
  return {
    subject,
    body,
    word_count: body.split(/\s+/).length
  }
}

/**
 * Mail 2 - Follow-up 1 (HTML)
 */
function generateMail2(
  analysis: AnalyzerV3Result,
  anrede: string,
  brandsText: string
): { subject: string; body: string; word_count: number } {
  
  const signature = getEmailSignature()
  const mainMat = analysis.materials.length > 0 ? analysis.materials[0].term : 'Ihre Fertigung'
  
  const subject = `Nachfrage: Jahresbedarf Schleifwerkzeuge für ${analysis.company}`
  
  const body = `${anrede},

vor einigen Tagen hatte ich Ihnen geschrieben wegen passender Schleifwerkzeuge für ${mainMat}.

<b>Kurzer Hinweis:</b> Wir bieten <b>Rahmenverträge für den kompletten Jahresbedarf</b> mit Staffelpreisen an. Das spart Zeit beim Einkauf und bringt bessere Konditionen.

<b>Bei Interesse:</b>
• 📞 Einfach anrufen: <a href="tel:+4922125999901">(+49) 0221-25999901</a> (Mo-Fr 10-18 Uhr)
• 📧 Oder auf diese Mail antworten für Beratungstermin
• 🔗 Infos: <a href="https://score-schleifwerkzeuge.de/business">https://score-schleifwerkzeuge.de/business</a>

${signature}`
  
  return {
    subject,
    body,
    word_count: body.split(/\s+/).length
  }
}

/**
 * Mail 3 - Follow-up 2 (HTML)
 */
function generateMail3(
  analysis: AnalyzerV3Result,
  anrede: string
): { subject: string; body: string; word_count: number } {
  
  const signature = getEmailSignature()
  
  const subject = `Kurzer Anruf zu Schleifwerkzeugen?`
  
  const body = `${anrede},

ich möchte nicht weiter stören - vielleicht passt unser Angebot gerade nicht.

<b>Falls doch Interesse besteht:</b> Darf ich Sie diese Woche kurz (10 Min) anrufen?

Z.B. <b>Donnerstag 14 Uhr</b> oder <b>Freitag 10 Uhr</b>?

📞 <a href="tel:+4922125999901">(+49) 0221-25999901</a>

Eine kurze Info reicht. Danke!

${signature}`
  
  return {
    subject,
    body,
    word_count: body.split(/\s+/).length
  }
}

/**
 * Bestimmt Anrede
 */
function determineGreeting(contact: any): string {
  if (contact.name && contact.name !== 'Nicht gefunden') {
    // Extrahiere Nachname
    const parts = contact.name.split(' ')
    const lastName = parts[parts.length - 1]
    
    // Geschlecht schätzen (sehr einfach)
    const firstName = parts[0].toLowerCase()
    if (firstName.endsWith('a') || firstName.includes('ina') || firstName.includes('ine')) {
      return `Hallo Frau ${lastName}`
    } else {
      return `Hallo Herr ${lastName}`
    }
  }
  
  return 'Guten Tag'
}

/**
 * CRM Tags generieren
 */
function generateCRMTags(analysis: AnalyzerV3Result): string[] {
  const tags = new Set<string>()
  
  // Branch
  analysis.branch_guess.forEach(b => tags.add(b))
  
  // Top Applications (max 3)
  analysis.applications.slice(0, 3).forEach(a => tags.add(a.term))
  
  // Top Materials (max 2)
  analysis.materials.slice(0, 2).forEach(m => tags.add(m.term))
  
  // Top Brands
  analysis.recommended_brands.forEach(b => tags.add(b))
  
  return Array.from(tags).slice(0, 8)
}

/**
 * Fallback Mail 1
 */
function generateFallbackMail1(
  analysis: AnalyzerV3Result,
  anrede: string,
  brandsText: string,
  signature: string
): { subject: string; body: string; word_count: number } {
  
  const material = analysis.materials[0]?.term || 'Metall'
  const application = analysis.applications[0]?.term || 'Bearbeitung'
  
  const subject = `${application} in ${analysis.branch_guess[0] || 'Ihrer Branche'}: schnell & passgenau`
  
  const body = `${anrede},

ich habe gesehen, dass ${analysis.company} mit ${material} arbeitet. Dafür haben wir passende Schleifwerkzeuge auf Lager.

Was wir bieten:
Schnelle Verfügbarkeit durch Lager und Partner
Sondermaße und Konfektion auf Anfrage
Rahmenverträge mit Staffelpreisen
Technischer Support und Beratung

Wir führen starke Marken: ${brandsText}.

Interesse? Dann rufen Sie gerne an: ${SCORE_CONFIG.company.phone}
Oder hier klicken: ${SCORE_CONFIG.company.business_form_url}

PS: Muster und Beratung sind kostenlos.

${signature}`
  
  return {
    subject,
    body,
    word_count: body.split(/\s+/).length
  }
}
