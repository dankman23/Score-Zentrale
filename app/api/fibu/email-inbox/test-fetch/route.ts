export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
const Imap = require('imap')
const { simpleParser } = require('mailparser')

/**
 * GET /api/fibu/email-inbox/test-fetch
 * Test-Endpunkt zum direkten Email-Abruf und Speichern
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return new Promise<NextResponse>((resolve) => {
    const config = {
      user: process.env.FIBU_IMAP_USER!,
      password: process.env.FIBU_IMAP_PASSWORD!,
      host: process.env.FIBU_IMAP_HOST!,
      port: parseInt(process.env.FIBU_IMAP_PORT || '993'),
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    }

    const imap = new Imap(config)
    const results: any[] = []
    let savedCount = 0

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err: any, box: any) => {
        if (err) {
          resolve(NextResponse.json({ ok: false, error: err.message }))
          return
        }

        imap.search(['ALL'], (err: any, uids: number[]) => {
          if (err || !uids || uids.length === 0) {
            imap.end()
            resolve(NextResponse.json({ ok: true, emails: 0, saved: 0 }))
            return
          }

          const fetch = imap.fetch(uids, { bodies: '', markSeen: false })
          let processed = 0

          fetch.on('message', (msg: any, seqno: number) => {
            msg.on('body', async (stream: any) => {
              try {
                const parsed = await simpleParser(stream)
                
                const pdfAttachments = parsed.attachments?.filter(
                  (a: any) => a.contentType?.includes('pdf')
                ) || []

                if (pdfAttachments.length > 0) {
                  results.push({
                    from: parsed.from?.text,
                    subject: parsed.subject,
                    pdfs: pdfAttachments.length,
                    messageId: parsed.messageId
                  })

                  // Speichere sofort in DB
                  const db = await getDb()
                  const collection = db.collection('fibu_email_inbox')

                  for (const attachment of pdfAttachments) {
                    const existing = await collection.findOne({
                      emailMessageId: parsed.messageId,
                      filename: attachment.filename
                    })

                    if (!existing) {
                      await collection.insertOne({
                        emailFrom: parsed.from?.text || 'unknown',
                        emailSubject: parsed.subject || 'No subject',
                        emailDate: parsed.date || new Date(),
                        emailMessageId: parsed.messageId || `msg-${Date.now()}`,
                        emailTextBody: parsed.text || '',
                        filename: attachment.filename || 'document.pdf',
                        pdfBase64: attachment.content.toString('base64'),
                        fileSize: attachment.size,
                        status: 'pending',
                        createdAt: new Date(),
                        processedAt: null,
                        rechnungId: null
                      })
                      savedCount++
                      console.log(`✅ Gespeichert: ${attachment.filename}`)
                    } else {
                      console.log(`⏭️ Duplikat übersprungen: ${attachment.filename}`)
                    }
                  }
                }
              } catch (e: any) {
                console.error('Parse error:', e.message)
              }

              processed++
              if (processed === uids.length) {
                setTimeout(() => {
                  imap.end()
                }, 1000)
              }
            })
          })

          fetch.once('error', (err: any) => {
            imap.end()
            resolve(NextResponse.json({ ok: false, error: err.message }))
          })
        })
      })
    })

    imap.once('error', (err: any) => {
      resolve(NextResponse.json({ ok: false, error: err.message }))
    })

    imap.once('end', () => {
      resolve(NextResponse.json({
        ok: true,
        emails: results.length,
        saved: savedCount,
        results
      }))
    })

    setTimeout(() => {
      imap.end()
      resolve(NextResponse.json({ ok: false, error: 'Timeout after 90s' }))
    }, 90000)

    imap.connect()
  })
}
