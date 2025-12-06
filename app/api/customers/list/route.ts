export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../app/lib/api'

/**
 * GET /api/customers/list
 * NEUE PARALLELE API für Kunden-Tab
 * Berührt NICHT die bestehende Kaltakquise-API!
 * 
 * Query-Parameter:
 * - filter: b2b | b2c | all (default: all)
 * - channel: shop | direktvertrieb | amazon | ebay | otto | all (default: all)
 * - limit: number (default: 100)
 * - skip: number (default: 0)
 * - sort: revenue | orders | last_order (default: revenue)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get('filter') || 'all'
    const channel = searchParams.get('channel') || 'all'
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = parseInt(searchParams.get('skip') || '0')
    const sort = searchParams.get('sort') || 'revenue'
    
    console.log(`[Customers List] Loading customers: filter=${filter}, channel=${channel}, limit=${limit}`)
    
    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')
    
    // Query zusammenstellen
    const query: any = {
      customer_source: { $exists: true }, // Nur echte Kunden (JTL oder Coldlead)
      status: 'customer' // Nur Status "customer"
    }
    
    // B2B/B2C Filter
    if (filter === 'b2b') {
      query.is_b2b = true
    } else if (filter === 'b2c') {
      query.is_b2b = { $ne: true }
    }
    
    // Kanal-Filter
    if (channel !== 'all') {
      query.primary_channel = channel
    }
    
    // Sortierung
    let sortField: any = { 'stats.total_revenue': -1 } // Default: nach Umsatz
    if (sort === 'orders') {
      sortField = { 'stats.total_orders': -1 }
    } else if (sort === 'last_order') {
      sortField = { 'stats.last_order': -1 }
    }
    
    // Lade Kunden
    const customers = await collection
      .find(query)
      .sort(sortField)
      .skip(skip)
      .limit(limit)
      .toArray()
    
    // Zähle Gesamt
    const total = await collection.countDocuments(query)
    
    // Statistiken für Filter
    const statsQuery = { customer_source: { $exists: true }, status: 'customer' }
    const b2bCount = await collection.countDocuments({ ...statsQuery, is_b2b: true })
    const b2cCount = await collection.countDocuments({ ...statsQuery, is_b2b: { $ne: true } })
    
    // Kanal-Counts
    const channelCounts = await collection.aggregate([
      { $match: statsQuery },
      { $group: { _id: '$primary_channel', count: { $sum: 1 } } }
    ]).toArray()
    
    const channelStats = channelCounts.reduce((acc, item) => {
      acc[item._id || 'unknown'] = item.count
      return acc
    }, {} as Record<string, number>)
    
    console.log(`[Customers List] ✅ Loaded ${customers.length}/${total} customers`)
    
    return NextResponse.json({
      ok: true,
      customers: customers.map(c => ({
        _id: c._id,
        kKunde: c.jtl_customer?.kKunde,
        company_name: c.company_name,
        website: c.website,
        email: c.email,
        
        // JTL-Kontakt
        jtl_customer: {
          vorname: c.jtl_customer?.vorname,
          nachname: c.jtl_customer?.nachname,
          strasse: c.jtl_customer?.strasse,
          plz: c.jtl_customer?.plz,
          ort: c.jtl_customer?.ort,
          telefon: c.jtl_customer?.telefon,
          email: c.jtl_customer?.email
        },
        
        // B2B
        is_b2b: c.is_b2b || false,
        b2b_confidence: c.b2b_confidence || 0,
        
        // Kanal
        primary_channel: c.primary_channel || 'unknown',
        last_order_channel: c.last_order_channel || c.primary_channel || 'unknown',
        channels: c.channels || [],
        
        // Hauptartikel
        hauptartikel: c.hauptartikel || null,
        
        // Stats
        total_orders: c.stats?.total_orders || 0,
        total_revenue: c.stats?.total_revenue || 0,
        avg_order_value: c.stats?.avg_order_value || 0,
        last_order: c.stats?.last_order,
        order_frequency: c.stats?.order_frequency || 0,
        
        // Warmakquise (falls vorhanden)
        warm_aquise_score: c.warm_aquise_score || null,
        
        // Quelle
        customer_source: c.customer_source,
        
        // Timestamps
        last_jtl_sync: c.last_jtl_sync,
        updated_at: c.updated_at
      })),
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + customers.length < total
      },
      filters: {
        b2b: b2bCount,
        b2c: b2cCount,
        channels: channelStats
      }
    })
    
  } catch (error: any) {
    console.error('[Customers List] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Fehler beim Laden der Kunden'
    }, { status: 500 })
  }
}
