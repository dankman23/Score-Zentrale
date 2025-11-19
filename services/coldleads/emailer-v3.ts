/**
 * Kaltakquise Emailer V3
 * Nach ChatGPT-Prompt-Specs:
 * - 3 Mails (Erst + 2 Follow-ups)
 * - Kein Markdown
 * - Wortlimits
 * - Strukturierte CTAs
 */

import { getEmailSignature, SCORE_CONFIG, selectValuePropositions } from '../../lib/score-coldleads-config'
import { emergentChatCompletion } from '../../lib/emergent-llm'
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
    recommended_brands: SCORE_CONFIG.brands.primary.slice(0, 3)
  }
  
  return generateEmailSequenceV3(analysisResult)
}


/**
 * Mail 1 - Erstansprache (HTML) - NEUE VERSION mit ChatGPT
 * Basiert auf Daniel Leismann's Vorgaben für persönlichen, menschlichen Stil
 */
async function generateMail1(
  analysis: AnalyzerV3Result,
  anrede: string,
  brandsText: string,
  valueProps: string[]
): Promise<{ subject: string; body: string; word_count: number }> {
  
  // Extrahiere Daten aus Analyse
  const werkstoffe = analysis.materials.map(m => m.term).slice(0, 3)
  const werkstucke = analysis.workpieces?.map(w => w.term).slice(0, 3) || []
  const anwendungen = analysis.applications.map(a => a.term).slice(0, 3)
  
  // Baue Kontext für ChatGPT
  const firmendaten = {
    name: analysis.company,
    werkstoffe: werkstoffe.length > 0 ? werkstoffe.join(', ') : 'verschiedene Metalle',
    werkstucke: werkstucke.length > 0 ? werkstucke.join(', ') : 'Metallprodukte',
    anwendungen: anwendungen.length > 0 ? anwendungen.join(', ') : 'Metallbearbeitung'
  }
  
  // ChatGPT Prompt für menschliche, persönliche E-Mail
  const prompt = `Du bist Daniel Leismann von Score-Schleifwerkzeuge und schreibst eine kurze, persönliche B2B-E-Mail.

**Firmendaten aus Analyse:**
- Firma: ${firmendaten.name}
- Werkstoffe: ${firmendaten.werkstoffe}
- Produkte/Werkstücke: ${firmendaten.werkstucke}
- Tätigkeiten: ${firmendaten.anwendungen}

**WICHTIG - Tonalität:**
- Locker und menschlich, kein Marketing-Blabla
- Kein "wir freuen uns", keine Worthülsen
- Kein perfektes Hochdeutsch, eher natürlich
- Direkt, freundlich, kurz

**Inhalt (in dieser Reihenfolge):**

1. **Persönlicher Bezug** (1-2 Sätze):
   - Nenne KONKRET was du über die Firma gelernt hast (Werkstoffe, Produkte, Tätigkeiten)
   - Beispiel: "Ich bin auf Ihre Firma gestoßen und fand interessant, dass Sie viel mit Edelstahl arbeiten."

2. **Unser Angebot** (2-3 Sätze):
   - Wir arbeiten mit allen führenden Herstellern (Klingspor, 3M, Norton)
   - Können den kompletten Jahresbedarf an Schleifmitteln & Trennwerkzeugen abdecken
   - Bieten Staffelpreise und Rahmenverträge
   - Sehr schnelle Lieferung deutschlandweit
   
   WENN Edelstahl erkannt: Erwähne Fächerscheiben, Fiberscheiben, INOX-Trennscheiben
   WENN Aluminium erkannt: Erwähne Anti-Clog-Scheiben, Alu-Trennscheiben

3. **Klare Handlungsaufforderung:**
   - "Einfach per Mail melden oder anrufen: 0221-25999901 (10-18 Uhr)"
   - Optional: "Gerne erstelle ich Ihnen ein individuelles Angebot, sobald ich weiß, welche Werkstoffe bei Ihnen am wichtigsten sind."

**Format:**
- Nutze <b> für Fettdruck
- Nutze <a href="tel:+4922125999901">0221-25999901</a> für Telefon
- KEIN Markdown
- Maximal 150 Wörter
- Signatur NICHT einschließen (wird später hinzugefügt)

**Beispiel-Stil (NICHT wortwörtlich verwenden):**
"Ich bin auf ${firmendaten.name} aufmerksam geworden und sah, dass Sie viel mit ${firmendaten.werkstoffe} arbeiten. Wir sind auf Schleifwerkzeuge spezialisiert und könnten Ihnen da einiges abnehmen..."

Schreibe jetzt die E-Mail:`

  try {
    // Rufe ChatGPT auf
    const aiResponse = await emergentChatCompletion([
      { role: 'system', content: 'Du bist ein Experte für natürliche, menschliche B2B-Kommunikation. Du schreibst kurze, direkte E-Mails ohne Marketing-Floskeln.' },
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o-mini',
      temperature: 0.9, // Höher für mehr Variation
      max_tokens: 500
    })
    
    const body = aiResponse.trim()
    
    // Füge Signatur hinzu
    const signature = `\n\nViele Grüße\n<b>Daniel Leismann</b>\nScore Schleifwerkzeuge\n📞 <a href="tel:+4922125999901">0221-25999901</a> (Mo-Fr 10-18 Uhr)\n📧 <a href="mailto:leismann@score-schleifwerkzeuge.de">leismann@score-schleifwerkzeuge.de</a>`
    
    const fullBody = body + signature
    
    // Subject basierend auf Werkstoff
    let subject = `Schleifwerkzeuge für ${analysis.company}`
    if (werkstoffe.length > 0) {
      subject = `Schleifwerkzeuge für ${werkstoffe[0]} – ${analysis.company}`
    }
    
    return {
      subject,
      body: fullBody,
      word_count: fullBody.split(/\s+/).length
    }
    
  } catch (error) {
    console.error('[Mail1] ChatGPT error, using fallback:', error)
    
    // Fallback: Einfache Template-basierte E-Mail
    const subject = `Schleifwerkzeuge für ${analysis.company}`
    const body = `${anrede},

ich bin auf Ihre Firma ${analysis.company} gestoßen und fand interessant, dass Sie mit ${firmendaten.werkstoffe} arbeiten.

Wir bei Score Schleifwerkzeuge arbeiten mit allen führenden Herstellern (Klingspor, 3M, Norton) zusammen und können Ihren kompletten Jahresbedarf an Schleifwerkzeugen abdecken. Staffelpreise und schnelle Lieferung deutschlandweit inklusive.

Wenn Sie möchten, schaue ich mir Ihren Bedarf an und erstelle ein Angebot.

Einfach per Mail melden oder anrufen: <a href="tel:+4922125999901">0221-25999901</a> (10-18 Uhr)

Viele Grüße
<b>Daniel Leismann</b>
Score Schleifwerkzeuge
📞 <a href="tel:+4922125999901">0221-25999901</a>
📧 <a href="mailto:leismann@score-schleifwerkzeuge.de">leismann@score-schleifwerkzeuge.de</a>`
    
    return {
      subject,
      body,
      word_count: body.split(/\s+/).length
    }
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
