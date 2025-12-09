export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'
import { ObjectId } from 'mongodb'

/**
 * GET: Einzelne EK-Rechnung abrufen
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb()
    const rechnung = await db.collection('fibu_ek_rechnungen').findOne({
      _id: new ObjectId(params.id)
    })
    
    if (!rechnung) {
      return NextResponse.json(
        { ok: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ ok: true, rechnung })
  } catch (error: any) {
    console.error('[EK GET] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT: EK-Rechnung aktualisieren
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const db = await getDb()
    
    // Erlaubte Felder zum Update
    const allowedFields = [
      'kreditorKonto',
      'aufwandskonto',
      'lieferantName',
      'rechnungsNummer',
      'gesamtBetrag',
      'nettoBetrag',
      'steuerBetrag',
      'steuersatz',
      'rechnungsdatum',
      'needsManualReview'
    ]
    
    const updateData: any = {
      updated_at: new Date()
    }
    
    // Nur erlaubte Felder übernehmen
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }
    
    // needsManualReview automatisch auf false setzen wenn Kreditor zugeordnet
    if (body.kreditorKonto) {
      updateData.needsManualReview = false
    }
    
    const result = await db.collection('fibu_ek_rechnungen').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { ok: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }
    
    console.log(`[EK PUT] Updated rechnung ${params.id}:`, Object.keys(updateData))
    
    return NextResponse.json({
      ok: true,
      message: 'Rechnung aktualisiert',
      modified: result.modifiedCount
    })
  } catch (error: any) {
    console.error('[EK PUT] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE: EK-Rechnung löschen
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb()
    const result = await db.collection('fibu_ek_rechnungen').deleteOne({
      _id: new ObjectId(params.id)
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { ok: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      )
    }
    
    console.log(`[EK DELETE] Deleted rechnung ${params.id}`)
    
    return NextResponse.json({
      ok: true,
      message: 'Rechnung gelöscht'
    })
  } catch (error: any) {
    console.error('[EK DELETE] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
