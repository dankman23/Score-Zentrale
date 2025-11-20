export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../../lib/mongodb'

/**
 * POST /api/coldleads/fix-prompt-link
 * Fix: Link muss als HTML-Tag im Prompt sein
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
    
    // Ersetze den CTA-Teil mit klickbarem Link
    const oldCTA = `4. Call-to-Action:
   Klar und direkt:
   "Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr)."
   Optional 1 Satz mit Link:
   "Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter:
 https://score-schleifwerkzeuge.de/business."
Wobei bitte nach "unter:" ein Zeilenumbruch und den bitte den link verlinken.`
    
    const newCTA = `4. Call-to-Action:
   Klar und direkt:
   "Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr)."
   
   Danach IMMER diesen Satz (EXAKT so mit HTML-Link):
   "Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: <a href='https://score-schleifwerkzeuge.de/business'>https://score-schleifwerkzeuge.de/business</a>"`
    
    updatedPrompt = updatedPrompt.replace(oldCTA, newCTA)
    
    // Prüfe ob Ersetzung funktioniert hat
    const replaced = updatedPrompt !== prompt.prompt
    
    if (replaced) {
      await collection.updateOne(
        { active: true },
        { $set: { prompt: updatedPrompt, updated_at: new Date() } }
      )
      
      console.log('[Fix] Prompt aktualisiert mit HTML-Link!')
      
      return NextResponse.json({
        ok: true,
        message: 'Prompt erfolgreich aktualisiert',
        has_html_link: updatedPrompt.includes("<a href='https://score-schleifwerkzeuge.de/business'>")
      })
    } else {
      return NextResponse.json({
        ok: false,
        error: 'CTA-Teil nicht gefunden oder bereits korrekt',
        current_cta_preview: prompt.prompt.substring(prompt.prompt.indexOf('4. Call-to-Action'), prompt.prompt.indexOf('4. Call-to-Action') + 400)
      })
    }
    
  } catch (error: any) {
    console.error('[Fix] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
