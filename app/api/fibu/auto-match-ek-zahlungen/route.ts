export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

/**
 * POST /api/fibu/auto-match-ek-zahlungen
 * 
 * Ordnet negative Zahlungen (Zahlungsabgänge) automatisch EK-Rechnungen zu
 * Basierend auf:
 * - Betrag-Matching
 * - Datum-Nähe
 * - Rechnungsnummer im Verwendungszweck
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDb()
    const zahlungenCol = db.collection('fibu_zahlungen')
    const ekCol = db.collection('fibu_ek_rechnungen')
    
    // Hole negative Zahlungen (Zahlungsabgänge)
    const negativeZahlungen = await zahlungenCol.find({
      betrag: { $lt: 0 },
      zahlungsdatum: { $gte: new Date('2025-10-01') }
    }).toArray()
    
    console.log(`[Auto-Match EK] ${negativeZahlungen.length} negative Zahlungen gefunden`)
    
    // Hole alle EK-Rechnungen
    const ekRechnungen = await ekCol.find({
      rechnungsdatum: { $gte: new Date('2025-10-01') }
    }).toArray()
    
    console.log(`[Auto-Match EK] ${ekRechnungen.length} EK-Rechnungen gefunden`)
    
    let matchCount = 0
    const matches = []
    
    for (const zahlung of negativeZahlungen) {
      const zahlungBetrag = Math.abs(zahlung.betrag)
      const zahlungDatum = new Date(zahlung.zahlungsdatum)
      const hinweis = (zahlung.hinweis || '').toLowerCase()
      
      // Suche passende EK-Rechnung
      for (const rechnung of ekRechnungen) {
        const rechnungBetrag = rechnung.gesamtBetrag
        const rechnungDatum = new Date(rechnung.rechnungsdatum)
        const rechnungsNr = (rechnung.rechnungsNummer || '').toLowerCase()
        
        let score = 0
        const reasons = []
        
        // 1. Betrag-Match (±1% Toleranz)
        const betragDiff = Math.abs(zahlungBetrag - rechnungBetrag)
        const betragTolerance = rechnungBetrag * 0.01
        
        if (betragDiff <= betragTolerance) {
          score += 50
          reasons.push(`Betrag-Match: ${zahlungBetrag}€ ≈ ${rechnungBetrag}€`)
        } else if (betragDiff <= rechnungBetrag * 0.05) {
          // 5% Toleranz für Teil-Score
          score += 25
          reasons.push(`Betrag ähnlich: ${zahlungBetrag}€ ~ ${rechnungBetrag}€`)
        }
        
        // 2. Datum-Nähe (max 30 Tage Abstand)
        const datumDiff = Math.abs(zahlungDatum.getTime() - rechnungDatum.getTime())
        const daysDiff = datumDiff / (1000 * 60 * 60 * 24)
        
        if (daysDiff <= 7) {
          score += 30
          reasons.push(`Datum nah: ${Math.floor(daysDiff)} Tage`)
        } else if (daysDiff <= 30) {
          score += 15
          reasons.push(`Datum OK: ${Math.floor(daysDiff)} Tage`)
        }
        
        // 3. Rechnungsnummer im Verwendungszweck
        if (rechnungsNr && hinweis.includes(rechnungsNr)) {
          score += 40
          reasons.push(`RgNr im Hinweis: ${rechnungsNr}`)
        }
        
        // 4. Lieferanten-Name im Verwendungszweck
        const lieferantName = (rechnung.lieferantName || '').toLowerCase()
        if (lieferantName && hinweis.includes(lieferantName)) {
          score += 20
          reasons.push(`Lieferant im Hinweis: ${lieferantName}`)
        }
        
        // Match wenn Score >= 70
        if (score >= 70) {
          matches.push({
            zahlungId: zahlung.uniqueId || zahlung._id,
            rechnungId: rechnung._id,
            score,
            reasons,
            zahlung: {
              betrag: zahlung.betrag,
              datum: zahlung.zahlungsdatum,
              zahlungsart: zahlung.zahlungsart,
              hinweis: zahlung.hinweis?.substring(0, 100)
            },
            rechnung: {
              belegnummer: rechnung.rechnungsNummer,
              betrag: rechnung.gesamtBetrag,
              datum: rechnung.rechnungsdatum,
              lieferant: rechnung.lieferantName
            }
          })
          
          matchCount++
          console.log(`[Auto-Match EK] Match: ${zahlung.zahlungsart} ${zahlung.betrag}€ → ${rechnung.lieferantName} ${rechnung.gesamtBetrag}€ (Score: ${score})`)
          break // Nur ein Match pro Zahlung
        }
      }
    }
    
    // Speichere Matches (optional - kann später aktiviert werden)
    // for (const match of matches) {
    //   await ekCol.updateOne(
    //     { _id: match.rechnungId },
    //     { $set: { zahlungId: match.zahlungId, zahlungMatchScore: match.score } }
    //   )
    // }
    
    return NextResponse.json({
      ok: true,
      analyzed: {
        negativeZahlungen: negativeZahlungen.length,
        ekRechnungen: ekRechnungen.length
      },
      matches: matchCount,
      matchRate: ((matchCount / negativeZahlungen.length) * 100).toFixed(1) + '%',
      details: matches.slice(0, 20) // Erste 20 für Preview
    })
    
  } catch (error: any) {
    console.error('[Auto-Match EK] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET: Zeige Auto-Match-Statistiken
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const zahlungenCol = db.collection('fibu_zahlungen')
    const ekCol = db.collection('fibu_ek_rechnungen')
    
    const negativeCount = await zahlungenCol.countDocuments({
      betrag: { $lt: 0 },
      zahlungsdatum: { $gte: new Date('2025-10-01') }
    })
    
    const ekCount = await ekCol.countDocuments({
      rechnungsdatum: { $gte: new Date('2025-10-01') }
    })
    
    const ekWithZahlung = await ekCol.countDocuments({
      rechnungsdatum: { $gte: new Date('2025-10-01') },
      zahlungId: { $exists: true, $ne: null }
    })
    
    return NextResponse.json({
      ok: true,
      stats: {
        negativeZahlungen: negativeCount,
        ekRechnungen: ekCount,
        ekWithZahlung,
        unmatchedEK: ekCount - ekWithZahlung
      }
    })
    
  } catch (error: any) {
    console.error('[Auto-Match EK Stats] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
