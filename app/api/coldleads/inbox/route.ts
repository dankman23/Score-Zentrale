export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchUnreadEmails } from '@/../lib/imap-client'
import { connectToDatabase } from '@/../lib/api'

/**
 * GET /api/coldleads/inbox
 * Fetches unread emails from IMAP and matches with prospects
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Inbox] Fetching unread emails...')
    
    // Fetch unread emails from IMAP
    const emails = await fetchUnreadEmails()
    console.log(`[Inbox] Found ${emails.length} unread emails`)

    // Connect to MongoDB
    const { db } = await connectToDatabase()
    const collection = db.collection('coldleads')

    // Match emails with prospects
    const matched = []
    for (const email of emails) {
      // Find prospect by email
      const prospect = await collection.findOne({
        'contact.email': email.from
      })

      if (prospect) {
        // Update prospect with reply info
        await collection.updateOne(
          { _id: prospect._id },
          {
            $set: {
              hasReply: true,
              lastReplyAt: email.date,
              status: 'replied'
            },
            $push: {
              history: {
                type: 'reply_received',
                date: email.date,
                subject: email.subject,
                text: email.text.substring(0, 500),
                from: email.from
              }
            }
          }
        )

        matched.push({
          prospectId: prospect.id,
          company: prospect.company,
          email: email.from,
          subject: email.subject,
          date: email.date,
          preview: email.text.substring(0, 200)
        })
      }
    }

    return NextResponse.json({
      ok: true,
      total: emails.length,
      matched: matched.length,
      unmatched: emails.length - matched.length,
      replies: matched
    })
  } catch (error: any) {
    console.error('[Inbox] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
