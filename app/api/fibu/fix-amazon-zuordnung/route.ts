export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

/**
 * Korrigiert falsche Amazon Payment Zuordnungen
 * Amazon Payment darf NUR zu XRE-* Rechnungen zugeordnet werden!
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb()
    
    console.log('[Fix Amazon] Starte Korrektur...')
    
    // 1. Finde alle Amazon Payment Zahlungen die zu RE-* Rechnungen zugeordnet sind
    const collection = db.collection('fibu_zahlungen')
    
    const falscheZuordnungen = await collection.find({
      zahlungsart: { $regex: /amazon.*payment/i },
      rechnungsNr: { $regex: /^RE-/ },
      istZugeordnet: true
    }).toArray()
    
    console.log(`[Fix Amazon] Gefunden: ${falscheZuordnungen.length} falsch zugeordnete Zahlungen`)
    
    if (falscheZuordnungen.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Keine falschen Zuordnungen gefunden',
        korrigiert: 0
      })
    }
    
    // 2. Entferne die Zuordnung
    let korrigiert = 0
    
    for (const zahlung of falscheZuordnungen) {
      await collection.updateOne(
        { _id: zahlung._id },
        {
          $set: {
            istZugeordnet: false,
            kRechnung: null,
            rechnungsNr: null,
            updated_at: new Date(),
            korrektur: 'Amazon Payment zu RE-Rechnung entfernt'
          }
        }
      )
      
      console.log(`[Fix Amazon] ✅ Korrigiert: ${zahlung.betrag}€ → ${zahlung.rechnungsNr} (entfernt)`)
      korrigiert++
    }
    
    return NextResponse.json({
      ok: true,
      message: `${korrigiert} falsche Zuordnungen entfernt`,
      korrigiert,
      beispiele: falscheZuordnungen.slice(0, 5).map(z => ({
        betrag: z.betrag,
        falscheRechnung: z.rechnungsNr,
        datum: z.zahlungsdatum
      }))
    })
    
  } catch (error: any) {
    console.error('[Fix Amazon] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
