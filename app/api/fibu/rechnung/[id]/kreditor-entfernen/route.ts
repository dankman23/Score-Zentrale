export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'
import { ObjectId } from 'mongodb'

/**
 * Entfernt Kreditor von einer EK-Rechnung
 * Verschiebt Rechnung zurück in die Zuordnung
 * DELETE /api/fibu/rechnung/:id/kreditor-entfernen
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
    
    // Entferne Kreditor (setze auf null)
    const result = await db.collection('fibu_ek_rechnungen').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          kreditorKonto: null,
          updated_at: new Date()
        }
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        error: 'Rechnung nicht gefunden' 
      }, { status: 404 })
    }
    
    console.log(`[Rechnung] Kreditor entfernt von ${id}`)
    
    return NextResponse.json({
      ok: true,
      message: 'Kreditor entfernt - Rechnung ist jetzt in Zuordnung'
    })
    
  } catch (error: any) {
    console.error('[Rechnung] Fehler:', error)
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
