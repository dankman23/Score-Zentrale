export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../lib/mongodb'

/**
 * POST /api/coldleads/set-prompt-complete
 * Setzt den kompletten Prompt
 */
export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()
    
    if (!prompt) {
      return NextResponse.json({
        ok: false,
        error: 'Prompt erforderlich'
      }, { status: 400 })
    }
    
    const db = await connectToMongoDB()
    const collection = db.collection('email_prompts')
    
    // Update aktiven Prompt
    const result = await collection.updateOne(
      { active: true },
      { 
        $set: { 
          prompt: prompt,
          updated_at: new Date()
        } 
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Kein aktiver Prompt gefunden'
      }, { status: 404 })
    }
    
    console.log('[Set Prompt] Kompletter Prompt aktualisiert!')
    
    return NextResponse.json({
      ok: true,
      message: 'Prompt erfolgreich aktualisiert',
      preview: prompt.substring(0, 200) + '...'
    })
    
  } catch (error: any) {
    console.error('[Set Prompt] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
