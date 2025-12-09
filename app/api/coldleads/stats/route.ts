export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../lib/api'

/**
 * GET /api/coldleads/stats
 * Returns statistics for cold leads dashboard widget
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')

    // Count unread replies
    const unreadReplies = await collection.countDocuments({
      hasReply: true,
      replyRead: { $ne: true }
    })

    // Count by status (nur Cold Leads, KEINE JTL-Kunden!)
    const byStatus = await collection.aggregate([
      {
        $match: {
          $or: [
            { customer_source: { $ne: 'jtl' } },
            { customer_source: { $exists: false } }
          ]
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray()

    // Recent replies (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentReplies = await collection.countDocuments({
      hasReply: true,
      lastReplyAt: { $gte: sevenDaysAgo }
    })

    // Awaiting follow-up
    const sixWorkdaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // ~6 business days
    const awaitingFollowup = await collection.countDocuments({
      status: 'contacted',
      last_contact_date: { $lte: sixWorkdaysAgo },
      hasReply: { $ne: true },
      $or: [
        { followup_count: { $exists: false } },
        { followup_count: { $lt: 2 } }
      ]
    })

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item._id || 'unknown'] = item.count
      return acc
    }, {} as Record<string, number>)

    // Zusätzliche Stats: JTL-Kunden vs. Neukunden
    const jtlCustomersCount = await collection.countDocuments({ customer_source: 'jtl' })
    const newCustomersCount = await collection.countDocuments({ customer_source: 'coldlead', status: 'customer' })

    return NextResponse.json({
      ok: true,
      unreadReplies,
      recentReplies,
      awaitingFollowup,
      byStatus: statusCounts,
      total: byStatus.reduce((sum, item) => sum + item.count, 0),
      // Einzelne Status-Counts für Frontend
      new: statusCounts.new || 0,
      analyzed: statusCounts.analyzed || 0,
      no_email: statusCounts.no_email || 0,
      contacted: statusCounts.contacted || 0,
      qualified: statusCounts.qualified || 0,
      discarded: statusCounts.discarded || 0,
      replied: unreadReplies,
      jtl_customers: jtlCustomersCount,
      new_customers: newCustomersCount
    })
  } catch (error: any) {
    console.error('[ColdLeads Stats] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
