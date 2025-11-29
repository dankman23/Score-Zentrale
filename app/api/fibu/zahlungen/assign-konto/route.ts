/**
 * POST /api/fibu/zahlungen/assign-konto
 * 
 * Ordnet einer Zahlung ein Konto zu und speichert dies als Lern-Regel
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { saveMatchingRule, saveMatchingHistory } from '../../../../../lib/fibu/learning-database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      zahlungId,
      anbieter,          // z.B. "PayPal", "Commerzbank"
      konto,             // SKR04 Kontonummer, z.B. "6825"
      steuer,            // Steuersatz, z.B. 19
      kontoBezeichnung,  // Optional
      saveAsRule = true, // Als Regel speichern für Learning
      pattern,           // Optional: Explizites Pattern
      matchType          // Optional: 'vendor', 'keyword', 'category'
    } = body
    
    // Validierung
    if (!zahlungId || !anbieter || !konto || steuer === undefined) {
      return NextResponse.json({
        ok: false,
        error: 'Fehlende Parameter: zahlungId, anbieter, konto, steuer'
      }, { status: 400 })
    }
    
    const db = await getDb()
    
    console.log(`[Assign Konto] Zahlung ${zahlungId} → Konto ${konto}`)
    
    // 1. Finde Zahlung in der entsprechenden Collection
    const collectionMap: Record<string, string> = {
      'amazon': 'fibu_amazon_settlements',
      'paypal': 'fibu_paypal_transactions',
      'commerzbank': 'fibu_bank_transaktionen',
      'postbank': 'fibu_bank_postbank',
      'mollie': 'mollie_payments'
    }
    
    const collectionName = collectionMap[anbieter.toLowerCase()]
    if (!collectionName) {
      return NextResponse.json({
        ok: false,
        error: `Unbekannter Anbieter: ${anbieter}`
      }, { status: 400 })
    }
    
    const collection = db.collection(collectionName)
    
    const zahlung = await collection.findOne({ _id: zahlungId })
    if (!zahlung) {
      return NextResponse.json({
        ok: false,
        error: `Zahlung ${zahlungId} nicht gefunden`
      }, { status: 404 })
    }
    
    // 2. Update Zahlung mit Konto-Zuordnung
    await collection.updateOne(
      { _id: zahlungId },
      {
        $set: {
          zuordnungsArt: 'konto',
          zugeordnetesKonto: konto,
          zugeordneterSteuersatz: steuer,
          kontoBezeichnung,
          zugeordnetAm: new Date(),
          zugeordnetDurch: 'manual'
        }
      }
    )
    
    console.log(`[Assign Konto] ✅ Zahlung aktualisiert`)
    
    // 3. Speichere als Matching-History
    const zahlungText = [
      zahlung.verwendungszweck,
      zahlung.beschreibung,
      zahlung.gegenpartei,
      zahlung.kategorie
    ]
      .filter(Boolean)
      .join(' ')
      .substring(0, 200)
    
    const historyId = await saveMatchingHistory(db, {
      zahlungId: zahlungId.toString(),
      zahlungBetrag: zahlung.betrag,
      zahlungDatum: zahlung.datumDate || zahlung.datum,
      zahlungText,
      matchMethod: 'manual',
      confidence: 'high',
      zuordnungsArt: 'konto',
      targetKonto: konto,
      isCorrect: null  // User kann später Feedback geben
    })
    
    console.log(`[Assign Konto] History gespeichert: ${historyId}`)
    
    // 4. Optional: Als Lern-Regel speichern
    if (saveAsRule) {
      // Ermittle Pattern
      let rulePattern = pattern
      let ruleMatchType = matchType || 'keyword'
      
      if (!rulePattern) {
        // Extrahiere Pattern aus Zahlungstext
        if (zahlung.kategorie) {
          rulePattern = zahlung.kategorie
          ruleMatchType = 'category'
        } else if (zahlung.gegenpartei) {
          rulePattern = zahlung.gegenpartei
          ruleMatchType = 'vendor'
        } else {
          // Nimm erste 50 Zeichen als Keyword
          rulePattern = zahlungText.substring(0, 50).trim()
          ruleMatchType = 'keyword'
        }
      }
      
      await saveMatchingRule(db, {
        pattern: rulePattern,
        matchType: ruleMatchType as any,
        targetKonto: konto,
        targetSteuersatz: steuer,
        kontoBezeichnung,
        confidence: 0.75,  // Manuelle Zuordnung startet mit 75% Confidence
        createdBy: 'manual',
        metadata: {
          anbieter,
          notes: `Manuell zugeordnet von User`
        }
      })
      
      console.log(`[Assign Konto] ✅ Lern-Regel gespeichert: "${rulePattern}" → ${konto}`)
    }
    
    return NextResponse.json({
      ok: true,
      message: `Zahlung erfolgreich Konto ${konto} zugeordnet`,
      historyId,
      ruleSaved: saveAsRule
    })
    
  } catch (error: any) {
    console.error('[Assign Konto] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
