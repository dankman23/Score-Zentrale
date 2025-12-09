/**
 * GET /api/fibu/learning/stats
 * 
 * Liefert Statistiken über das Learning-System
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import { getLearningStats } from '../../../lib/fibu/learning-database'

export async function GET() {
  try {
    const db = await getDb()
    
    const stats = await getLearningStats(db)
    
    return NextResponse.json({
      ok: true,
      stats
    })
    
  } catch (error: any) {
    console.error('[Learning Stats] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
