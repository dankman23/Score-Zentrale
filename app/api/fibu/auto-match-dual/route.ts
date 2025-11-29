/**
 * POST /api/fibu/auto-match-dual
 * 
 * Verbesserte Auto-Match-Logik mit DUAL-Zuordnung
 * Findet BELEG + KONTO gleichzeitig für jede Zahlung
 * 
 * ERGÄNZT die bestehende /api/fibu/auto-match (löscht sie NICHT!)
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import { findDualMatch } from '../../../../lib/fibu/dual-matcher'
import { mapZahlung } from '../../../../lib/fibu/zahlung-mapper'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { zeitraum, dryRun = false, limit } = body
    
    const db = await getDb()
    
    // Zeitraum
    let startDate, endDate
    if (zeitraum) {
      const [from, to] = zeitraum.split('_')
      startDate = new Date(from)
      endDate = new Date(to + 'T23:59:59.999Z')
    } else {
      endDate = new Date()
      startDate = new Date('2025-10-01')  // Default: ab Oktober 2025
    }
    
    console.log('[Dual-Match] Starte für Zeitraum:', startDate.toISOString().split('T')[0], 'bis', endDate.toISOString().split('T')[0])
    
    const results = {
      zeitraum: { from: startDate, to: endDate },
      matched: [] as any[],
      stats: {
        totalZahlungen: 0,
        mitBeleg: 0,
        mitKonto: 0,
        mitBeidem: 0,
        ohneZuordnung: 0,
        byAnbieter: {} as Record<string, any>,
        byBelegMethod: {} as Record<string, number>,
        byKontoMethod: {} as Record<string, number>
      }
    }
    
    // Lade alle Rechnungen einmal
    const rechnungenColl = db.collection('fibu_rechnungen_alle')
    const alleRechnungen = await rechnungenColl.find({}).toArray()
    const vkRechnungen = alleRechnungen.filter(r => r.belegnummer?.startsWith('RE'))
    
    console.log(`[Dual-Match] ${alleRechnungen.length} Rechnungen geladen (${vkRechnungen.length} VK)`)
    
    // Zahlungsquellen
    const sources = [
      { name: 'Amazon', collection: 'fibu_amazon_settlements' },
      { name: 'PayPal', collection: 'fibu_paypal_transactions' },
      { name: 'Commerzbank', collection: 'fibu_bank_transaktionen' },
      { name: 'Postbank', collection: 'fibu_bank_postbank' },
      { name: 'Mollie', collection: 'mollie_payments' }
    ]
    
    for (const source of sources) {
      const collection = db.collection(source.collection)
      
      // Lade alle Zahlungen ab Oktober 2025
      let query: any = {
        datumDate: {
          $gte: startDate,
          $lte: endDate
        }
      }
      
      if (source.name === 'Mollie') {
        query.status = { $in: ['paid', 'authorized'] }
      }
      
      const findQuery = collection.find(query)
      
      if (limit) {
        findQuery.limit(limit)
      }
      
      const zahlungen = await findQuery.toArray()
      results.stats.totalZahlungen += zahlungen.length
      results.stats.byAnbieter[source.name] = {
        total: zahlungen.length,
        mitBeleg: 0,
        mitKonto: 0,
        mitBeidem: 0,
        ohne: 0
      }
      
      console.log(`[Dual-Match] ${source.name}: ${zahlungen.length} Zahlungen`)
      
      let processed = 0
      
      for (const zahlung of zahlungen) {
        processed++
        
        // Log Fortschritt alle 100 Zahlungen
        if (processed % 100 === 0) {
          console.log(`[Dual-Match] ${source.name}: ${processed}/${zahlungen.length}`)
        }
        
        // Finde BELEG + KONTO
        const dualMatch = await findDualMatch(
          zahlung,
          alleRechnungen,
          vkRechnungen,
          db,
          source.name
        )
        
        // Statistik
        if (dualMatch.beleg.found) {
          results.stats.mitBeleg++
          results.stats.byAnbieter[source.name].mitBeleg++
          
          if (dualMatch.beleg.method) {
            results.stats.byBelegMethod[dualMatch.beleg.method] = 
              (results.stats.byBelegMethod[dualMatch.beleg.method] || 0) + 1
          }
        }
        
        if (dualMatch.konto.found) {
          results.stats.mitKonto++
          results.stats.byAnbieter[source.name].mitKonto++
          
          if (dualMatch.konto.method) {
            results.stats.byKontoMethod[dualMatch.konto.method] = 
              (results.stats.byKontoMethod[dualMatch.konto.method] || 0) + 1
          }
        }
        
        if (dualMatch.beleg.found && dualMatch.konto.found) {
          results.stats.mitBeidem++
          results.stats.byAnbieter[source.name].mitBeidem++
        }
        
        if (!dualMatch.beleg.found && !dualMatch.konto.found) {
          results.stats.ohneZuordnung++
          results.stats.byAnbieter[source.name].ohne++
        }
        
        // Speichere Match
        if (dualMatch.beleg.found || dualMatch.konto.found) {
          results.matched.push({
            zahlungId: zahlung._id.toString(),
            anbieter: source.name,
            betrag: zahlung.betrag,
            datum: zahlung.datumDate || zahlung.datum,
            beleg: dualMatch.beleg,
            konto: dualMatch.konto
          })
          
          // Update in DB (wenn nicht Dry-Run)
          if (!dryRun) {
            const updateFields: any = {
              istZugeordnet: true,
              zuordnungsDatum: new Date()
            }
            
            // Beleg-Zuordnung
            if (dualMatch.beleg.found) {
              updateFields.belegId = dualMatch.beleg.rechnungId
              updateFields.belegNr = dualMatch.beleg.rechnungsNr
              updateFields.belegZuordnungsMethode = dualMatch.beleg.method
            }
            
            // Konto-Zuordnung
            if (dualMatch.konto.found) {
              updateFields.zugeordnetesKonto = dualMatch.konto.konto
              updateFields.zugeordneterSteuersatz = dualMatch.konto.steuer
              updateFields.kontoBezeichnung = dualMatch.konto.bezeichnung
              updateFields.kontoZuordnungsMethode = dualMatch.konto.method
            }
            
            // Legacy: zuordnungsArt (für Abwärtskompatibilität)
            if (dualMatch.beleg.found && dualMatch.konto.found) {
              updateFields.zuordnungsArt = 'beides'
            } else if (dualMatch.beleg.found) {
              updateFields.zuordnungsArt = 'rechnung'
            } else if (dualMatch.konto.found) {
              updateFields.zuordnungsArt = 'konto'
            }
            
            await collection.updateOne(
              { _id: zahlung._id },
              { $set: updateFields }
            )
          }
        }
      }
    }
    
    console.log('[Dual-Match] Fertig! Stats:', results.stats)
    
    return NextResponse.json({
      ok: true,
      ...results
    })
    
  } catch (error: any) {
    console.error('[Dual-Match] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
