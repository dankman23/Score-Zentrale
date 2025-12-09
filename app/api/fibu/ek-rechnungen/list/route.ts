export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

/**
 * Liste aller EK-Rechnungen mit Filterung
 * Filtert automatisch SCORE (eigene Firma) und fehlerhafte Einträge heraus
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-11-30'
    
    const db = await getDb()
    
    console.log(`[EK-Rechnungen] Lade: ${from} - ${to}`)
    
    // Lade alle EK-Rechnungen
    const alleRechnungen = await db.collection('fibu_ek_rechnungen').find({
      rechnungsdatum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      }
    }).toArray()
    
    console.log(`[EK-Rechnungen] Geladen: ${alleRechnungen.length} Einträge`)
    
    // WICHTIG: Filtere eigene Firma und fehlerhafte Einträge heraus
    const EIGENE_FIRMA_VARIANTEN = [
      'SCORE Handels GmbH & Co. KG',
      'Score Handels GmbH und Co KG',
      'SCORE Handels GmbH',
      'Score Handels',
      'SCORE GmbH'
    ]
    
    const AUSGESCHLOSSENE_LIEFERANTEN = [
      'Amazon Payment',  // Das sind externe Rechnungen (VK), keine EK
      'eBay Managed Payments',  // Auch VK
      ...EIGENE_FIRMA_VARIANTEN
    ]
    
    const gereinigte = alleRechnungen.filter(r => {
      const lieferant = r.lieferantName || ''
      
      // Prüfe ob Lieferant ausgeschlossen ist
      const istAusgeschlossen = AUSGESCHLOSSENE_LIEFERANTEN.some(excluded => 
        lieferant.toLowerCase().includes(excluded.toLowerCase())
      )
      
      if (istAusgeschlossen) {
        console.log(`[EK-Rechnungen] ⚠️ Filtere aus: ${lieferant} (${r.rechnungsNummer})`)
        return false
      }
      
      return true
    })
    
    console.log(`[EK-Rechnungen] Nach Filterung: ${gereinigte.length} Einträge`)
    console.log(`[EK-Rechnungen] Herausgefiltert: ${alleRechnungen.length - gereinigte.length} Einträge`)
    
    // WICHTIG: Entferne Duplikate (gleiche RechnungsNr + Lieferant + Betrag)
    const seenKeys = new Set()
    const ohneDuplikate = gereinigte.filter(r => {
      // Erstelle eindeutigen Schlüssel
      const key = `${r.lieferantName}|${r.rechnungsNummer}|${r.gesamtBetrag}|${r.rechnungsdatum}`
      
      if (seenKeys.has(key)) {
        console.log(`[EK-Rechnungen] ⚠️ Duplikat entfernt: ${r.lieferantName} - ${r.rechnungsNummer} (${r.gesamtBetrag}€)`)
        return false
      }
      
      seenKeys.add(key)
      return true
    })
    
    const duplikateAnzahl = gereinigte.length - ohneDuplikate.length
    
    if (duplikateAnzahl > 0) {
      console.log(`[EK-Rechnungen] 🧹 ${duplikateAnzahl} Duplikate entfernt`)
    }
    
    // NEUE LOGIK: Nur GEPRÜFTE und VOLLSTÄNDIGE Rechnungen im EK-Tab
    // Rechnungen müssen haben: Kreditor UND Betrag > 0
    const gepruefte = ohneDuplikate.filter(r => {
      const hatKreditor = r.kreditorKonto && r.kreditorKonto.trim() !== ''
      const hatBetrag = r.gesamtBetrag && r.gesamtBetrag > 0
      
      if (!hatKreditor || !hatBetrag) {
        console.log(`[EK-Rechnungen] ℹ️ In Zuordnung: ${r.lieferantName} - ${r.rechnungsNummer} (Kreditor: ${hatKreditor}, Betrag: ${r.gesamtBetrag || 0}€)`)
        return false
      }
      
      return true
    })
    
    const inZuordnung = ohneDuplikate.length - gepruefte.length
    
    console.log(`[EK-Rechnungen] ✅ Geprüfte Rechnungen: ${gepruefte.length}`)
    console.log(`[EK-Rechnungen] 📋 In Zuordnung: ${inZuordnung}`)
    
    return NextResponse.json({
      ok: true,
      rechnungen: gepruefte,
      stats: {
        gesamt: gepruefte.length,
        gefiltert: alleRechnungen.length - gereinigte.length,
        duplikateEntfernt: duplikateAnzahl,
        inZuordnung: inZuordnung,
        zeitraum: { from, to }
      }
    })
    
  } catch (error: any) {
    console.error('[EK-Rechnungen] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
