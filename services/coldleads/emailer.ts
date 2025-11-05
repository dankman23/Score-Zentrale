/**
 * Kaltakquise - Phase 3: Email-Generator & Versand
 */

import OpenAI from 'openai'
import nodemailer from 'nodemailer'

interface EmailGenerationOptions {
  company_name: string
  contact_person?: string
  industry: string
  analysis: {
    products: string[]
    needs: string[]
    reasoning: string
  }
}

interface GeneratedEmail {
  subject: string
  body: string
  personalization_score: number
}

/**
 * Generiert personalisierte Kaltakquise-Email mit OpenAI
 */
export async function generateEmail(options: EmailGenerationOptions): Promise<GeneratedEmail> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nicht konfiguriert')
  }

  const openai = new OpenAI({ apiKey })

  const prompt = `
Du bist ein erfahrener B2B-Sales-Texter für SCORE Schleifwerkzeuge.

**Über uns:**
SCORE Schleifwerkzeuge ist ein führender Anbieter von professionellen Schleif- und Trennwerkzeugen für industrielle Anwendungen. 
Unser Portfolio umfasst:
- Schleifbänder (für Edelstahl, Stahl, Holz, NE-Metalle)
- Fiberscheiben & Fächerscheiben
- Trennscheiben & Schruppscheiben
- Spezialprodukte für verschiedene Branchen

**Zielkunde:**
- Firma: ${options.company_name}
- Branche: ${options.industry}
${options.contact_person ? `- Ansprechpartner: ${options.contact_person}` : ''}
- Potenzielle Bedarfe: ${options.analysis.needs.join(', ')}
- Warum relevant: ${options.analysis.reasoning}

**Aufgabe:**
Erstelle eine professionelle, aber nicht zu förmliche B2B-Erstkontakt-Email.

**Anforderungen:**
- Länge: 150-200 Wörter
- Tonalität: Professionell, aber persönlich
- Betreff: Prägnant und wertorientiert
- Inhalt:
  1. Kurze persönliche Ansprache (${options.contact_person ? 'mit Namen' : 'allgemein'})
  2. Konkrete Verbindung zu deren Branche/Bedarf
  3. Unser Mehrwert (spezifisch für deren Anwendung)
  4. Klarer Call-to-Action (Telefonat/Meeting anbieten)
  5. Freundlicher Abschluss
- KEINE generischen Phrasen
- KEINE übertriebenen Versprechen
- Fokus auf konkreten Nutzen

**Output-Format:**
{
  "subject": "Betreff hier",
  "body": "Email-Text hier (mit Absätzen)",
  "personalization_score": 0-100
}
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Du bist ein präziser B2B-Email-Texter. Antworte nur mit validem JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 600
  })

  const content = response.choices[0].message.content || '{}'
  
  try {
    const result = JSON.parse(content)
    return {
      subject: result.subject || 'Anfrage zu Schleifwerkzeugen',
      body: result.body || '',
      personalization_score: result.personalization_score || 50
    }
  } catch (error) {
    throw new Error('Email-Generierung fehlgeschlagen: Ungültiges JSON-Format')
  }
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

/**
 * Email-Template für Branche anpassen
 */
export function getIndustryTemplate(industry: string): string {
  const templates: Record<string, string> = {
    'metallbau': `
Wir sind spezialisiert auf Schleifmittel für Metallverarbeitung:
- Schweißnahtbearbeitung
- Oberflächenvorbereitung
- Entgraten und Finishing
`,
    'holzbearbeitung': `
Unser Sortiment für Holzverarbeitung umfasst:
- Schleifbänder für Breitbandschleifer
- Schleifpapiere für Handmaschinen
- Spezial-Körnung für verschiedene Holzarten
`,
    'edelstahl': `
Für Edelstahl-Verarbeitung bieten wir:
- Keramik-Schleifmittel für längere Standzeit
- Spezial-Vlies für Finish-Arbeiten
- Anlauffarben-Entfernung
`
  }

  const industryLower = industry.toLowerCase()
  for (const [key, template] of Object.entries(templates)) {
    if (industryLower.includes(key)) {
      return template
    }
  }

  return 'Unsere Schleifwerkzeuge für Ihre spezifische Anwendung.'
}
