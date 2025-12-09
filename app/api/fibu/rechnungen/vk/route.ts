export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/mongodb'

/**
 * GET /api/fibu/rechnungen/vk
 * Lädt VK-Rechnungen aus MongoDB (fibu_vk_rechnungen)
 * 
 * Query-Parameter:
 * - from: Startdatum (YYYY-MM-DD)
 * - to: Enddatum (YYYY-MM-DD)
 * 
 * WICHTIG: 
 * - Lädt aus MongoDB, NICHT aus MSSQL!
 * - Rechnungen werden NIEMALS automatisch gelöscht
 * - Rechnungen werden NIEMALS überschrieben
 * - Nur neue Rechnungen werden hinzugefügt
 * - Status-Updates (Offen -> Bezahlt) erlaubt
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'
    
    const startDate = new Date(from)
    const endDate = new Date(to + 'T23:59:59.999Z')
    
    console.log('[VK-Rechnungen] Lade aus MongoDB:', from, 'bis', to)
    
    const db = await getDb()
    
    // Lade VK-Rechnungen aus MongoDB
    const rechnungen = await db.collection('fibu_vk_rechnungen')
      .find({
        rechnungsdatum: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .sort({ rechnungsdatum: -1 })
      .toArray()
    
    console.log('[VK-Rechnungen] Geladen:', rechnungen.length, 'aus MongoDB')
    
    const mapped = rechnungen.map(r => ({
      id: r._id.toString(),
      rechnungsNr: r.cRechnungsNr || r.rechnungsNr || 'N/A',
      datum: r.rechnungsdatum,
      kunde: r.kundenName || 'Unbekannt',
      betrag: r.brutto || 0,
      netto: r.netto || 0,
      mwst: r.mwst || 0,
      debitor: r.debitorKonto,
      sachkonto: r.sachkonto,
      zahlungsart: r.zahlungsart,
      status: r.status || 'Offen',
      land: r.kundenLand,
      ustId: r.kundenUstId,
      quelle: 'JTL'
    }))
    
    return NextResponse.json({
      ok: true,
      rechnungen: mapped,
      total: mapped.length,
      zeitraum: { from, to },
      quelle: 'MongoDB (fibu_vk_rechnungen)'
    })
    
  } catch (error: any) {
    console.error('[VK-Rechnungen API] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
