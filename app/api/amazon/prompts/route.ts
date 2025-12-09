export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

/**
 * GET /api/amazon/prompts
 * Liefert alle Amazon Bulletpoint Prompts
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const collection = db.collection('amazon_bulletpoint_prompts')
    
    const prompts = await collection
      .find({})
      .sort({ version: 1 })
      .toArray()
    
    return NextResponse.json({
      ok: true,
      prompts: prompts.map(p => ({
        version: p.version,
        name: p.name,
        beschreibung: p.beschreibung,
        prompt: p.prompt,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    })
    
  } catch (error: any) {
    console.error('[Prompts] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST /api/amazon/prompts
 * Erstellt, bearbeitet oder aktiviert Prompts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, version, name, beschreibung, prompt } = body
    
    const db = await getDb()
    const collection = db.collection('amazon_bulletpoint_prompts')
    
    if (action === 'create') {
      // Finde höchste Version
      const lastPrompt = await collection
        .find({})
        .sort({ version: -1 })
        .limit(1)
        .toArray()
      
      const newVersion = lastPrompt.length > 0 ? lastPrompt[0].version + 1 : 1
      
      const newPrompt = {
        version: newVersion,
        name: name || `Prompt ${newVersion}`,
        beschreibung: beschreibung || '',
        prompt: prompt,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await collection.insertOne(newPrompt)
      
      return NextResponse.json({
        ok: true,
        message: 'Prompt erstellt',
        version: newVersion
      })
    }
    
    if (action === 'activate') {
      // Deaktiviere alle
      await collection.updateMany({}, { $set: { isActive: false } })
      
      // Aktiviere gewählten
      await collection.updateOne(
        { version: version },
        { $set: { isActive: true, updatedAt: new Date() } }
      )
      
      return NextResponse.json({
        ok: true,
        message: `Prompt ${version} aktiviert`
      })
    }
    
    if (action === 'update') {
      await collection.updateOne(
        { version: version },
        {
          $set: {
            name: name,
            beschreibung: beschreibung,
            prompt: prompt,
            updatedAt: new Date()
          }
        }
      )
      
      return NextResponse.json({
        ok: true,
        message: 'Prompt aktualisiert'
      })
    }
    
    if (action === 'delete') {
      const result = await collection.deleteOne({ version: version })
      
      if (result.deletedCount === 0) {
        return NextResponse.json({
          ok: false,
          error: 'Prompt nicht gefunden'
        }, { status: 404 })
      }
      
      return NextResponse.json({
        ok: true,
        message: 'Prompt gelöscht'
      })
    }
    
    return NextResponse.json({
      ok: false,
      error: 'Unbekannte Aktion'
    }, { status: 400 })
    
  } catch (error: any) {
    console.error('[Prompts] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
