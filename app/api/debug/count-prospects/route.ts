export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    
    // Zähle verschiedene Kategorien
    const total = await prospectsCollection.countDocuments()
    const jtlCustomers = await prospectsCollection.countDocuments({ imported_from_jtl: true })
    const coldLeads = await prospectsCollection.countDocuments({ imported_from_jtl: { $ne: true } })
    const analyzed = await prospectsCollection.countDocuments({ 'analysis_v3.overall_score': { $exists: true } })
    const contacted = await prospectsCollection.countDocuments({ 'email_sequence.emails_sent': { $gt: 0 } })
    
    return NextResponse.json({
      ok: true,
      total,
      jtl_customers: jtlCustomers,
      cold_leads: coldLeads,
      analyzed,
      contacted
    })
    
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
