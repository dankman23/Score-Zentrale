export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

/**
 * GET /api/fibu/zahlungen/vorschlaege?zahlungId=xxx
 * 
 * Findet passende Belege (VK/EK-Rechnungen) für eine Zahlung
 * Scoring basiert auf:
 * - Betrag-Übereinstimmung (Hauptkriterium)
 * - AU-Nummer Match
 * - Datum-Nähe
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const zahlungId = searchParams.get('zahlungId')
    const transaktionsId = searchParams.get('transaktionsId')
    const betrag = parseFloat(searchParams.get('betrag') || '0')
    const datum = searchParams.get('datum')
    const referenz = searchParams.get('referenz') // AU-Nummer
    
    if (!betrag) {
      return NextResponse.json(
        { ok: false, error: 'Betrag erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    
    // Suche VK-Rechnungen (Verkauf)
    const vkRechnungen = await db.collection('fibu_vk_rechnungen')
      .find({
        rechnungsdatum: {
          $gte: new Date('2025-10-01') // Nur ab Oktober
        }
      })
      .limit(100) // Limit für Performance
      .toArray()
    
    // TODO: EK-Rechnungen (Einkauf) später hinzufügen
    
    // Score jede Rechnung
    const zahlungDatum = datum ? new Date(datum) : new Date()
    const istEingang = betrag > 0 // Positiv = Eingang (VK), Negativ = Ausgang (EK)
    
    const vorschlaege = vkRechnungen
      .filter(r => {
        // Nur passende Richtung: Eingang → VK-Rechnung
        return istEingang
      })
      .map(r => {
        let score = 0
        let reasons: string[] = []
        
        // 1. Betrag-Match (Hauptkriterium)
        const betragDiff = Math.abs((r.brutto || 0) - Math.abs(betrag))
        if (betragDiff < 0.10) {
          score += 100 // Perfekt
          reasons.push('Betrag exakt')
        } else if (betragDiff < 1.00) {
          score += 80 // Sehr gut
          reasons.push(`Betrag ähnlich (±${betragDiff.toFixed(2)}€)`)
        } else if (betragDiff < 5.00) {
          score += 50 // Gut
          reasons.push(`Betrag nah (±${betragDiff.toFixed(2)}€)`)
        } else if (betragDiff < 20.00) {
          score += 20 // Akzeptabel
          reasons.push(`Betrag ungefähr (±${betragDiff.toFixed(2)}€)`)
        } else {
          return null // Zu große Abweichung
        }
        
        // 2. AU-Nummer Match (wenn vorhanden)
        if (referenz) {
          const auMatch = referenz.match(/AU[_-]?(\d+)/)
          if (auMatch) {
            const auNr = auMatch[1]
            const rechnungsNr = r.cRechnungsNr || r.rechnungsNr || ''
            
            // TODO: Prüfe gegen Auftragsnummer in JTL
            // Für jetzt: Score bonus wenn AU-Nummer im Verwendungszweck
            score += 50
            reasons.push(`AU-Nummer: ${referenz}`)
          }
        }
        
        // 3. Datum-Nähe
        const dateDiff = Math.abs(new Date(r.rechnungsdatum).getTime() - zahlungDatum.getTime())
        const daysDiff = dateDiff / (1000 * 60 * 60 * 24)
        
        if (daysDiff <= 7) {
          score += 30
          reasons.push('Datum sehr nah')
        } else if (daysDiff <= 30) {
          score += 15
          reasons.push('Datum nah')
        } else if (daysDiff <= 60) {
          score += 5
          reasons.push('Datum akzeptabel')
        }
        
        return {
          belegId: r._id.toString(),
          typ: 'vk-rechnung',
          rechnungsNr: r.cRechnungsNr || r.rechnungsNr,
          kunde: r.kundenName || r.cFirma || r.cName,
          betrag: r.brutto,
          datum: r.rechnungsdatum,
          status: r.bezahltStatus || 'offen',
          score,
          reasons,
          betragDiff
        }
      })
      .filter(Boolean) // Entferne null-Werte
      .sort((a, b) => b.score - a.score) // Beste zuerst
      .slice(0, 10) // Top 10
    
    console.log(`[Vorschläge] ${vorschlaege.length} passende Belege gefunden für Betrag ${betrag}€`)
    
    return NextResponse.json({
      ok: true,
      vorschlaege,
      zahlungInfo: {
        betrag,
        datum,
        referenz,
        istEingang
      }
    })
    
  } catch (error: any) {
    console.error('[Vorschläge] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
