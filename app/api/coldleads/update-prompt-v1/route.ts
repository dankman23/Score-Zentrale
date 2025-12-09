export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../lib/mongodb'

/**
 * POST /api/coldleads/update-prompt-v1
 * Update Prompt v1 mit neuer E-Mail-Adresse und klickbarem Link
 */
export async function POST() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('email_prompts')
    
    console.log('[Update] Suche Prompt v1...')
    
    const promptV1 = await collection.findOne({ active: true })
    
    if (!promptV1) {
      return NextResponse.json({
        ok: false,
        error: 'Prompt v1 nicht gefunden'
      }, { status: 404 })
    }
    
    console.log('[Update] Prompt v1 gefunden, aktualisiere...')
    
    let updatedPrompt = promptV1.prompt
    
    // 1. Update leismann@ → daniel@
    updatedPrompt = updatedPrompt.replace(/leismann@score-schleifwerkzeuge\.de/g, 'daniel@score-schleifwerkzeuge.de')
    
    // 2. Update Link zu klickbarem Format
    // Finde Plain-Text Link und ersetze mit HTML
    updatedPrompt = updatedPrompt.replace(
      /Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter:\s*https:\/\/score-schleifwerkzeuge\.de\/business"/g,
      `Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: <a href='https://score-schleifwerkzeuge.de/business'>https://score-schleifwerkzeuge.de/business</a>"`
    )
    
    // 3. Update Formatierung zu HTML-Tags mit Absatz
    updatedPrompt = updatedPrompt.replace(
      /Viele Grüße\n\*\*Daniel Leismann\*\*\nScore Schleifwerkzeuge/g,
      `Viele Grüße\nDaniel Leismann\n\nScore Schleifwerkzeuge`
    )
    
    // Update in DB
    await collection.updateOne(
      { active: true },
      {
        $set: {
          prompt: updatedPrompt,
          updated_at: new Date()
        }
      }
    )
    
    console.log('[Update] Prompt v1 aktualisiert!')
    
    return NextResponse.json({
      ok: true,
      message: 'Prompt v1 erfolgreich aktualisiert',
      changes: {
        email_updated: updatedPrompt.includes('daniel@score'),
        link_clickable: updatedPrompt.includes('<a href='),
        formatting_updated: updatedPrompt.includes('Daniel Leismann\n\nScore')
      }
    })
    
  } catch (error: any) {
    console.error('[Update] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
