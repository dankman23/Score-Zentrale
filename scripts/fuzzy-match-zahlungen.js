/**
 * Fuzzy Matching für Zahlungen → Rechnungen
 * 
 * Findet automatisch passende Rechnungen für nicht zugeordnete Zahlungen
 * basierend auf: Betrag, Datum, Rechnungsnummer im Hinweis, Kunde
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

// Konfigurations-Parameter
const CONFIG = {
  betragTolerance: 5.0,        // ±5€ Abweichung erlaubt
  datumTolerance: 14,          // ±14 Tage Abweichung erlaubt
  minConfidence: 70,           // Mindest-Confidence für Auto-Match (0-100)
  manualConfidence: 50,        // Ab diesem Score manuelle Prüfung vorschlagen
  
  // Zeitraum (von Kommandozeile oder Standard: aktueller Monat)
  zeitraumVon: process.argv[2] || null,
  zeitraumBis: process.argv[3] || null
}

async function main() {
  const client = await MongoClient.connect(MONGO_URL)
  const db = client.db(DB_NAME)
  
  console.log('🔍 Starte Fuzzy Matching für Zahlungen...\n')
  
  try {
    // Zeitraum festlegen
    let query = {
      $or: [
        { istZugeordnet: false },
        { istZugeordnet: { $exists: false } },
        { kRechnung: 0 },
        { kRechnung: { $exists: false } }
      ]
    }
    
    if (CONFIG.zeitraumVon && CONFIG.zeitraumBis) {
      query.zahlungsdatum = {
        $gte: new Date(CONFIG.zeitraumVon + 'T00:00:00.000Z'),
        $lte: new Date(CONFIG.zeitraumBis + 'T23:59:59.999Z')
      }
      console.log(`📅 Zeitraum: ${CONFIG.zeitraumVon} bis ${CONFIG.zeitraumBis}\n`)
    } else {
      console.log('📅 Zeitraum: Alle Zahlungen (kein Filter)\n')
    }
    
    // 1. Lade alle nicht zugeordneten Zahlungen
    const zahlungen = await db.collection('fibu_zahlungen').find(query).toArray()
    
    console.log(`📊 Gefunden: ${zahlungen.length} nicht zugeordnete Zahlungen\n`)
    
    if (zahlungen.length === 0) {
      console.log('✅ Alle Zahlungen bereits zugeordnet!')
      return
    }
    
    // 2. Lade alle VK-Rechnungen
    const vkRechnungen = await db.collection('fibu_vk_rechnungen').find({}).toArray()
    console.log(`📄 Verfügbare VK-Rechnungen: ${vkRechnungen.length}\n`)
    
    // 3. Matching durchführen
    const matches = {
      autoMatched: [],
      manualReview: [],
      noMatch: []
    }
    
    for (const zahlung of zahlungen) {
      const match = findBestMatch(zahlung, vkRechnungen)
      
      if (match.confidence >= CONFIG.minConfidence) {
        matches.autoMatched.push({ zahlung, match })
      } else if (match.confidence >= CONFIG.manualConfidence) {
        matches.manualReview.push({ zahlung, match })
      } else {
        matches.noMatch.push({ zahlung, match })
      }
    }
    
    // 4. Ergebnisse anzeigen
    console.log('📊 MATCHING-ERGEBNISSE:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`✅ Auto-Match (Confidence ≥${CONFIG.minConfidence}%):     ${matches.autoMatched.length}`)
    console.log(`⚠️  Manuelle Prüfung (≥${CONFIG.manualConfidence}%):      ${matches.manualReview.length}`)
    console.log(`❌ Kein Match (<${CONFIG.manualConfidence}%):             ${matches.noMatch.length}`)
    console.log('═══════════════════════════════════════════════════════════════\n')
    
    // 5. Auto-Matches in DB speichern
    if (matches.autoMatched.length > 0) {
      console.log('💾 Speichere Auto-Matches...')
      
      for (const { zahlung, match } of matches.autoMatched) {
        await db.collection('fibu_zahlungen').updateOne(
          { _id: zahlung._id },
          {
            $set: {
              kRechnung: match.rechnung.kRechnung,
              rechnungsNr: match.rechnung.cRechnungsNr,
              istZugeordnet: true,
              matchedAt: new Date(),
              matchMethod: 'fuzzy-auto',
              matchConfidence: match.confidence,
              matchReasons: match.reasons
            }
          }
        )
      }
      
      console.log(`✅ ${matches.autoMatched.length} Zahlungen automatisch zugeordnet!\n`)
    }
    
    // 6. Manuelle Prüfungen in separater Collection speichern
    if (matches.manualReview.length > 0) {
      console.log('📝 Speichere Vorschläge für manuelle Prüfung...')
      
      // Lösche alte Vorschläge
      await db.collection('fibu_matching_vorschlaege').deleteMany({})
      
      // Speichere neue Vorschläge
      const vorschlaege = matches.manualReview.map(({ zahlung, match }) => ({
        zahlungId: zahlung._id,
        zahlungBetrag: zahlung.betrag,
        zahlungDatum: zahlung.zahlungsdatum,
        zahlungHinweis: zahlung.hinweis,
        
        rechnungId: match.rechnung._id,
        rechnungNr: match.rechnung.cRechnungsNr,
        rechnungBetrag: match.rechnung.brutto,
        rechnungDatum: match.rechnung.rechnungsdatum,
        
        confidence: match.confidence,
        reasons: match.reasons,
        status: 'pending',
        createdAt: new Date()
      }))
      
      await db.collection('fibu_matching_vorschlaege').insertMany(vorschlaege)
      console.log(`⚠️  ${matches.manualReview.length} Vorschläge für manuelle Prüfung gespeichert\n`)
    }
    
    // 7. Top 5 Auto-Matches anzeigen
    if (matches.autoMatched.length > 0) {
      console.log('🏆 TOP 5 AUTO-MATCHES:')
      console.log('─────────────────────────────────────────────────────────────')
      
      matches.autoMatched.slice(0, 5).forEach(({ zahlung, match }, idx) => {
        console.log(`${idx + 1}. ${match.rechnung.cRechnungsNr} (${match.confidence}% Confidence)`)
        console.log(`   Zahlung: ${zahlung.betrag.toFixed(2)}€ am ${new Date(zahlung.zahlungsdatum).toLocaleDateString('de-DE')}`)
        console.log(`   Rechnung: ${match.rechnung.brutto.toFixed(2)}€ am ${new Date(match.rechnung.rechnungsdatum).toLocaleDateString('de-DE')}`)
        console.log(`   Gründe: ${match.reasons.join(', ')}`)
        console.log()
      })
    }
    
    // 8. Statistik
    const totalMatched = matches.autoMatched.length
    const totalProcessed = zahlungen.length
    const successRate = Math.round((totalMatched / totalProcessed) * 100)
    
    console.log('📈 ZUSAMMENFASSUNG:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Verarbeitet:       ${totalProcessed}`)
    console.log(`Automatisch:       ${totalMatched} (${successRate}%)`)
    console.log(`Manuelle Prüfung:  ${matches.manualReview.length}`)
    console.log(`Nicht gefunden:    ${matches.noMatch.length}`)
    console.log('═══════════════════════════════════════════════════════════════')
    
  } finally {
    await client.close()
  }
}

/**
 * Findet beste Übereinstimmung für eine Zahlung
 */
