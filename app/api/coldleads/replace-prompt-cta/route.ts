export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/../lib/mongodb'

/**
 * POST /api/coldleads/replace-prompt-cta
 * Ersetze komplett den CTA-Teil im Prompt
 */
export async function POST() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('email_prompts')
    
    const prompt = await collection.findOne({ active: true })
    
    if (!prompt) {
      return NextResponse.json({
        ok: false,
        error: 'Kein aktiver Prompt'
      }, { status: 404 })
    }
    
    let updatedPrompt = prompt.prompt
    
    // Finde den CTA-Start
    const ctaStart = updatedPrompt.indexOf('4. Call-to-Action:')
    const formatStart = updatedPrompt.indexOf('FORMAT (SEHR WICHTIG):', ctaStart)
    
    if (ctaStart === -1 || formatStart === -1) {
      return NextResponse.json({
        ok: false,
        error: 'CTA-Sektion nicht gefunden'
      })
    }
    
    // Neuer CTA mit HTML-Link
    const newCTA = `4. Call-to-Action:
   Klar und direkt:
   "Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr)."
   
   Danach IMMER diesen Satz mit klickbarem HTML-Link (verwende <a href='...'>):
   "Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: <a href='https://score-schleifwerkzeuge.de/business'>https://score-schleifwerkzeuge.de/business</a>"

`
    
    // Ersetze alles zwischen CTA und FORMAT
    updatedPrompt = updatedPrompt.substring(0, ctaStart) + newCTA + updatedPrompt.substring(formatStart)
    
    // Update in DB
    await collection.updateOne(
      { active: true },
      { $set: { prompt: updatedPrompt, updated_at: new Date() } }
    )
    
    console.log('[Replace] CTA erfolgreich ersetzt!')
    
    return NextResponse.json({
      ok: true,
      message: 'Prompt CTA erfolgreich aktualisiert',
      has_html_link: updatedPrompt.includes("<a href='https://score-schleifwerkzeuge.de/business'>")
    })
    
  } catch (error: any) {
    console.error('[Replace] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
