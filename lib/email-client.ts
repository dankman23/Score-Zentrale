import nodemailer from 'nodemailer'

let transporter: any = null

export function getEmailTransporter() {
  // Nicht cachen - immer neu erstellen für korrekte Config
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.agenturserver.de',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // false für Port 587
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  })

  return transporter
}

/**
 * Konvertiert einfache Text-Email mit <b> und <a> Tags in vollständiges HTML
 */
function wrapInHTML(body: string): string {
  // Ersetze Zeilenumbrüche mit <br>
  let html = body.replace(/\n/g, '<br>\n')
  
  // Bereits vorhandene HTML-Tags bleiben
  // Wrap in HTML-Struktur
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    b { font-weight: bold; }
  </style>
</head>
<body>
${html}
</body>
</html>`
}

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const transporter = getEmailTransporter()
  
  // Wrap in vollständiges HTML wenn nötig
  const fullHTML = html.includes('<!DOCTYPE') ? html : wrapInHTML(html)
  
  // TEST MODE: Wenn EMAIL_TEST_MODE aktiviert ist, sende ALLE Mails nur an BCC
  const testMode = process.env.EMAIL_TEST_MODE === 'true'
  
  const mailOptions: any = {
    from: `Score Schleifwerkzeuge <${process.env.EMAIL_FROM || 'vertrieb@score-schleifwerkzeuge.de'}>`,
    bcc: 'leismann@score-schleifwerkzeuge.de, danki.leismann@gmx.de', // Automatische BCC-Kopie an beide Adressen
    subject: testMode ? `[TEST] ${subject}` : subject,
    html: fullHTML,
    text: text || html.replace(/<[^>]*>/g, '')
  }
  
  // Im Test-Modus: Sende NUR an BCC (kein TO)
  // Im Produktiv-Modus: Sende an TO + BCC
  if (testMode) {
    // Füge Hinweis in E-Mail-Body ein
    mailOptions.html = `<div style="background: #fff3cd; border: 2px solid #ffc107; padding: 10px; margin-bottom: 20px;"><strong>🧪 TEST-MODUS:</strong> Diese E-Mail würde normalerweise an <strong>${to}</strong> gesendet.</div>` + mailOptions.html
    console.log(`[Email] TEST MODE: Email würde an ${to} gesendet, geht nur an BCC`)
  } else {
    mailOptions.to = to
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('[Email] Sent:', info.messageId, 'to', to)
    return { ok: true, messageId: info.messageId }
  } catch (error: any) {
    console.error('[Email] Error:', error)
    return { ok: false, error: error.message }
  }
}
