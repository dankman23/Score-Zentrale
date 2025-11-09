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
 * FALLBACK: Template-basierte Email-Generierung
 */
function generateTemplateEmail(options: EmailGenerationOptions): GeneratedEmail {
  const industryTemplate = getIndustryTemplate(options.industry)
  
  const subject = `Schleifwerkzeuge für ${options.company_name} - Kostenvergleich`
  
  const body = `Sehr geehrte Damen und Herren${options.contact_person ? `, sehr geehrte/r ${options.contact_person}` : ''},

wir haben gesehen, dass Sie in der ${options.industry}-Branche tätig sind und möchten Ihnen gerne unser Schleifwerkzeug-Sortiment vorstellen.

Als erfahrener Partner mit 15 Jahren Expertise im Schleifmittel-Vertrieb haben wir Kontakte zu allen führenden Herstellern (Klingspor, VSM, Starke, 3M, Bosch) und können für jeden Bedarf die optimale Lösung bieten.

${industryTemplate}

Gerne erstellen wir Ihnen ein unverbindliches Vergleichsangebot für Ihren Jahresbedarf oder vereinbaren einen kurzen Beratungstermin.

Kontakt:
- Telefon: 0221-25999901
- E-Mail: berres@score-schleifwerkzeuge.de`

  return {
    subject,
    body,
    personalization_score: 30 // Template hat niedrigere Personalisierung
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
 * Branchen-spezifische Email-Templates
 */
function getIndustryTemplate(industry: string): string {
  const templates: Record<string, string> = {
    'Metallbau': 'Für Metallbau-Betriebe bieten wir speziell: Schleifbänder für Edelstahl (K80-K240), Fächerscheiben für Schweißnahtbearbeitung, und Trennscheiben für präzise Schnitte.',
    'Stahlbau': 'Für Stahlbau benötigen Sie: Robuste Schleifbänder für Stahlbearbeitung, Schruppscheiben für grobe Arbeiten, und Finishing-Produkte für die Oberflächenveredelung.',
    'Schreinerei': 'Für Tischlereien und Schreinereien: Schleifbänder für Holz (K60-K180), Schleifpapier in allen Körnungen, und Spezialprodukte für Möbeloberflächen.',
    'Maschinenbau': 'Für Maschinenbau-Betriebe: Präzisions-Schleifmittel, Fächerscheiben für Bauteile, und Spezialprodukte für verschiedene Materialien.',
    'Lackiererei': 'Für Lackierereien: Schleifprodukte zur Oberflächenvorbereitung, Finishing-Materialien, und Zwischenschliff-Lösungen.',
  }
  
  return templates[industry] || 'Wir bieten ein komplettes Sortiment an Schleifbändern, Fächerscheiben, Trennscheiben und Spezialprodukten für Ihre Branche.'
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
