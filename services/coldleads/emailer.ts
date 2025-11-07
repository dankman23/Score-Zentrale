/**
 * Kaltakquise - Phase 3: Email-Generator & Versand
 */

import nodemailer from 'nodemailer'
import { emergentGetJSON } from '../../lib/emergent-llm'

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

  const prompt = `
Du bist ein erfahrener B2B-Sales-Texter für SCORE Schleifwerkzeuge.

**ÜBER SCORE:**
- 15 Jahre Erfahrung im Schleifmittel-Vertrieb
- Kontakte zu ALLEN führenden Herstellern: Klingspor, VSM, Starke, 3M, Bosch und weitere
- Können ALLE Preise mindestens matchen (oft sogar unterbieten)
- Komplettes Sortiment deckt JEDEN Bedarf ab
- Für jedes Oberflächenbearbeitungs-Problem die richtige Lösung

**Portfolio:**
- Schleifbänder (Edelstahl, Stahl, Holz, NE-Metalle, alle Körnungen)
- Fächerscheiben & Fiberscheiben
- Trennscheiben & Schruppscheiben
- Spezialprodukte für verschiedene Branchen

**ZIELKUNDE:**
- Firma: ${options.company_name}
- Branche: ${options.industry}
${options.contact_person ? `- Ansprechpartner: ${options.contact_person}` : ''}
- Spezifische Anwendungen: ${options.analysis.needs.join(', ')}
- Individueller Aufhänger: ${options.analysis.reasoning}

**AUFGABE:**
Schreibe eine INDIVIDUALISIERTE Erstkontakt-Email, die sofort Interesse weckt.

**STRUKTUR:**

**Erste 2 Sätze (KRITISCH):**
- Nutze den individuellen Aufhänger
- Zeige, dass wir uns mit DEREN Firma beschäftigt haben
- Beispiel: "Wir haben gesehen, dass Sie sich auf Edelstahl-Schweißkonstruktionen spezialisiert haben..."
- Wecke sofort Interesse und Relevanz

**Hauptteil:**
1. Kurze Vorstellung SCORE (1-2 Sätze):
   - 15 Jahre Erfahrung
   - Kontakte zu allen relevanten Herstellern
   - Können Preise matchen/unterbieten

2. Konkreter Mehrwert für DEREN Anwendung:
   - Bezug zu deren spezifischen Produkten/Prozessen
   - Welche unserer Produkte lösen DEREN Probleme?

3. **USPs hervorheben:**
   - "Durch unsere Partnerschaften können wir für jeden Bedarf die optimale Lösung bieten"
   - "Wir kennen die Herausforderungen in Ihrer Branche"

**Call-to-Actions (BEIDE einbauen):**
1. **Beratungsgespräch:** "Gerne vereinbaren wir einen kurzen Beratungstermin per Telefon (0221-25999901) oder E-Mail"
2. **Jahresbedarf-Angebot:** "Wenn Sie uns Ihren aktuellen Jahresbedarf mitteilen, erstellen wir Ihnen ein unverbindliches Vergleichsangebot"

**Abschluss:**
- Freundlich und einladend
- Niedrigschwellig (keine Verpflichtung)

**WICHTIG:**
- Länge: 120-160 Wörter (prägnant!)
- Ton: Professionell aber sympathisch
- KEIN Werbe-Blabla
- Fokus: DEREN Nutzen, nicht unsere Features
- INDIVIDUELL: Jede Email muss zeigen, dass wir die Firma kennen

**Output-Format (JSON):**
{
  "subject": "Betreff (max 60 Zeichen, wertorientiert, neugierig machend)",
  "body": "Email-Text hier (mit Absätzen, OHNE Signatur)",
  "personalization_score": 0-100
}
`

  const systemPrompt = 'Du bist ein präziser B2B-Email-Texter. Antworte nur mit validem JSON.'
  
  const result = await emergentGetJSON(systemPrompt, prompt, 2)
  
  try {
    
    // Signatur hinzufügen
    const signature = `

Mit freundlichen Grüßen

Christian Berres
Score Handels GmbH & Co. KG

Telefon: 0221-25999901
E-Mail: berres@score-schleifwerkzeuge.de
Web: www.score-schleifwerkzeuge.de`
    
    return {
      subject: result.subject || 'Anfrage zu Schleifwerkzeugen',
      body: (result.body || '') + signature,
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
