/**
 * Kaltakquise - Phase 3: Email-Generator & Versand
 */

import nodemailer from 'nodemailer'
import { emergentGetJSON } from '../../lib/emergent-llm'

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
  
  // 1. Ansprache generieren
  let greeting = 'Sehr geehrte Damen und Herren'
  if (contact_person) {
    if (contact_department === 'Einkauf' || contact_department === 'Beschaffung') {
      greeting = `Sehr geehrte Damen und Herren der ${contact_department}sabteilung`
    } else if (contact_person !== 'Kontakt' && contact_person !== 'Allgemein') {
      greeting = `Sehr geehrte/r ${contact_person}`
    }
  }
  
  // 2. Betreff mit konkreter Anwendung
  const mainApplication = analysis.detected_applications[0]?.name || industry
  const subject = `Schleifwerkzeuge für ${mainApplication} bei ${company_name}`
  
  // 3. Einleitung basierend auf erkannten Anwendungen
  let intro = `ich bin Daniel Leismann von Score Schleifwerkzeuge aus Köln. `
  
  if (analysis.detected_applications.length > 0) {
    const apps = analysis.detected_applications.slice(0, 2).map(a => a.name).join(' und ')
    intro += `Ich bin auf Sie aufmerksam geworden, da Sie sich auf ${apps} spezialisiert haben – genau die Anwendungen, für die wir die passenden Schleifwerkzeuge anbieten.`
  } else {
    intro += `Ich bin auf Ihr Unternehmen aufmerksam geworden, da Sie im Bereich ${industry} tätig sind – genau die Branche, in der wir unsere Kunden optimal mit hochwertigen Schleifmitteln unterstützen.`
  }
  
  // 4. Spezifische Produktempfehlungen (Top 3-4)
  const topProducts = analysis.potential_products.slice(0, 4)
  let productSection = '\n\nFür Ihre Anwendungen empfehle ich Ihnen insbesondere:\n'
  
  topProducts.forEach(product => {
    productSection += `\n• ${product.name}`
    if (product.grain_sizes && product.grain_sizes.length > 0) {
      productSection += ` (Körnungen: ${product.grain_sizes.join(', ')})`
    }
    productSection += `\n  ${product.reason}`
  })
  
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
  
  // 7. Call-to-Action basierend auf Volumen
  let cta = ''
  if (analysis.estimated_volume === 'high') {
    cta = '\n\nGerne erstelle ich Ihnen ein individuelles Angebot für Ihren Jahresbedarf. Bei größeren Mengen können wir Ihnen besonders attraktive Konditionen anbieten.'
  } else {
    cta = '\n\nGerne erstelle ich Ihnen ein unverbindliches Vergleichsangebot oder stehe für eine persönliche Beratung zur Verfügung.'
  }
  
  // 8. Abschluss & Kontakt
  const closing = `\n\nSie erreichen mich am besten telefonisch oder per E-Mail:

📞 Telefon: 0221-25999901
📧 E-Mail: leismann@score-schleifwerkzeuge.de

Ich freue mich darauf, Sie kennenzulernen und Sie bei Ihren Projekten zu unterstützen.

Mit freundlichen Grüßen aus Köln

Daniel Leismann
Vertrieb & Kundenberatung
Score Schleifwerkzeuge
www.score-schleifwerkzeuge.de`
  
  // Zusammenstellung
  const body = `${greeting},

${intro}${productSection}${benefits}${materialExpertise}${cta}${closing}`

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

  // Email-Optionen
  const mailOptions = {
    from: `${fromName} <${from}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>') // Einfaches HTML
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
