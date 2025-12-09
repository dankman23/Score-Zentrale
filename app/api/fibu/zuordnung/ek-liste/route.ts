export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/mongodb'

/**
 * Liste aller EK-Rechnungen für ZUORDNUNG
 * Zeigt nur: ohne Kreditor ODER Betrag = 0
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'
    
    const db = await getDb()
    
    console.log(`[Zuordnung EK] Lade: ${from} - ${to}`)
    
    // Lade alle EK-Rechnungen
    const alleRechnungen = await db.collection('fibu_ek_rechnungen').find({
      rechnungsdatum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      }
    }).toArray()
    
    // Filtere SCORE und fehlerhafte Einträge
    const EIGENE_FIRMA_VARIANTEN = [
      'SCORE Handels GmbH & Co. KG',
      'Score Handels GmbH und Co KG',
      'SCORE Handels GmbH',
      'Score Handels',
      'SCORE GmbH'
    ]
    
    const AUSGESCHLOSSENE_LIEFERANTEN = [
      'Amazon Payment',
      'eBay Managed Payments',
      ...EIGENE_FIRMA_VARIANTEN
    ]
    
    const gereinigte = alleRechnungen.filter(r => {
      const lieferant = r.lieferantName || ''
      const istAusgeschlossen = AUSGESCHLOSSENE_LIEFERANTEN.some(excluded => 
        lieferant.toLowerCase().includes(excluded.toLowerCase())
      )
      return !istAusgeschlossen
    })
    
    // Entferne Duplikate
    const seenKeys = new Set()
    const ohneDuplikate = gereinigte.filter(r => {
      const key = `${r.lieferantName}|${r.rechnungsNummer}|${r.gesamtBetrag}|${r.rechnungsdatum}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })
    
    // NUR Rechnungen für Zuordnung: ohne Kreditor ODER Betrag = 0
    const fuerZuordnung = ohneDuplikate.filter(r => {
      const hatKeinKreditor = !r.kreditorKonto || r.kreditorKonto.trim() === ''
      const hatKeinBetrag = !r.gesamtBetrag || r.gesamtBetrag <= 0
      
      return hatKeinKreditor || hatKeinBetrag
    })
    
    console.log(`[Zuordnung EK] ✅ Für Zuordnung: ${fuerZuordnung.length}`)
    
    return NextResponse.json({
      ok: true,
      rechnungen: fuerZuordnung,
      stats: {
        gesamt: fuerZuordnung.length,
        zeitraum: { from, to }
      }
    })
    
  } catch (error: any) {
    console.error('[Zuordnung EK] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
