export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'

/**
 * GET /api/coldleads/prompts
 * Liefert alle E-Mail-Prompts mit Statistiken
 */
export async function GET() {
  try {
    const db = await connectToMongoDB()
    const promptsCollection = db.collection('email_prompts')
    const prospectsCollection = db.collection('prospects')
    
    // Hole alle Prompts
    const prompts = await promptsCollection.find({}).sort({ version: 1 }).toArray()
    
    // Berechne Statistiken für jeden Prompt
    const promptsWithStats = await Promise.all(prompts.map(async (prompt) => {
      // Zähle versendete E-Mails mit diesem Prompt
      const versendet = await prospectsCollection.countDocuments({
        'email_sequence.mail_1.prompt_version': prompt.version
      })
      
      // Zähle Antworten (hasReply = true)
      const antworten = await prospectsCollection.countDocuments({
        'email_sequence.mail_1.prompt_version': prompt.version,
        hasReply: true
      })
      
      // Berechne Conversion Rate
      const conversionRate = versendet > 0 ? ((antworten / versendet) * 100).toFixed(2) : '0.00'
      
      return {
        _id: prompt._id.toString(),
        version: prompt.version,
        name: prompt.name,
        model: prompt.model,
        prompt: prompt.prompt,
        active: prompt.active,
        created_at: prompt.created_at,
        updated_at: prompt.updated_at,
        stats: {
          versendet,
          antworten,
          conversionRate: parseFloat(conversionRate)
        }
      }
    }))
    
    return NextResponse.json({
      ok: true,
      prompts: promptsWithStats
    })
    
  } catch (error: any) {
    console.error('[Prompts API] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST /api/coldleads/prompts
 * Erstellt einen neuen Prompt oder aktiviert einen bestehenden
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, version, name, model, prompt } = body
    
    const db = await connectToMongoDB()
    const promptsCollection = db.collection('email_prompts')
    
    if (action === 'activate') {
      // Deaktiviere alle anderen Prompts
      await promptsCollection.updateMany({}, { $set: { active: false } })
      
      // Aktiviere den gewählten Prompt
      await promptsCollection.updateOne(
        { version },
        { $set: { active: true, updated_at: new Date() } }
      )
      
      return NextResponse.json({
        ok: true,
        message: `Prompt ${version} aktiviert`
      })
    }
    
    if (action === 'create') {
      // Hole die höchste Version-Nummer
      const lastPrompt = await promptsCollection.find({}).sort({ version: -1 }).limit(1).toArray()
      const nextVersion = lastPrompt.length > 0 ? lastPrompt[0].version + 1 : 1
      
      // Erstelle neuen Prompt
      const newPrompt = {
        version: nextVersion,
        name: name || `Prompt ${nextVersion}`,
        model: model || 'gpt-4o-mini',
        prompt,
        active: false,
        created_at: new Date(),
        updated_at: new Date()
      }
      
      await promptsCollection.insertOne(newPrompt)
      
      return NextResponse.json({
        ok: true,
        message: 'Neuer Prompt erstellt',
        version: nextVersion
      })
    }
    
    return NextResponse.json({
      ok: false,
      error: 'Ungültige Action'
    }, { status: 400 })
    
  } catch (error: any) {
    console.error('[Prompts API] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * PUT /api/coldleads/prompts
 * Aktualisiert einen bestehenden Prompt
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { version, name, model, prompt } = body
    
    const db = await connectToMongoDB()
    const promptsCollection = db.collection('email_prompts')
    
    await promptsCollection.updateOne(
      { version },
      { 
        $set: { 
          name,
          model,
          prompt,
          updated_at: new Date()
        } 
      }
    )
    
    return NextResponse.json({
      ok: true,
      message: 'Prompt aktualisiert'
    })
    
  } catch (error: any) {
    console.error('[Prompts API] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
