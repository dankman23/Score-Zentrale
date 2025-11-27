export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../../lib/db/mongodb'

/**
 * GET /api/amazon/bulletpoints/artikel/[kArtikel]
 * Liefert gespeicherte Bulletpoints für einen Artikel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { kArtikel: string } }
) {
  try {
    const kArtikel = parseInt(params.kArtikel)
    
    const db = await getDb()
    
    // Versuche zuerst die Batch-Collection (neuer Ort)
    let collection = db.collection('amazon_bulletpoints_generated')
    let doc = await collection.findOne({ kArtikel })
    
    // Fallback auf alte Collection
    if (!doc) {
      collection = db.collection('amazon_bulletpoints')
      doc = await collection.findOne({ kArtikel })
    }
    
    if (!doc) {
      return NextResponse.json({
        ok: true,
        bulletpoints: null
      })
    }
    
    return NextResponse.json({
      ok: true,
      bulletpoints: {
        bulletpoints: doc.bulletpoints,
        bullets: doc.bullets,
        promptVersion: doc.promptVersion || doc.promptName,
        generatedAt: doc.generatedAt
      }
    })
    
  } catch (error: any) {
    console.error('[Bulletpoints Artikel] Error:', error)
    
    // Detaillierte Error Message
    let errorMessage = error.message || 'Unbekannter Fehler'
    
    if (error.message?.includes('not authorized')) {
      errorMessage = 'MongoDB Zugriffsfehler: Keine Berechtigung. Bitte MongoDB-Konfiguration prüfen.'
    } else if (error.message?.includes('MONGO_URL')) {
      errorMessage = 'MongoDB nicht konfiguriert.'
    }
    
    return NextResponse.json({
      ok: false,
      bulletpoints: null,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

/**
 * POST /api/amazon/bulletpoints/artikel/[kArtikel]
 * Speichert Bulletpoints für einen Artikel
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { kArtikel: string } }
) {
  try {
    const kArtikel = parseInt(params.kArtikel)
    const body = await request.json()
    const { bulletpoints, promptVersion } = body
    
    const db = await getDb()
    const collection = db.collection('amazon_bulletpoints')
    
    // Upsert
    await collection.updateOne(
      { kArtikel },
      {
        $set: {
          kArtikel,
          bulletpoints,
          promptVersion,
          generatedAt: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    )
    
    return NextResponse.json({
      ok: true,
      message: 'Bulletpoints gespeichert'
    })
    
  } catch (error: any) {
    console.error('[Bulletpoints Artikel] Error:', error)
    
    // Detaillierte Error Message
    let errorMessage = error.message || 'Unbekannter Fehler'
    
    if (error.message?.includes('not authorized')) {
      errorMessage = 'MongoDB Zugriffsfehler: Keine Berechtigung. Bitte MongoDB-Konfiguration prüfen.'
    } else if (error.message?.includes('MONGO_URL')) {
      errorMessage = 'MongoDB nicht konfiguriert.'
    }
    
    return NextResponse.json({
      ok: false,
      bulletpoints: null,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
