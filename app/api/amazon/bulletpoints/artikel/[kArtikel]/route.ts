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
    const collection = db.collection('amazon_bulletpoints')
    
    const doc = await collection.findOne({ kArtikel })
    
    if (!doc) {
      return NextResponse.json({
        ok: true,
        bulletpoints: null
      })
    }
    
    return NextResponse.json({
      ok: true,
      bulletpoints: doc.bulletpoints,
      promptVersion: doc.promptVersion,
      generatedAt: doc.generatedAt
    })
    
  } catch (error: any) {
    console.error('[Bulletpoints Artikel] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
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
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
