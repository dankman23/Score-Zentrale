/**
 * Kaltakquise Emailer V3
 * Nach ChatGPT-Prompt-Specs:
 * - 3 Mails (Erst + 2 Follow-ups)
 * - Kein Markdown
 * - Wortlimits
 * - Strukturierte CTAs
 */

import { getEmailSignature, SCORE_CONFIG, selectValuePropositions } from '@/lib/score-coldleads-config'
import { callEmergentLLM } from '@/lib/emergent-llm'
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
 * Mail 1 - Erstansprache
 */
async function generateMail1(
  analysis: AnalyzerV3Result,
  anrede: string,
  brandsText: string,
  valueProps: string[]
): Promise<{ subject: string; body: string; word_count: number }> {
  
  const signature = getEmailSignature()
  
  // LLM-generierte Mail mit strikten Vorgaben
  const prompt = `Du schreibst eine B2B-Erstmail für Score Schleifwerkzeuge (Köln).

**Firmen-Analyse:**
- Firma: ${analysis.company}
- Branche: ${analysis.branch_guess.join(', ')}
- Anwendungen: ${analysis.applications.map(a => a.term).join(', ')}
- Werkstoffe: ${analysis.materials.map(m => m.term).join(', ')}
- Maschinen: ${analysis.machines.map(m => m.term).join(', ')}
- Empfohlene Marken: ${brandsText}

**Regeln:**
1. Betreff: 55-70 Zeichen, Nutzen + Bezug (Material/Maschine/Anwendung)
2. Anrede: ${anrede}
3. Hook: 1-2 Sätze Website-Bezug (z.B. "${analysis.applications[0]?.evidence || 'Ihre Metallbearbeitung'}")
4. Passgenaue Angebote: 3-5 kurze Sätze OHNE Aufzählungszeichen
5. Marken: ${brandsText}
6. CTA: Genau EINE Option (Telefon ${SCORE_CONFIG.company.phone} ODER Business-Link)
7. PS: Optional 1 Satz (Muster/Staffelpreise/Rahmenvertrag)
8. KEIN Markdown/Sternchen!
9. MAX 180 Wörter!

**Ausgabe als JSON:**
{
  "subject": "...",
  "body": "..."
}

Nur JSON, keine Erklärungen.`

  try {
    const response = await callEmergentLLM([
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 800
    })
    
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const fullBody = `${parsed.body}\n\n${signature}`
      const wordCount = fullBody.split(/\s+/).length
      
      return {
        subject: parsed.subject,
        body: fullBody,
        word_count: wordCount
      }
    }
  } catch (e) {
    console.error('Mail 1 Generation Error:', e)
  }
  
  // Fallback
  return generateFallbackMail1(analysis, anrede, brandsText, signature)
}

/**
 * Mail 2 - Follow-up 1 (≤110 Wörter)
 */
function generateMail2(
  analysis: AnalyzerV3Result,
  anrede: string,
  brandsText: string
): { subject: string; body: string; word_count: number } {
  
  const signature = getEmailSignature()
  
  const subject = `Nachfrage: Schleifwerkzeuge für ${analysis.company}`
  
  const body = `${anrede},

vor einigen Tagen hatte ich Ihnen geschrieben wegen passender Schleifwerkzeuge für ${analysis.materials.length > 0 ? analysis.materials[0].term : 'Ihre Fertigung'}.

Ein kurzer Hinweis: Wir bieten auch Rahmenverträge mit Staffelpreisen an. Das spart Zeit beim Einkauf und bringt bessere Konditionen.

Bei Interesse können Sie hier direkt ein kurzes Formular ausfüllen:
${SCORE_CONFIG.company.business_form_url}

Oder einfach anrufen: ${SCORE_CONFIG.company.phone}

${signature}`
  
  return {
    subject,
    body,
    word_count: body.split(/\s+/).length
  }
}

/**
 * Mail 3 - Follow-up 2 (≤90 Wörter)
 */
function generateMail3(
  analysis: AnalyzerV3Result,
  anrede: string
): { subject: string; body: string; word_count: number } {
  
  const signature = getEmailSignature()
  
  const subject = `Kurzer Anruf zu Schleifwerkzeugen?`
  
  const body = `${anrede},

ich möchte nicht weiter stören - vielleicht passt unser Angebot gerade nicht.

Falls doch Interesse besteht: Darf ich Sie diese Woche kurz (10 Min) anrufen?

Z.B. Donnerstag 14 Uhr oder Freitag 10 Uhr?

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
