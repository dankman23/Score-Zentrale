/**
 * POST /api/fibu/learning/init
 * 
 * Initialisiert die Learning-Database
 * - Erstellt Collections und Indexes
 * - Importiert Default-Rules
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'
import { initLearningCollections, importDefaultRules } from '@/../lib/fibu/learning-database'

export async function POST() {
  try {
    const db = await getDb()
    
    console.log('[Learning Init] Starte Initialisierung...')
    
    // 1. Initialisiere Collections mit Indexes
    await initLearningCollections(db)
    
    // 2. Importiere Default-Rules
    const imported = await importDefaultRules(db)
    
    console.log('[Learning Init] ✅ Initialisierung abgeschlossen')
    
    return NextResponse.json({
      ok: true,
      message: 'Learning-Database initialisiert',
      imported,
      collections: [
        'fibu_matching_rules',
        'fibu_matching_history'
      ]
    })
    
  } catch (error: any) {
    console.error('[Learning Init] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