function findBestMatch(zahlung, rechnungen) {
  const candidates = []
  
  for (const rechnung of rechnungen) {
    let score = 0
    const reasons = []
    
    // 1. Betrag-Matching (±5€ Toleranz)
    const betragDiff = Math.abs(zahlung.betrag - rechnung.brutto)
    if (betragDiff <= CONFIG.betragTolerance) {
      const betragScore = Math.max(0, 50 - (betragDiff * 10))
      score += betragScore
      reasons.push(`Betrag: ${betragDiff.toFixed(2)}€ Diff`)
    }
    
    // 2. Exakter Betrag = Bonus
    if (Math.abs(betragDiff) < 0.01) {
      score += 50
      reasons.push('Exakter Betrag!')
    }
    
    // 3. Datum-Matching (±14 Tage)
    const zahlungDate = new Date(zahlung.zahlungsdatum)
    const rechnungDate = new Date(rechnung.rechnungsdatum)
    const daysDiff = Math.abs((zahlungDate - rechnungDate) / (1000 * 60 * 60 * 24))
    
    if (daysDiff <= CONFIG.datumTolerance) {
      const datumScore = Math.max(0, 30 - (daysDiff * 2))
      score += datumScore
      reasons.push(`Datum: ${Math.round(daysDiff)} Tage Diff`)
    }
    
    // 4. Rechnungsnummer im Hinweis (SEHR STARK!)
    if (zahlung.hinweis && rechnung.cRechnungsNr) {
      const hinweis = zahlung.hinweis.toLowerCase()
      const rechnungsNr = rechnung.cRechnungsNr.toLowerCase()
      
      // Exakte Übereinstimmung
      if (hinweis.includes(rechnungsNr)) {
        score += 100
        reasons.push('RgNr im Hinweis (exakt)!')
      } else {
        // Fuzzy: Rechnungsnummer ohne RE-Prefix
        const rechnungsNrShort = rechnungsNr.replace(/^re[-\s]?/i, '')
        if (hinweis.includes(rechnungsNrShort)) {
          score += 80
          reasons.push('RgNr im Hinweis (fuzzy)')
        }
      }
    }
    
    // 5. Bestellnummer im Hinweis
    if (zahlung.hinweis && rechnung.cBestellNr) {
      const hinweis = zahlung.hinweis.toLowerCase()
      const bestellNr = rechnung.cBestellNr.toLowerCase()
      
      if (hinweis.includes(bestellNr)) {
        score += 60
        reasons.push('BestellNr im Hinweis')
      }
    }
    
    // 6. Kunden-Matching
    if (zahlung.kundenName && rechnung.kundenName) {
      const zahlungKunde = zahlung.kundenName.toLowerCase()
      const rechnungKunde = rechnung.kundenName.toLowerCase()
      
      if (zahlungKunde === rechnungKunde) {
        score += 30
        reasons.push('Kunde identisch')
      } else if (zahlungKunde.includes(rechnungKunde) || rechnungKunde.includes(zahlungKunde)) {
        score += 15
        reasons.push('Kunde ähnlich')
      }
    }
    
    // 7. Zahlungsart-Matching
    if (zahlung.zahlungsanbieter && rechnung.zahlungsart) {
      const zahlungsAnbieter = zahlung.zahlungsanbieter.toLowerCase()
      const zahlungsart = rechnung.zahlungsart.toLowerCase()
      
      if (zahlungsAnbieter.includes('paypal') && zahlungsart.includes('paypal')) {
        score += 10
        reasons.push('PayPal Match')
      } else if (zahlungsAnbieter.includes('amazon') && zahlungsart.includes('amazon')) {
        score += 10
        reasons.push('Amazon Match')
      } else if (zahlungsAnbieter.includes('ebay') && zahlungsart.includes('ebay')) {
        score += 10
        reasons.push('eBay Match')
      }
    }
    
    // Nur wenn es überhaupt Matching-Gründe gibt
    if (reasons.length > 0) {
      candidates.push({
        rechnung,
        confidence: Math.min(100, Math.round(score)),
        reasons
      })
    }
  }
  
  // Sortiere nach Confidence (höchste zuerst)
  candidates.sort((a, b) => b.confidence - a.confidence)
  
  // Beste Übereinstimmung oder null
  return candidates[0] || { rechnung: null, confidence: 0, reasons: [] }
}

// Script ausführen
main().catch(console.error)
