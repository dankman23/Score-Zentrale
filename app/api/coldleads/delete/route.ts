export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'

/**
 * DELETE /api/coldleads/delete
 * Löscht einen Prospect aus der Datenbank
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { prospect_id } = body
    
    if (!prospect_id) {
      return NextResponse.json({
        ok: false,
        error: 'prospect_id required'
      }, { status: 400 })
    }
    
    const db = await connectToMongoDB()
    const prospectsCollection = db.collection('prospects')
    
    const result = await prospectsCollection.deleteOne({ id: prospect_id })
    
    if (result.deletedCount === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Prospect not found'
      }, { status: 404 })
    }
    
    console.log(`[Delete] Prospect deleted: ${prospect_id}`)
    
    return NextResponse.json({
      ok: true,
      message: 'Prospect deleted successfully'
    })
    
  } catch (error: any) {
    console.error('[Delete] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Delete failed'
    }, { status: 500 })
  }
}
