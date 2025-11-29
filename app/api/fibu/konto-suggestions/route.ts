/**
 * GET /api/fibu/konto-suggestions
 * 
 * Liefert intelligente Konto-Vorschläge für nicht-zugeordnete Zahlungen
 * Nutzt 4-Stufen-Algorithmus: Category → Static → Learned → Vendor
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import { classifyKontoBulk } from '../../../../lib/fibu/konto-classifier'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.7')
    const anbieter = searchParams.get('anbieter')  // Optional: Filter nach Anbieter
    
    const db = await getDb()
    
    console.log('[Konto Suggestions] Lade Vorschläge...')
    console.log(`[Konto Suggestions] Params: limit=${limit}, minConfidence=${minConfidence}, anbieter=${anbieter}`)
    
    // Lade nicht-zugeordnete Zahlungen (die KEINE Rechnung haben, aber Konto brauchen)
    const zahlungsquellen = [
      { name: 'Amazon', collection: 'fibu_amazon_settlements' },
      { name: 'PayPal', collection: 'fibu_paypal_transactions' },
      { name: 'Commerzbank', collection: 'fibu_bank_transaktionen' },
      { name: 'Postbank', collection: 'fibu_bank_postbank' },
      { name: 'Mollie', collection: 'mollie_payments' }
    ]
    
    const suggestions: any[] = []
    
    for (const source of zahlungsquellen) {
      // Skip wenn Anbieter-Filter gesetzt und nicht matched
      if (anbieter && source.name.toLowerCase() !== anbieter.toLowerCase()) {
        continue
      }
      
      try {
        const collection = db.collection(source.collection)
        
        const query: any = {
          // Nicht zu Rechnung zugeordnet
          zuordnungsArt: { $ne: 'rechnung' },
          // Noch kein Konto zugeordnet ODER niedrige Confidence
          $or: [
            { zugeordnetesKonto: { $exists: false } },
            { zugeordnetesKonto: null },
            { zugeordnetesKonto: '' }
          ],
          // Ab Oktober 2025
          datumDate: { $gte: new Date('2025-10-01') }
        }
        
        if (source.name === 'Mollie') {
          query.status = { $in: ['paid', 'authorized'] }
        }
        
        const zahlungen = await collection.find(query).limit(limit).toArray()
        
        if (zahlungen.length === 0) {
          console.log(`[Konto Suggestions] ${source.name}: Keine Zahlungen gefunden`)
          continue
        }
        
        console.log(`[Konto Suggestions] ${source.name}: ${zahlungen.length} Zahlungen geladen`)
        
        // Klassifiziere alle Zahlungen
        const classified = await classifyKontoBulk(zahlungen, db, {
          minConfidence,
          parallel: true
        })
        
        // Nur erfolgreiche Klassifikationen
        const successful = classified.filter(c => c.suggestion !== null)
        
        console.log(`[Konto Suggestions] ${source.name}: ${successful.length}/${zahlungen.length} klassifiziert`)
        
        successful.forEach(c => {
          suggestions.push({
            zahlung: {
              _id: c.zahlung._id.toString(),
              anbieter: source.name,
              betrag: c.zahlung.betrag,
              datum: c.zahlung.datumDate || c.zahlung.datum,
              beschreibung: c.zahlung.verwendungszweck || c.zahlung.beschreibung,
              gegenpartei: c.zahlung.gegenpartei,
              kategorie: c.zahlung.kategorie
            },
            suggestion: c.suggestion
          })
        })
        
      } catch (err: any) {
        console.error(`[Konto Suggestions] Fehler bei ${source.name}:`, err.message)
      }
    }
    
    // Sortiere nach Confidence (höchste zuerst)
    suggestions.sort((a, b) => b.suggestion.confidence - a.suggestion.confidence)
    
    console.log(`[Konto Suggestions] ${suggestions.length} Vorschläge gefunden`)
    
    return NextResponse.json({
      ok: true,
      count: suggestions.length,
      suggestions,
      stats: {
        byMethod: suggestions.reduce((acc, s) => {
          acc[s.suggestion.method] = (acc[s.suggestion.method] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        avgConfidence: suggestions.length > 0
          ? suggestions.reduce((sum, s) => sum + s.suggestion.confidence, 0) / suggestions.length
          : 0
      }
    })
    
  } catch (error: any) {
    console.error('[Konto Suggestions] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
