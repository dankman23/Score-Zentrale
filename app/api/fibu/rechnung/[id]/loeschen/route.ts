export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../../lib/db/mongodb'
import { ObjectId } from 'mongodb'

/**
 * Löscht eine EK-Rechnung komplett
 * DELETE /api/fibu/rechnung/:id/loeschen
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
    }
    
    const db = await getDb()
    
    // Lösche die Rechnung
    const result = await db.collection('fibu_ek_rechnungen').deleteOne({
      _id: new ObjectId(id)
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        error: 'Rechnung nicht gefunden' 
      }, { status: 404 })
    }
    
    console.log(`[Rechnung] Gelöscht: ${id}`)
    
    return NextResponse.json({
      ok: true,
      message: 'Rechnung wurde gelöscht'
    })
    
  } catch (error: any) {
    console.error('[Rechnung] Fehler beim Löschen:', error)
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
