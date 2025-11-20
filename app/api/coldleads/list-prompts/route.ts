export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { connectToMongoDB } from '../../../../lib/mongodb'

/**
 * GET /api/coldleads/list-prompts
 * Liste alle E-Mail-Prompts
 */
export async function GET() {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection('email_prompts')
    
    const prompts = await collection.find({}).toArray()
    
    const promptList = prompts.map(p => ({
      version: p.version,
      name: p.name,
      active: p.active,
      model: p.model,
      has_leismann: p.prompt.includes('leismann@'),
      has_daniel: p.prompt.includes('daniel@'),
      has_clickable_link: p.prompt.includes('<a href='),
      prompt_preview: p.prompt.substring(0, 200) + '...'
    }))
    
    return NextResponse.json({
      ok: true,
      count: prompts.length,
      prompts: promptList
    })
    
  } catch (error: any) {
    console.error('[List] Error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
