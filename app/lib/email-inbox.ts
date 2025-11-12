/**
 * FIBU Email Inbox Service
 * Prüft IMAP-Postfach auf neue Rechnungen und extrahiert PDF-Anhänge
 */

import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { getDb } from './db/mongodb'

interface EmailConfig {
  user: string
  password: string
  host: string
  port: number
  tls: boolean
  tlsOptions?: {
    rejectUnauthorized: boolean
  }
}

interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
  size: number
}

interface ProcessedEmail {
  messageId: string
  from: string
  subject: string
  date: Date
  textBody: string
  htmlBody: string
  attachments: EmailAttachment[]
}

/**
 * Verbindet zu IMAP und holt ungelesene E-Mails
 */
export async function fetchUnreadEmails(): Promise<ProcessedEmail[]> {
  return new Promise((resolve, reject) => {
    const config: EmailConfig = {
      user: process.env.FIBU_IMAP_USER || '',
      password: process.env.FIBU_IMAP_PASSWORD || '',
      host: process.env.FIBU_IMAP_HOST || '',
      port: parseInt(process.env.FIBU_IMAP_PORT || '993'),
      tls: process.env.FIBU_IMAP_SECURE === 'true',
      tlsOptions: {
        rejectUnauthorized: false
      }
    }

    if (!config.user || !config.password || !config.host) {
      reject(new Error('IMAP configuration missing'))
      return
    }

    const imap = new Imap(config)
    const emails: ProcessedEmail[] = []

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err)
          return
        }

        // Suche E-Mails der letzten 30 Tage (gelesen + ungelesen)
        const since = new Date()
        since.setDate(since.getDate() - 30)
        const sinceStr = since.toISOString().split('T')[0].replace(/-/g, '')
        
        imap.search(['SINCE', sinceStr], (err, results) => {
          if (err) {
            reject(err)
            return
          }

          if (!results || results.length === 0) {
            console.log('[FIBU Email] Keine neuen E-Mails')
            imap.end()
            resolve([])
            return
          }

          console.log(`[FIBU Email] ${results.length} neue E-Mail(s) gefunden`)

          const fetch = imap.fetch(results, { bodies: '', markSeen: true })
          let processed = 0

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  console.error('[FIBU Email] Parse error:', err)
                  return
                }

                // Nur E-Mails mit PDF-Anhängen
                const pdfAttachments = parsed.attachments?.filter(
                  a => a.contentType.includes('pdf')
                ) || []

                if (pdfAttachments.length > 0) {
                  emails.push({
                    messageId: parsed.messageId || `msg-${Date.now()}-${seqno}`,
                    from: parsed.from?.text || 'unknown',
                    subject: parsed.subject || 'No subject',
                    date: parsed.date || new Date(),
                    textBody: parsed.text || '',
                    htmlBody: parsed.html || '',
                    attachments: pdfAttachments.map(a => ({
                      filename: a.filename || 'document.pdf',
                      content: a.content,
                      contentType: a.contentType,
                      size: a.size
                    }))
                  })

                  console.log(`[FIBU Email] E-Mail von ${parsed.from?.text} mit ${pdfAttachments.length} PDF(s)`)
                  if (parsed.text) {
                    console.log(`[FIBU Email] E-Mail-Text (erste 100 Zeichen): ${parsed.text.substring(0, 100)}...`)
                  }
                }

                processed++
                if (processed === results.length) {
                  imap.end()
                }
              })
            })
          })

          fetch.once('end', () => {
            console.log('[FIBU Email] Fetch abgeschlossen')
          })

          fetch.once('error', (err) => {
            console.error('[FIBU Email] Fetch error:', err)
            reject(err)
          })
        })
      })
    })

    imap.once('error', (err) => {
      console.error('[FIBU Email] IMAP error:', err)
      reject(err)
    })

    imap.once('end', () => {
      console.log('[FIBU Email] Verbindung geschlossen')
      resolve(emails)
    })

    imap.connect()
  })
}

/**
 * Verarbeitet E-Mails und speichert Anhänge in MongoDB
 */
export async function processEmailInbox(): Promise<{
  processed: number
  pdfs: number
  errors: number
}> {
  try {
    const emails = await fetchUnreadEmails()
    
    if (emails.length === 0) {
      return { processed: 0, pdfs: 0, errors: 0 }
    }

    const db = await getDb()
    const collection = db.collection('fibu_email_inbox')

    let pdfCount = 0
    let errorCount = 0

    for (const email of emails) {
      try {
        for (const attachment of email.attachments) {
          // Speichere PDF-Anhang
          const doc = {
            emailFrom: email.from,
            emailSubject: email.subject,
            emailDate: email.date,
            emailMessageId: email.messageId,
            emailTextBody: email.textBody,
            emailHtmlBody: email.htmlBody,
            filename: attachment.filename,
            pdfBase64: attachment.content.toString('base64'),
            fileSize: attachment.size,
            status: 'pending', // pending, processed, error
            createdAt: new Date(),
            processedAt: null,
            rechnungId: null
          }

          await collection.insertOne(doc)
          pdfCount++

          console.log(`[FIBU Email] PDF gespeichert: ${attachment.filename} von ${email.from}`)
        }
      } catch (error) {
        console.error('[FIBU Email] Error processing email:', error)
        errorCount++
      }
    }

    return {
      processed: emails.length,
      pdfs: pdfCount,
      errors: errorCount
    }
  } catch (error) {
    console.error('[FIBU Email] Process error:', error)
    throw error
  }
}

/**
 * Holt pending E-Mails aus Inbox
 */
export async function getPendingEmails() {
  const db = await getDb()
  const collection = db.collection('fibu_email_inbox')
  
  return await collection.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .toArray()
}
