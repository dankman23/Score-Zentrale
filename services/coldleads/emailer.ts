/**
 * Kaltakquise - Phase 3: Email-Generator & Versand
 */

import nodemailer from 'nodemailer'
import { emergentGetJSON } from '@/lib/emergent-llm'

interface EmailGenerationOptions {
  company_name: string
  contact_person?: string
  contact_department?: string
  industry: string
  analysis: {
    detected_applications: Array<{
      name: string
      description: string
    }>
    potential_products: Array<{
      name: string
      category: string
      reason: string
      grain_sizes?: string[]
    }>
    target_materials: string[]
    estimated_volume: 'low' | 'medium' | 'high'
    reasoning: string
    score: number
  }
}

interface GeneratedEmail {
  subject: string
  body: string
  personalization_score: number
}

/**
 * Intelligente, datenbasierte Email-Generierung
 */
function generateTemplateEmail(options: EmailGenerationOptions): GeneratedEmail {
  const { company_name, contact_person, contact_department, analysis, industry } = options
  
  // 1. Ansprache generieren - MIT NAMEN wenn vorhanden
  let greeting = 'Sehr geehrte Damen und Herren'
  if (contact_person && contact_person !== 'Kontakt' && contact_person !== 'Allgemein') {
    // Wenn wir einen echten Namen haben
    if (contact_person.includes(' ')) {
      // Vollständiger Name: "Max Mustermann" → "Sehr geehrter Herr Mustermann"
      const lastName = contact_person.split(' ').pop()
      greeting = `Sehr geehrte Damen und Herren, sehr geehrter Herr ${lastName}, sehr geehrte Frau ${lastName}`
    } else {
      // Nur Abteilung/Rolle
      greeting = `Sehr geehrte Damen und Herren`
    }
  } else if (contact_department && (contact_department === 'Einkauf' || contact_department === 'Beschaffung')) {
    greeting = `Sehr geehrte Damen und Herren der ${contact_department}sabteilung`
  }
  
  // 2. Betreff mit konkreter Anwendung oder Firmenbezug
  const mainApplication = analysis.detected_applications[0]?.name
  const subject = mainApplication 
    ? `Hochwertige Schleifwerkzeuge für ${mainApplication} – Angebot für ${company_name}`
    : `Schleifwerkzeuge-Lieferant für ${company_name}`
  
  // 3. PERSÖNLICHER SATZ ZUR FIRMA
  let personalOpening = ''
  const companyInfo = (options as any).company_info
  
  if (companyInfo?.main_activity && companyInfo?.products && companyInfo.products.length > 0) {
    // Beste Variante: Spezifische Produkte bekannt
    const mainProduct = companyInfo.products[0]
    personalOpening = `Ich habe gesehen, dass Sie als ${companyInfo.main_activity} im Bereich ${mainProduct} tätig sind`
  } else if (companyInfo?.main_activity) {
    // Gute Variante: Geschäftstyp bekannt
    personalOpening = `Ich habe gesehen, dass Sie als ${companyInfo.main_activity} tätig sind`
  } else if (analysis.detected_applications.length > 0) {
    // Fallback: Anwendungen erkannt
    const apps = analysis.detected_applications.slice(0, 2).map(a => a.name).join(' und ')
    personalOpening = `Ich bin auf Sie aufmerksam geworden, da Sie sich auf ${apps} spezialisieren`
  } else {
    // Minimaler Fallback
    personalOpening = `Ich bin auf Ihr Unternehmen im Bereich ${industry} aufmerksam geworden`
  }
  
  // 4. Einleitung mit persönlichem Bezug
  let intro = `ich bin Daniel Leismann von Score Schleifwerkzeuge aus Köln.\n\n`
  intro += `${personalOpening} – genau die Bereiche, in denen unsere hochwertigen Schleifwerkzeuge Ihre Prozesse optimal unterstützen können.`
  
  // 4. Premium-Hersteller erwähnen (inkl. PFERD bei Herstellern!)
  const isManufacturer = companyInfo?.business_type === 'manufacturer' || companyInfo?.business_type === 'mixed'
  const categories = new Set<string>()
  analysis.potential_products.forEach(p => {
    if (p.category) categories.add(p.category)
  })
  const categoryList = Array.from(categories).slice(0, 3).join(', ')
  
  let premiumIntro = '\n\n**Unsere Premium-Hersteller**'
  if (isManufacturer) {
    // Bei Herstellern auch Pferd erwähnen
    premiumIntro += `\nWir arbeiten ausschließlich mit den führenden Herstellern zusammen: **Klingspor, 3M, Norton, VSM, Pferd, Starcke und Bosch**. Durch unsere langjährigen und exzellenten Beziehungen zu diesen Herstellern können wir Ihnen optimale Konditionen und schnellste Verfügbarkeit garantieren.`
  } else {
    premiumIntro += `\nWir arbeiten mit den führenden Premium-Herstellern wie **Klingspor, 3M, Norton, VSM und Starcke** zusammen und garantieren Ihnen optimale Konditionen und schnellste Verfügbarkeit.`
  }
  
  // 5. KEINE detaillierte Produktliste! Nur kurzer Satz
  let productSection = ''
  if (categories.size > 0) {
    const catList = Array.from(categories).slice(0, 4).join(', ')
    productSection = `\n\n**Ihre Produktbereiche**\nBasierend auf Ihre Anforderungen können wir Sie insbesondere in folgenden Bereichen unterstützen: ${catList}.\n\nGerne erstellen wir Ihnen ein maßgeschneidertes Angebot, das exakt auf Ihre Bedürfnisse zugeschnitten ist.`
  } else {
    productSection = `\n\nGerne erstellen wir Ihnen ein maßgeschneidertes Angebot, das exakt auf Ihre Bedürfnisse zugeschnitten ist.`
  }
  
  // 5. Vorteile von Score Schleifwerkzeuge
  const benefits = `\n\nWarum Score Schleifwerkzeuge?

✓ 15 Jahre Erfahrung im Schleifmittel-Vertrieb
✓ Direkter Zugang zu allen Top-Herstellern (Klingspor, VSM, Starcke, 3M, Bosch, Norton)
✓ Beste Preise durch optimierte Beschaffungswege
✓ Schnelle Lieferung innerhalb von 24-48 Stunden
✓ Persönliche Beratung für Ihre spezifischen Anwendungen`
  
  // 6. Materialien-spezifische Expertise erwähnen
  let materialExpertise = ''
  if (analysis.target_materials.length > 0) {
    const materials = analysis.target_materials.slice(0, 3).join(', ')
    materialExpertise = `\n\nMit unserer langjährigen Erfahrung in der Bearbeitung von ${materials} können wir Sie optimal beraten und Ihnen die passenden Produkte für Ihre Anforderungen liefern.`
  }
  
  // 7. Call-to-Action mit Kontaktoptionen
  let cta = '\n\n**Wie geht es weiter?**\n\n'
  cta += 'Ich würde mich sehr freuen, Sie persönlich kennenzulernen und gemeinsam mit Ihnen die optimalen Schleifwerkzeuge für Ihre Anwendungen zu finden.\n\n'
  cta += '**Kontaktieren Sie mich direkt:**\n'
  cta += '📞 **Telefon:** 0221-25999901\n'
  cta += '📧 **E-Mail:** leismann@score-schleifwerkzeuge.de\n\n'
  cta += 'Alternativ können Sie auch über unser **Business-Portal** eine Anfrage stellen:\n'
  cta += '🔗 https://score-schleifwerkzeuge.de/business'
  
  if (analysis.estimated_volume === 'high') {
    cta += '\n\n💡 **Tipp für größere Mengen:** Wir bieten attraktive Mengenrabatte und können individuelle Rahmenverträge mit Festpreisen vereinbaren.'
  }
  
  // 8. Abschluss & Kontakt
  const closing = `\n\n📞 Telefon: 0221-25999901
📧 E-Mail: leismann@score-schleifwerkzeuge.de
🌐 Website: www.score-schleifwerkzeuge.de

Ich freue mich darauf, Sie kennenzulernen und Sie bei Ihren Projekten zu unterstützen!

Mit freundlichen Grüßen aus Köln

Daniel Leismann
Vertrieb & Kundenberatung
Score Schleifwerkzeuge`
  
  // Zusammenstellung
  const body = `${greeting},

${intro}${premiumIntro}${productSection}${materialExpertise}${cta}${closing}`

  return {
    subject,
    body,
    personalization_score: analysis.detected_applications.length > 0 ? 85 : 60
  }
}
/**
 * Generiert personalisierte Kaltakquise-Email mit OpenAI
 */
