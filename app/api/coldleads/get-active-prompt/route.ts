export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '@/../lib/mongodb'

/**
 * GET /api/coldleads/get-active-prompt
 * Hole kompletten aktiven Prompt
 */
export async function GET() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('email_prompts')
    
    const prompt = await collection.findOne({ active: true })
    
    if (!prompt) {
      return NextResponse.json({
        ok: false,
        error: 'Kein aktiver Prompt gefunden'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      ok: true,
      prompt: prompt.prompt,
      version: prompt.version,
      name: prompt.name,
      model: prompt.model
    })
    
  } catch (error: any) {
    console.error('[Get] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
