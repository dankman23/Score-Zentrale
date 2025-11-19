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
  
  // FIRMENNAMEN BEREINIGEN - extrem wichtig!
  let cleanedFirmenname = firmendaten.name
  
  // Entferne typische Präfixe wie "Impressum -", "Startseite |", etc.
  const prefixesToRemove = [
    /^Impressum\s*[-–|:]\s*/i,
    /^Startseite\s*[-–|:]\s*/i,
    /^Über uns\s*[-–|:]\s*/i,
    /^Kontakt\s*[-–|:]\s*/i,
    /^Home\s*[-–|:]\s*/i,
    /^Willkommen\s*[-–|:]\s*/i
  ]
  
  for (const pattern of prefixesToRemove) {
    cleanedFirmenname = cleanedFirmenname.replace(pattern, '').trim()
  }
  
  // Wenn kein eindeutiger Name übrig bleibt, verwende "Ihr Unternehmen"
  if (!cleanedFirmenname || cleanedFirmenname.length < 3) {
    cleanedFirmenname = 'Ihr Unternehmen'
  }
  
  // ChatGPT Prompt für individuelle, menschliche E-Mail
  const prompt = `Du bist Daniel Leismann von Score-Schleifwerkzeuge. Schreibe eine INDIVIDUELLE, menschlich klingende B2B-E-Mail.

**FIRMENDATEN (vom Analyzer):**
- Firma: ${cleanedFirmenname}
- Werkstoffe: ${firmendaten.werkstoffe}
- Produkte/Werkstücke: ${firmendaten.werkstucke}
- Tätigkeiten/Anwendungen: ${firmendaten.anwendungen}

**KRITISCHE REGEL - FIRMENNAMEN:**
Der Firmenname ist bereits bereinigt. Verwende EXAKT: "${cleanedFirmenname}"
Falls dieser "Ihr Unternehmen" ist, schreibe: "ich bin auf Ihre Firma gestoßen" (ohne Namen).

**PFLICHT - Bezug auf MINDESTENS DREI echte Daten:**
Du MUSST konkret erwähnen:
1. Werkstoffe (${firmendaten.werkstoffe})
2. Produkte/Werkstücke (${firmendaten.werkstucke})
3. Anwendungen/Tätigkeiten (${firmendaten.anwendungen})

**TONALITÄT (absolut kritisch):**
✅ Locker, freundlich, persönlich
✅ Echter Gesprächsstil - als würdest du mit einem Kollegen sprechen
✅ Natürlich, NICHT perfektes Hochdeutsch
✅ KEIN Marketing-Blabla

❌ NIEMALS schreiben:
- "Sehr geehrte Damen und Herren"
- "Wir freuen uns"
- "Als führender Anbieter"
- Marketing-Sprache
- Künstliche Formulierungen
- Übertreibungen

**INHALT-STRUKTUR:**

1. **Persönlicher Einstieg** (2 Sätze):
   Nenne konkret, was du über die Firma gelernt hast.
   Beispiel: "Ich bin auf ${cleanedFirmenname !== 'Ihr Unternehmen' ? cleanedFirmenname : 'Ihre Firma'} gestoßen und habe gesehen, dass Sie mit ${firmendaten.werkstoffe} arbeiten und ${firmendaten.werkstucke} fertigen."

2. **Was wir bieten** (3-4 Sätze):
   - Lieferant für Schleif- und Trennwerkzeuge, Poliermittel, Vlies, Bänder, Scheiben
   - Zusammenarbeit mit ALLEN führenden Herstellern: Klingspor, 3M, Norton, VSM, PFERD, Rhodius, Starcke
   - Jahresbedarf abdecken + Staffelpreise + Rahmenverträge
   - Schnelle Lieferung deutschlandweit
   
   **PRODUKTEMPFEHLUNG basierend auf Werkstoff:**
   - Edelstahl → Fächerscheiben, Fiberscheiben, INOX-Trennscheiben
   - Aluminium → Anti-Clog-Scheiben, Alu-Trennscheiben
   - Allgemein → passende Werkzeuge für Schnitt, Schliff, Finish

3. **Mehrwert-Angebot** (1 Satz):
   "Wenn Sie möchten, schaue ich mir Ihren Bedarf an und erstelle ein individuelles Angebot."

4. **Call-to-Action:**
   "Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr)."

**FORMAT:**
- 120-180 Wörter (NICHT mehr!)
- Nutze <b> für wichtige Begriffe
- Absätze für Lesbarkeit
- KEINE Signatur (wird separat hinzugefügt)
- NUR die E-Mail, sonst NICHTS

Schreibe jetzt NUR die E-Mail-Text (120-180 Wörter):`

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
    
    // Fallback: Template-basierte E-Mail mit mehr Details
    const subject = `Schleifwerkzeuge für ${firmendaten.werkstoffe} – ${analysis.company}`
    
    // Werkstoff-spezifische Empfehlungen
    let produktempfehlung = ''
    const werkstoffeLower = firmendaten.werkstoffe.toLowerCase()
    
    if (werkstoffeLower.includes('edelstahl') || werkstoffeLower.includes('inox')) {
      produktempfehlung = `\n\nFür Edelstahl-Bearbeitung haben wir speziell <b>Fächerscheiben, Fiberscheiben und INOX-Trennscheiben</b>, die Verfärbungen vermeiden und saubere Oberflächen garantieren. Gerade bei sichtbaren Teilen wie ${firmendaten.werkstucke} ist das entscheidend.`
    } else if (werkstoffeLower.includes('aluminium') || werkstoffeLower.includes('alu')) {
      produktempfehlung = `\n\nFür Aluminium haben wir <b>Anti-Clog-Scheiben und spezielle Alu-Trennscheiben</b>, die nicht zusetzen und sehr saubere Schnitte ermöglichen. Das spart Zeit und Material.`
    } else {
      produktempfehlung = `\n\nJe nach Material - ob Edelstahl, Aluminium oder Stahl - haben wir die passenden Werkzeuge für <b>Schnitt, Schliff und Finish</b>. Von der groben Bearbeitung bis zur Hochglanzpolitur.`
    }
    
    const body = `${anrede},

ich bin auf Ihre Firma ${analysis.company} gestoßen und habe gesehen, dass Sie im Bereich ${firmendaten.anwendungen} tätig sind und mit ${firmendaten.werkstoffe} arbeiten${firmendaten.werkstucke !== 'Metallprodukte' ? `, besonders bei ${firmendaten.werkstucke}` : ''}.

Wir bei Score Schleifwerkzeuge arbeiten mit <b>allen führenden Herstellern</b> (Klingspor, 3M, Norton, Saint-Gobain) zusammen und können dadurch Ihren <b>kompletten Jahresbedarf</b> an Schleifmitteln und Trennwerkzeugen optimal abdecken.${produktempfehlung}

<b>Was wir Ihnen bieten:</b>
• Staffelpreise und Rahmenverträge für planbare Kosten
• Sehr schnelle Lieferung deutschlandweit (oft nächster Tag)
• Persönliche Beratung für die richtige Werkzeugauswahl
• Alle gängigen Marken aus einer Hand

Wenn Sie möchten, schaue ich mir Ihren aktuellen Bedarf an und erstelle ein individuelles Angebot - abgestimmt auf Ihre Werkstoffe und Anwendungen.

<b>Einfach melden:</b>
📞 Anrufen: <a href="tel:+4922125999901">0221-25999901</a> (Mo-Fr 10-18 Uhr)
📧 Oder auf diese Mail antworten

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
  
  const mainMat = analysis.materials.length > 0 ? analysis.materials[0].term : 'Ihre Fertigung'
  
  const subject = `Nochmal wegen Schleifwerkzeuge – ${analysis.company}`
  
  const body = `${anrede},

vor ein paar Tagen hatte ich Ihnen geschrieben wegen Schleifwerkzeuge für ${mainMat}.

Falls es passt: Wir bieten <b>Rahmenverträge für den Jahresbedarf</b> mit Staffelpreisen. Spart Zeit beim Einkauf und bringt bessere Konditionen.

<b>Interesse?</b>
📞 Einfach anrufen: <a href="tel:+4922125999901">0221-25999901</a> (10-18 Uhr)
📧 Oder auf diese Mail antworten

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

/**
 * Mail 3 - Follow-up 2 (HTML)
 */
function generateMail3(
  analysis: AnalyzerV3Result,
  anrede: string
): { subject: string; body: string; word_count: number } {
  
  const subject = `Kurzer Anruf?`
  
  const body = `${anrede},

ich möchte nicht nerven - vielleicht passt es gerade nicht.

<b>Falls doch:</b> Darf ich kurz (10 Min) anrufen? Z.B. <b>Donnerstag 14 Uhr</b> oder <b>Freitag 10 Uhr</b>?

📞 <a href="tel:+4922125999901">0221-25999901</a>

Kurze Info reicht. Danke!

Viele Grüße
<b>Daniel Leismann</b>
Score Schleifwerkzeuge`
  
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
