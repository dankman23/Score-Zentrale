export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

/**
 * Übersicht: Nicht zugeordnete Zahlungen und Rechnungen
 * 
 * Zeigt was noch manuell zugeordnet werden muss
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]
    
    const db = await getDb()
    
    // Nicht zugeordnete Zahlungen aus fibu_zahlungen
    const zahlungenCollection = db.collection('fibu_zahlungen')
    const nichtZugeordneteZahlungen = await zahlungenCollection.find({
      zahlungsdatum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      },
      istZugeordnet: false
    }).sort({ zahlungsdatum: -1 }).limit(100).toArray()
    
    // VK-Rechnungen ohne Zahlung aus fibu_rechnungen_vk
    const vkRechnungenCollection = db.collection('fibu_rechnungen_vk')
    const offeneRechnungen = await vkRechnungenCollection.find({
      rechnungsdatum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      },
      status: { $ne: 'Bezahlt' }
    }).sort({ rechnungsdatum: -1 }).limit(100).toArray()
    
    // Externe Rechnungen (alle, da keine Zahlungszuordnung in JTL)
    const externeRechnungenCollection = db.collection('fibu_externe_rechnungen')
    const externeRechnungen = await externeRechnungenCollection.find({
      belegdatum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      }
    }).sort({ belegdatum: -1 }).limit(100).toArray()
    
    // Zusammenfassung
    const stats = {
      zahlungen: {
        nichtZugeordnet: nichtZugeordneteZahlungen.length,
        gesamtBetrag: nichtZugeordneteZahlungen.reduce((sum, z) => sum + (z.betrag || 0), 0)
      },
      rechnungen: {
        offen: offeneRechnungen.length,
        gesamtBetrag: offeneRechnungen.reduce((sum, r) => sum + (r.brutto || 0), 0)
      },
      externeRechnungen: {
        gesamt: externeRechnungen.length,
        gesamtBetrag: externeRechnungen.reduce((sum, r) => sum + (r.brutto || 0), 0)
      }
    }
    
    return NextResponse.json({
      ok: true,
      stats,
      nichtZugeordneteZahlungen: nichtZugeordneteZahlungen.slice(0, 20),
      offeneRechnungen: offeneRechnungen.slice(0, 20),
      externeRechnungen: externeRechnungen.slice(0, 20),
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('Fehler bei Nicht-Zugeordnet-Übersicht:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
