/**
 * POST /api/fibu/zahlungen/assign-beleg
 * 
 * Ordnet einer Zahlung einen Beleg zu
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      zahlungId,
      anbieter,
      belegId,
      belegNr
    } = body
    
    if (!zahlungId || !anbieter || !belegId) {
      return NextResponse.json({
        ok: false,
        error: 'Fehlende Parameter: zahlungId, anbieter, belegId'
      }, { status: 400 })
    }
    
    const db = await getDb()
    
    // Collection ermitteln
    const collectionMap: Record<string, string> = {
      'amazon': 'fibu_amazon_settlements',
      'paypal': 'fibu_paypal_transactions',
      'commerzbank': 'fibu_bank_transaktionen',
      'postbank': 'fibu_bank_postbank',
      'mollie': 'mollie_payments'
    }
    
    const collectionName = collectionMap[anbieter.toLowerCase()]
    if (!collectionName) {
      return NextResponse.json({
        ok: false,
        error: `Unbekannter Anbieter: ${anbieter}`
      }, { status: 400 })
    }
    
    const collection = db.collection(collectionName)
    
    // Update Zahlung
    await collection.updateOne(
      { _id: zahlungId },
      {
        $set: {
          belegId,
          belegNr,
          belegZuordnungsDatum: new Date(),
          belegZuordnungDurch: 'manual'
        }
      }
    )
    
    console.log(`[Assign Beleg] ✅ Zahlung ${zahlungId} → Beleg ${belegNr}`)
    
    return NextResponse.json({
      ok: true,
      message: `Beleg ${belegNr} erfolgreich zugeordnet`
    })
    
  } catch (error: any) {
    console.error('[Assign Beleg] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
