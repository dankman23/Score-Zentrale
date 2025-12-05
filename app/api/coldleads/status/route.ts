export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../../lib/mongodb'
import { ObjectId } from 'mongodb'

/**
 * PUT /api/coldleads/status
 * Ändert den Status eines Prospects
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status } = body
    
    if (!id || !status) {
      return NextResponse.json({
        ok: false,
        error: 'ID und Status erforderlich'
      }, { status: 400 })
    }
    
    const validStati = ['new', 'analyzed', 'contacted', 'replied', 'called', 'customer', 'discarded']
    if (!validStati.includes(status)) {
      return NextResponse.json({
        ok: false,
        error: `Ungültiger Status. Erlaubt: ${validStati.join(', ')}`
      }, { status: 400 })
    }
    
    const db = await connectToMongoDB()
    const collection = db.collection('prospects')
    
    // Bei Status "customer": Prüfe ob von Cold-Lead oder JTL
    const updateData: any = { 
      status,
      updated_at: new Date()
    }
    
    // Wenn zu "customer" gewechselt wird und noch kein customer_source gesetzt
    if (status === 'customer') {
      const prospect = await collection.findOne({ _id: new ObjectId(id) })
      
      // Falls noch kein customer_source: Setze auf 'coldlead' (neue Akquise)
      if (!prospect?.customer_source) {
        updateData.customer_source = 'coldlead'
        updateData.converted_at = new Date() // Conversion-Timestamp
        console.log(`[Status Change] Marking as NEW CUSTOMER from cold lead`)
      }
    }
    
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: updateData,
        $push: {
          history: {
            type: 'status_changed',
            date: new Date(),
            from_status: body.oldStatus || 'unknown',
            to_status: status,
            note: body.note || `Status geändert zu ${status}`
          }
        }
      } as any
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Prospect nicht gefunden'
      }, { status: 404 })
    }
    
    console.log(`[Status Change] Prospect ${id} changed to ${status}`)
    
    return NextResponse.json({
      ok: true,
      message: `Status geändert zu: ${status}`
    })
    
  } catch (error: any) {
    console.error('[Status Change] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
