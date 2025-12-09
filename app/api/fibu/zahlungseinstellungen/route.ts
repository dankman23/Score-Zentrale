import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Lade Zahlungseinstellungen
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const collection = db.collection('fibu_zahlungseinstellungen')
    
    const settings = await collection.find({}).toArray()
    
    return NextResponse.json({
      ok: true,
      settings: settings.length > 0 ? settings : []
    })
  } catch (error: any) {
    console.error('Fehler beim Laden der Zahlungseinstellungen:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Speichere Zahlungseinstellungen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings } = body
    
    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json(
        { ok: false, error: 'Ungültige Daten' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const collection = db.collection('fibu_zahlungseinstellungen')
    
    // Lösche alte Einstellungen
    await collection.deleteMany({})
    
    // Speichere neue Einstellungen
    if (settings.length > 0) {
      await collection.insertMany(
        settings.map(s => ({
          ...s,
          updated_at: new Date()
        }))
      )
    }
    
    return NextResponse.json({
      ok: true,
      message: 'Einstellungen gespeichert',
      count: settings.length
    })
  } catch (error: any) {
    console.error('Fehler beim Speichern der Zahlungseinstellungen:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
