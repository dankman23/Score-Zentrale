export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

/**
 * POST /api/fibu/auto-match
 * 
 * Automatische Zuordnung von Zahlungen zu:
 * 1. VK-Rechnungen (über AU-Nummer, RE-Nummer, Betrag)
 * 2. Konten (über Kategorie, z.B. Amazon Gebühren)
 * 
 * Matching-Strategien:
 * - Mollie/PayPal: referenz (AU-Nummer) → VK-Rechnung
 * - Bank: RE-Nummer im Verwendungszweck → VK-Rechnung
 * - Amazon Gebühren: kategorie → Kontenplan
 * - Betrag + Datum Matching als Fallback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { zeitraum, dryRun = false, limit } = body
    
    const db = await getDb()
    
    // WICHTIG: Auto-Match läuft über ALLE nicht-zugeordneten Daten, nicht nur Zeitraum!
    // Zeitraum wird nur für Statistik-Ausgabe verwendet
    let startDate, endDate
    if (zeitraum) {
      const [from, to] = zeitraum.split('_')
      startDate = new Date(from)
      endDate = new Date(to + 'T23:59:59.999Z')
    } else {
      // Default: letzter Monat
      endDate = new Date()
      startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 1)
    }
    
    console.log('[Auto-Match] Starte für ALLE nicht-zugeordneten Daten (Statistik-Zeitraum:', startDate.toISOString().split('T')[0], 'bis', endDate.toISOString().split('T')[0], ')')
    
    const results = {
      zeitraum: { from: startDate, to: endDate },
      matched: [],
      stats: {
        totalZahlungen: 0,
        matched: 0,
        byMethod: {
          auNummerDirekt: 0,
          auNummerBetragDatum: 0,
          amazonOrderIdXRE: 0,
          reNummer: 0,
          betragDatum: 0,
          kategorie: 0
        },
        byAnbieter: {}
      },
      dryRun
    }
    
    // Lade Zahlungen aus allen Quellen
    const sources = [
      { name: 'Amazon', collection: 'fibu_amazon_settlements' },
      { name: 'PayPal', collection: 'fibu_paypal_transactions' },
      { name: 'Commerzbank', collection: 'fibu_commerzbank_transactions' },
      { name: 'Postbank', collection: 'fibu_postbank_transactions' },
      { name: 'Mollie', collection: 'fibu_mollie_transactions' }
    ]
    
    // Lade ALLE VK-Rechnungen ab Oktober 2025
    // Grund: Zahlungen können vor der Rechnung kommen (z.B. PayPal bei Bestellung, Rechnung erst bei Versand)
    const vkRechnungen = await db.collection('fibu_vk_rechnungen')
      .find({
        rechnungsdatum: {
          $gte: new Date('2025-10-01') // Nur ab Oktober 2025
        }
      })
      .toArray()
    
    console.log('[Auto-Match] Geladene VK-Rechnungen:', vkRechnungen.length, '(ab Okt 2025)')
    
    // Lade ALLE Rechnungen (inkl. externe XRE und Auftragnummern)
    const alleRechnungen = await db.collection('fibu_rechnungen_alle')
      .find({
        belegdatum: {
          $gte: new Date('2025-10-01')
        }
      })
      .toArray()
    
    console.log('[Auto-Match] Geladene alle Rechnungen:', alleRechnungen.length, '(inkl. externe XRE)')
    
    // Lade Kontenplan für Amazon Gebühren
    const kontenplan = await db.collection('fibu_kontenplan').find({}).toArray()
    console.log('[Auto-Match] Kontenplan geladen:', kontenplan.length, 'Konten')
    
    // Verarbeite jede Zahlungsquelle
    for (const source of sources) {
      const collection = db.collection(source.collection)
      
      // Lade ALLE nicht-zugeordneten Zahlungen ab Oktober 2025
      let query: any = {
        istZugeordnet: { $ne: true }, // Nur nicht-zugeordnete
        datumDate: {
          $gte: new Date('2025-10-01') // Nur ab Oktober 2025
        }
      }
      
      // Mollie: nur erfolgreiche
      if (source.name === 'Mollie') {
        query.status = { $in: ['paid', 'authorized'] }
      }
      
      const zahlungen = await collection.find(query).toArray()
      results.stats.totalZahlungen += zahlungen.length
      results.stats.byAnbieter[source.name] = { total: zahlungen.length, matched: 0 }
      
      console.log(`[Auto-Match] ${source.name}: ${zahlungen.length} Zahlungen geladen`)
      
      // Matche jede Zahlung
      let skippedCount = 0
      for (const zahlung of zahlungen) {
        // Skip wenn bereits zugeordnet
        if (zahlung.istZugeordnet) {
          skippedCount++
          continue
        }
        
        let match = null
        let method = ''
        
        // Strategie 1: AU-Nummer Matching (Mollie, PayPal)
        if (source.name === 'Mollie' || source.name === 'PayPal') {
          // Extrahiere AU-Nummer aus verschiedenen Feldern
          let auNummer = null
          
          if (source.name === 'Mollie') {
            // Mollie: AU-Nummer kann in verwendungszweck sein
            auNummer = extractAuNummer(zahlung.verwendungszweck || zahlung.beschreibung)
          } else if (source.name === 'PayPal') {
            // PayPal: rechnungsNr ist direkt die AU-Nummer
            auNummer = zahlung.rechnungsNr
          }
          
          if (auNummer) {
            // Suche Rechnung mit passender AU-Nummer über cBestellNr
            // Für JTL: AU_XXXXX_SW6 oder AU2025-XXXXX format
            const auMatch = auNummer.match(/AU[_-]?(\d+)/)
            if (auMatch) {
              const auNr = auMatch[1]
              
              // NEUE Strategie: Direktes Matching über cBestellNr in fibu_rechnungen_alle
              let direktMatch = alleRechnungen.find(r => {
                const bestellnr = r.cBestellNr || ''
                // Match: AU_12345_SW6 oder AU2025-12345
                return bestellnr.includes(`AU_${auNr}_`) || 
                       bestellnr.includes(`AU2025-${auNr}`) ||
                       bestellnr.includes(`AU-${auNr}`)
              })
              
              if (direktMatch) {
                match = {
                  type: 'rechnung',
                  rechnungId: direktMatch.uniqueId,
                  rechnungsNr: direktMatch.belegnummer,
                  confidence: 'high'
                }
                method = 'auNummerDirekt'
              } else {
                // Fallback: Betrag + Datum Matching
                const rechnungCandidates = vkRechnungen
                  .filter(r => {
                    const betragMatch = Math.abs((r.brutto || 0) - Math.abs(zahlung.betrag)) < 0.50 // 50 Cent Toleranz
                    const dateDiff = Math.abs(new Date(r.rechnungsdatum).getTime() - new Date(zahlung.datum || zahlung.datumDate).getTime())
                    const daysDiff = dateDiff / (1000 * 60 * 60 * 24)
                    
                    return betragMatch && daysDiff <= 60 // 60 Tage Toleranz
                  })
                  .map(r => {
                    // Score: je niedriger, desto besser
                    const betragDiff = Math.abs((r.brutto || 0) - Math.abs(zahlung.betrag))
                    const dateDiff = Math.abs(new Date(r.rechnungsdatum).getTime() - new Date(zahlung.datum || zahlung.datumDate).getTime())
                    const daysDiff = dateDiff / (1000 * 60 * 60 * 24)
                    const score = betragDiff + daysDiff * 0.1 // Betrag wichtiger als Datum
                    
                    return { rechnung: r, score, betragDiff, daysDiff }
                  })
                  .sort((a, b) => a.score - b.score) // Bester zuerst
                
                // Nehme besten Kandidaten wenn Score < 1.0
                if (rechnungCandidates.length > 0) {
                  const best = rechnungCandidates[0]
                  
                  if (best.score < 1.0) { // Max 1€ Diff + 10 Tage
                    match = {
                      type: 'rechnung',
                      rechnungId: best.rechnung._id.toString(),
                      rechnungsNr: best.rechnung.cRechnungsNr || best.rechnung.rechnungsNr,
                      confidence: best.score < 0.25 ? 'high' : 'medium'
                    }
                    method = 'auNummerBetragDatum'
                  }
                }
              }
            }
          }
        }
        
        // Strategie 2: RE-Nummer Matching (Bank-Zahlungen)
        if (!match && (source.name === 'Commerzbank' || source.name === 'Postbank')) {
          const verwendungszweck = zahlung.verwendungszweck || ''
          const reMatch = verwendungszweck.match(/RE\s*(\d{4}[-\s]?\d+)/i)
          
          if (reMatch) {
            const reNummer = reMatch[0].replace(/\s/g, '')
            
            // Suche Rechnung mit dieser RE-Nummer
            const rechnung = vkRechnungen.find(r => {
              const rgNr = (r.cRechnungsNr || r.rechnungsNr || '').replace(/\s/g, '')
              return rgNr.toLowerCase().includes(reNummer.toLowerCase())
            })
            
            if (rechnung) {
              match = {
                type: 'rechnung',
                rechnungId: rechnung._id.toString(),
                rechnungsNr: rechnung.cRechnungsNr || rechnung.rechnungsNr,
                confidence: 'high'
              }
              method = 'reNummer'
            }
          }
        }
        
        // Strategie 3: Amazon → Externe Rechnungen (XRE) oder normale Rechnungen
        if (!match && source.name === 'Amazon') {
          const kategorie = zahlung.amountType || zahlung.kategorie
          const orderId = zahlung.orderId
          const merchantOrderId = zahlung.merchantOrderId
          
          // 3a) Suche externe Rechnung (XRE) über Order-ID
          if (orderId || merchantOrderId) {
            // Suche in fibu_rechnungen_alle nach externen Rechnungen
            const externeRechnung = alleRechnungen.find(r => {
              if (r.quelle !== 'EXTERN') return false
              
              // Match über cBestellNr oder Herkunft
              const bestellnr = r.cBestellNr || ''
              const herkunft = r.herkunft || ''
              
              return (orderId && (bestellnr.includes(orderId) || herkunft.includes(orderId))) ||
                     (merchantOrderId && (bestellnr.includes(merchantOrderId) || herkunft.includes(merchantOrderId)))
            })
            
            if (externeRechnung) {
              match = {
                type: 'rechnung',
                rechnungId: externeRechnung.uniqueId,
                rechnungsNr: externeRechnung.belegnummer,
                confidence: 'high'
              }
              method = 'amazonOrderIdXRE'
            }
          }
          
          // 3b) ItemPrice (Verkaufserlöse) → Versuche normale Rechnung zu finden
          if (!match && kategorie === 'ItemPrice' && orderId) {
            // Suche Rechnung mit ähnlichem Betrag und Zeitraum
            const rechnungCandidates = vkRechnungen.filter(r => {
              const betragMatch = Math.abs((r.brutto || 0) - Math.abs(zahlung.betrag)) < 0.50
              const dateDiff = Math.abs(new Date(r.rechnungsdatum).getTime() - new Date(zahlung.datum || zahlung.datumDate).getTime())
              const daysDiff = dateDiff / (1000 * 60 * 60 * 24)
              
              return betragMatch && daysDiff <= 30
            })
            
            // Nur zuordnen wenn eindeutig (genau 1 Match)
            if (rechnungCandidates.length === 1) {
              match = {
                type: 'rechnung',
                rechnungId: rechnungCandidates[0]._id.toString(),
                rechnungsNr: rechnungCandidates[0].cRechnungsNr || rechnungCandidates[0].rechnungsNr,
                confidence: 'medium'
              }
              method = 'betragDatum'
            }
          }
          
          // 3b) Gebühren/Kosten → Kontenplan
          if (!match && kategorie) {
            // Mapping: Amazon Kategorie → Sachkonto
            const kontoMapping: {[key: string]: string} = {
              'ItemFees': '4910', // Sonstige betriebliche Aufwendungen - Verkaufsgebühren
              'FBAPerUnitFulfillmentFee': '4950', // Amazon FBA Gebühren
              'Commission': '4970', // Provisionen
              'ShippingHB': '4800', // Frachtkosten
              'Shipping': '4800',
              'RefundCommission': '4970',
              'ServiceFee': '4910',
              'FBAWeightBasedFee': '4950',
              'StorageFee': '4950',
              'Goodwill': '4960', // Kulanz
              'AdvertisingFee': '4630' // Werbekosten
            }
            
            const sachkonto = kontoMapping[kategorie]
            
            if (sachkonto) {
              const konto = kontenplan.find(k => 
                k.kontonummer === sachkonto || 
                k.kontoNr === sachkonto || 
                k.nummer === sachkonto
              )
              
              if (konto) {
                match = {
                  type: 'konto',
                  sachkonto: sachkonto,
                  kontoName: konto.bezeichnung || konto.name,
                  confidence: 'high'
                }
                method = 'kategorie'
              } else {
                // Auch ohne Konto-Details zuordnen (Konto existiert im SKR)
                match = {
                  type: 'konto',
                  sachkonto: sachkonto,
                  kontoName: kategorie, // Fallback: Kategorie als Name
                  confidence: 'medium'
                }
                method = 'kategorie'
              }
            }
          }
        }
        
        // Debug: Log wenn keine Matches gefunden
        if (!match && source.name === 'PayPal' && zahlungen.indexOf(zahlung) < 3) {
          console.log(`[Auto-Match DEBUG] PayPal Zahlung ${zahlung.transactionId}: Kein Match`, {
            rechnungsNr: zahlung.rechnungsNr,
            verwendungszweck: zahlung.verwendungszweck,
            betreff: zahlung.betreff,
            betrag: zahlung.betrag
          })
        }
        
        // Speichere Match
        if (match) {
          results.matched.push({
            zahlungId: zahlung._id.toString(),
            anbieter: source.name,
            transaktionsId: zahlung.transactionId,
            betrag: zahlung.betrag,
            datum: zahlung.datum || zahlung.datumDate,
            match,
            method
          })
          
          results.stats.matched++
          results.stats.byMethod[method]++
          results.stats.byAnbieter[source.name].matched++
          
          // Speichere Zuordnung in DB (wenn nicht Dry-Run)
          if (!dryRun) {
            await collection.updateOne(
              { _id: zahlung._id },
              {
                $set: {
                  istZugeordnet: true,
                  zugeordneteRechnung: match.type === 'rechnung' ? match.rechnungsNr : null,
                  zugeordnetesKonto: match.type === 'konto' ? match.sachkonto : null,
                  zuordnungsArt: match.type,
                  zuordnungsMethode: method,
                  zuordnungsDatum: new Date()
                }
              }
            )
          }
        }
      }
    }
    
    console.log('[Auto-Match] Ergebnis:', results.stats)
    
    return NextResponse.json({
      ok: true,
      ...results
    })
    
  } catch (error: any) {
    console.error('[Auto-Match] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Extrahiert AU-Nummer aus Verwendungszweck
 */
function extractAuNummer(text: string): string | null {
  if (!text) return null
  
  const match = text.match(/AU[_-]?\d+[_-]?SW\d+/i)
  return match ? match[0] : null
}
