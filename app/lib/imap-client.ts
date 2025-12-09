import Imap from 'imap'
import { simpleParser } from 'mailparser'

interface ImapConfig {
  user: string
  password: string
  host: string
  port: number
  tls: boolean
}

export interface EmailMessage {
  from: string
  to: string
  subject: string
  text: string
  html: string
  date: Date
  messageId: string
  inReplyTo?: string
  references?: string[]
}

export async function fetchUnreadEmails(): Promise<EmailMessage[]> {
  const config: ImapConfig = {
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    host: process.env.IMAP_HOST || 'mail.agenturserver.de',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: process.env.IMAP_SECURE === 'true' || true
  }

  if (!config.user || !config.password) {
    throw new Error('IMAP credentials missing')
  }

  return new Promise((resolve, reject) => {
    const imap = new Imap(config)
    const messages: EmailMessage[] = []

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          imap.end()
          return reject(err)
        }

        // Suche ungelesene Emails
        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          if (!results || results.length === 0) {
            imap.end()
            return resolve([])
          }

          const fetch = imap.fetch(results, { bodies: '' })
          let processed = 0

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  console.error('[IMAP] Parse error:', err)
                  return
                }

                const fromAddress = parsed.from?.value?.[0]?.address || ''
                const toAddress = parsed.to?.value?.[0]?.address || ''

                messages.push({
                  from: fromAddress,
                  to: toAddress,
                  subject: parsed.subject || '',
                  text: parsed.text || '',
                  html: parsed.html || '',
                  date: parsed.date || new Date(),
                  messageId: parsed.messageId || '',
                  inReplyTo: parsed.inReplyTo || undefined,
                  references: parsed.references || []
                })

                processed++
                if (processed === results.length) {
                  imap.end()
                }
              })
            })
          })

          fetch.once('error', (err) => {
            imap.end()
            reject(err)
          })

          fetch.once('end', () => {
            setTimeout(() => {
              if (!imap.state || imap.state === 'disconnected') {
                resolve(messages)
              }
            }, 1000)
          })
        })
      })
    })

    imap.once('error', (err) => {
      reject(err)
    })

    imap.once('end', () => {
      resolve(messages)
    })

    imap.connect()
  })
}

export async function markAsRead(messageId: string): Promise<void> {
  // TODO: Implement mark as read functionality
  console.log('[IMAP] Mark as read:', messageId)
}
