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
  
  const mailOptions = {
    from: `Score Schleifwerkzeuge <${process.env.EMAIL_FROM || 'vertrieb@score-schleifwerkzeuge.de'}>`,
    to,
    bcc: 'leismann@score-schleifwerkzeuge.de, danki.leismann@gmx.de', // Automatische BCC-Kopie an beide Adressen
    subject,
    html: fullHTML,
    text: text || html.replace(/<[^>]*>/g, '')
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
