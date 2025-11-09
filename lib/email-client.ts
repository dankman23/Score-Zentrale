import nodemailer from 'nodemailer'

let transporter: any = null

export function getEmailTransporter() {
  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.agenturserver.de',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  })

  return transporter
}

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const transporter = getEmailTransporter()
  
  const mailOptions = {
    from: `Score Schleifwerkzeuge <${process.env.EMAIL_FROM || 'vertrieb@score-schleifwerkzeuge.de'}>`,
    to,
    subject,
    html,
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
