export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMongoClient } from '../../lib/mongodb'

/**
 * POST /api/customers/reset-jtl
 * Löscht alle JTL-Kunden aus MongoDB (für Neu-Import)
 */
export async function POST() {
  try {
    const client = await getMongoClient()
    const db = client.db()
    const prospectsCollection = db.collection('prospects')
    
    // Lösche alle Kunden mit imported_from_jtl = true
    const result = await prospectsCollection.deleteMany({
      imported_from_jtl: true
    })
    
    return NextResponse.json({
      ok: true,
      deleted: result.deletedCount,
      message: `${result.deletedCount} JTL-Kunden gelöscht. Jetzt JTL-Sync durchführen!`
    })
    
  } catch (error: any) {
    console.error('[Reset JTL] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
