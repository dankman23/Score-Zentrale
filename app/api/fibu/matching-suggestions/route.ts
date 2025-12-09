/**
 * GET /api/fibu/matching-suggestions
 * 
 * Liefert Matching-Vorschläge für offene Zahlungen
 * ERGÄNZT die bestehende Auto-Match-Funktionalität
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/mongodb'
import {
  extractAuNummer,
  extractRechnungsNr,
  extractAmazonOrderId,
  calculateBetragDatumScore,
  detectPartialPayment
} from '@/lib/fibu/matching-engine'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const minConfidence = searchParams.get('minConfidence') || 'medium'
    
    const db = await getDb()
    
    console.log('[Matching Suggestions] Lade Vorschläge...')
    
    // Lade nicht-zugeordnete Zahlungen ab Oktober 2025
    const zahlungsquellen = [
      { name: 'Mollie', collection: 'mollie_payments' },
      { name: 'PayPal', collection: 'fibu_paypal_transactions' },
      { name: 'Commerzbank', collection: 'fibu_bank_transaktionen' },
      { name: 'Postbank', collection: 'fibu_bank_postbank' }
    ]
    
    // Lade alle Rechnungen einmal
    const vkRechnungenColl = db.collection('fibu_rechnungen_alle')
    const alleRechnungen = await vkRechnungenColl.find({
      belegnummer: { $regex: /^RE/ }  // Nur VK-Rechnungen
    }).toArray()
    
    const suggestions: any[] = []
    
    for (const source of zahlungsquellen) {
      const collection = db.collection(source.collection)
      
      const query: any = {
        istZugeordnet: { $ne: true },
        datumDate: { $gte: new Date('2025-10-01') }
      }
      
      if (source.name === 'Mollie') {
        query.status = { $in: ['paid', 'authorized'] }
      }
      
      const zahlungen = await collection.find(query).limit(limit).toArray()
      
      for (const zahlung of zahlungen) {
        const candidates: any[] = []
        
        // Strategie 1: AU-Nummer
        const auNr = extractAuNummer(
          zahlung.verwendungszweck || zahlung.beschreibung || zahlung.rechnungsNr
        )
        
        if (auNr) {
          const auMatches = alleRechnungen.filter(r => {
            const bestellnr = r.cBestellNr || ''
            return bestellnr.includes(auNr)
          })
          
          auMatches.forEach(r => {
            candidates.push({
              beleg: r,
              confidence: 'high',
              method: 'au_nummer',
              reason: `AU-Nummer "${auNr}" gefunden`
            })
          })
        }
        
        // Strategie 2: RE-Nummer
        const reNr = extractRechnungsNr(
          zahlung.verwendungszweck || zahlung.beschreibung
        )
        
        if (reNr) {
          const reMatches = alleRechnungen.filter(r => {
            const belegnr = r.belegnummer || ''
            return belegnr.includes(reNr)
          })
          
          reMatches.forEach(r => {
            candidates.push({
              beleg: r,
              confidence: 'high',
              method: 're_nummer',
              reason: `Rechnungsnummer "${reNr}" gefunden`
            })
          })
        }
        
        // Strategie 3: Amazon Order-ID
        const orderId = extractAmazonOrderId(
          zahlung.verwendungszweck || zahlung.beschreibung || zahlung.referenz
        )
        
        if (orderId) {
          const orderMatches = alleRechnungen.filter(r => {
            const bestellnr = r.cBestellNr || ''
            return bestellnr.includes(orderId)
          })
          
          orderMatches.forEach(r => {
            candidates.push({
              beleg: r,
              confidence: 'high',
              method: 'amazon_order_id',
              reason: `Amazon Order-ID "${orderId}" gefunden`
            })
          })
        }
        
        // Strategie 4: Betrag + Datum (Fuzzy)
        if (candidates.length === 0) {
          const zahlungDatum = zahlung.datumDate || zahlung.datum
          
          if (zahlungDatum) {
            const betragMatches = alleRechnungen
              .map(r => {
                const result = calculateBetragDatumScore(
                  Math.abs(zahlung.betrag),
                  r.brutto || 0,
                  new Date(zahlungDatum),
                  new Date(r.rechnungsdatum)
                )
                
                // Prüfe Teilzahlung
                const partial = detectPartialPayment(
                  Math.abs(zahlung.betrag),
                  r.brutto || 0
                )
                
                return {
                  rechnung: r,
                  score: result.score,
                  confidence: result.confidence,
                  isPartial: partial.isPartial,
                  partialPercentage: partial.percentage
                }
              })
              .filter(m => {
                // Filter: Score < 5 UND (high/medium confidence ODER Teilzahlung)
                return m.score < 5 && (
                  m.confidence === 'high' ||
                  m.confidence === 'medium' ||
                  m.isPartial
                )
              })
              .sort((a, b) => a.score - b.score)
              .slice(0, 3)  // Top 3
            
            betragMatches.forEach(m => {
              let reason = `Betrag ähnlich (${m.score.toFixed(2)} Score)`
              if (m.isPartial) {
                reason += ` - Teilzahlung ${(m.partialPercentage * 100).toFixed(0)}%`
              }
              
              candidates.push({
                beleg: m.rechnung,
                confidence: m.confidence,
                method: 'betrag_datum',
                reason,
                score: m.score,
                isPartial: m.isPartial
              })
            })
          }
        }
        
        // Nur hinzufügen wenn Vorschläge vorhanden
        if (candidates.length > 0) {
          // Filtere nach minConfidence
          const confidenceLevels = { high: 3, medium: 2, low: 1 }
          const minLevel = confidenceLevels[minConfidence as keyof typeof confidenceLevels]
          
          const filtered = candidates.filter(c => {
            return confidenceLevels[c.confidence as keyof typeof confidenceLevels] >= minLevel
          })
          
          if (filtered.length > 0) {
            suggestions.push({
              zahlung: {
                _id: zahlung._id.toString(),
                anbieter: source.name,
                betrag: zahlung.betrag,
                datum: zahlung.datumDate || zahlung.datum,
                beschreibung: zahlung.verwendungszweck || zahlung.beschreibung || zahlung.rechnungsNr,
                referenz: zahlung.referenz
              },
              suggestions: filtered.map(c => ({
                belegId: c.beleg.uniqueId || c.beleg._id.toString(),
                belegnummer: c.beleg.belegnummer,
                rechnungsdatum: c.beleg.rechnungsdatum,
                brutto: c.beleg.brutto,
                confidence: c.confidence,
                method: c.method,
                reason: c.reason,
                isPartial: c.isPartial || false
              }))
            })
          }
        }
      }
    }
    
    console.log(`[Matching Suggestions] ${suggestions.length} Vorschläge gefunden`)
    
    return NextResponse.json({
      ok: true,
      count: suggestions.length,
      suggestions
    })
    
  } catch (error: any) {
    console.error('[Matching Suggestions] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