export async function generateEmail(options: EmailGenerationOptions): Promise<GeneratedEmail> {
  console.log('[Emailer] Generating email for:', options.company_name)
  
  // FALLBACK: Template-basierte Email (IMMER verfügbar)
  return generateTemplateEmail(options)
}

/**
 * Versendet Email über SMTP
 */
export async function sendEmail(to: string, subject: string, body: string) {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM
  const fromName = process.env.SMTP_FROM_NAME

  if (!host || !user || !pass) {
    throw new Error('SMTP nicht konfiguriert. Bitte SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env setzen.')
  }

  // SMTP-Transporter erstellen
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true für Port 465, false für andere
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false // Für Self-Signed Certificates
    }
  })

  // Email-Optionen mit Reply-To und BCC
  const replyTo = process.env.SMTP_REPLY_TO || from
  const bcc = process.env.SMTP_BCC || process.env.SMTP_REPLY_TO || null // BCC für Tests oder Archivierung
  
  const mailOptions: any = {
    from: `${fromName} <${from}>`,
    to,
    replyTo, // Antworten gehen an keyaccount@score-schleifwerkzeuge.de
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>') // Einfaches HTML
  }
  
  // BCC nur wenn gesetzt
  if (bcc) {
    mailOptions.bcc = bcc
    console.log(`[Emailer] BCC set to: ${bcc}`)
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log(`[Emailer] Email sent: ${info.messageId}`)
    return {
      success: true,
      messageId: info.messageId
    }
  } catch (error: any) {
    console.error('[Emailer] Send error:', error)
    throw new Error(`Email-Versand fehlgeschlagen: ${error.message}`)
  }
}

/**
 * Testet SMTP-Verbindung
 */
export async function testSMTP(): Promise<{ ok: boolean; message: string }> {
  try {
    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '587')
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASSWORD

    if (!host || !user || !pass) {
      return {
        ok: false,
        message: 'SMTP-Credentials fehlen in .env'
      }
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    })

    await transporter.verify()

    return {
      ok: true,
      message: `SMTP-Verbindung erfolgreich: ${host}:${port}`
    }

  } catch (error: any) {
    return {
      ok: false,
      message: `SMTP-Fehler: ${error.message}`
    }
  }
}
