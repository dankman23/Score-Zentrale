/**
 * Smart Matching für Commerzbank-Zahlungen
 * 
 * Prüft gegen:
 * 1. Bekannte Kreditoren (IBAN, Name)
 * 2. Historische Zuordnungen (gelernte Regeln)
 * 3. Gehälter (Namen)
 * 
 * Erstellt Lern-Regeln für zukünftige Zuordnungen
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

async function main() {
  const client = await MongoClient.connect(MONGO_URL)
  const db = client.db(DB_NAME)
  
  console.log('🧠 Starte Smart Matching für Commerzbank-Zahlungen...\n')
  
  try {
    // Zeitraum von Kommandozeile
    const zeitraumVon = process.argv[2] || null
    const zeitraumBis = process.argv[3] || null
    
    let query = {
      $or: [
        { istZugeordnet: false },
        { istZugeordnet: { $exists: false } }
      ],
      zahlungsanbieter: 'Commerzbank',
      betrag: { $lt: 0 }  // Nur Ausgaben
    }
    
    if (zeitraumVon && zeitraumBis) {
      query.zahlungsdatum = {
        $gte: new Date(zeitraumVon + 'T00:00:00.000Z'),
        $lte: new Date(zeitraumBis + 'T23:59:59.999Z')
      }
      console.log(`📅 Zeitraum: ${zeitraumVon} bis ${zeitraumBis}\n`)
    }
    
    // 1. Lade nicht zugeordnete Commerzbank-Zahlungen
    const zahlungen = await db.collection('fibu_zahlungen').find(query).toArray()
    console.log(`📊 Gefunden: ${zahlungen.length} nicht zugeordnete Commerzbank-Ausgaben\n`)
    
    if (zahlungen.length === 0) {
      console.log('✅ Keine Zahlungen zur Zuordnung!')
      return
    }
    
    // 2. Lade Kreditoren
    const kreditoren = await db.collection('kreditoren').find({}).toArray()
    console.log(`👥 Verfügbare Kreditoren: ${kreditoren.length}`)
    
    // 3. Lade existierende Zuordnungsregeln
    const regeln = await db.collection('fibu_zuordnungsregeln').find({}).toArray()
    console.log(`📖 Bestehende Regeln: ${regeln.length}\n`)
    
    // 4. Lade historische Zuordnungen (aus erfolgreich zugeordneten Zahlungen)
    const historisch = await db.collection('fibu_zahlungen').find({
      zahlungsanbieter: 'Commerzbank',
      istZugeordnet: true,
      sachkonto: { $exists: true }
    }).toArray()
    console.log(`📚 Historische Zuordnungen: ${historisch.length}\n`)
    
    // 5. Matching durchführen
    const matches = {
      kreditor: [],        // Match mit Kreditor (IBAN/Name)
      regel: [],           // Match mit Lern-Regel
      historisch: [],      // Match mit historischer Zuordnung
      gehalt: [],          // Gehalt erkannt
      keineUebereinstimmung: []
    }
    
    for (const zahlung of zahlungen) {
      const match = await findeMatch(zahlung, kreditoren, regeln, historisch)
      
      if (match.typ === 'kreditor') {
        matches.kreditor.push({ zahlung, match })
      } else if (match.typ === 'regel') {
        matches.regel.push({ zahlung, match })
      } else if (match.typ === 'historisch') {
        matches.historisch.push({ zahlung, match })
      } else if (match.typ === 'gehalt') {
        matches.gehalt.push({ zahlung, match })
      } else {
        matches.keineUebereinstimmung.push({ zahlung, match })
      }
    }
    
    // 6. Statistik
    console.log('📊 MATCHING-ERGEBNISSE:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`👤 Kreditor-Match:           ${matches.kreditor.length}`)
    console.log(`📖 Regel-Match:              ${matches.regel.length}`)
    console.log(`📚 Historisch-Match:         ${matches.historisch.length}`)
    console.log(`💰 Gehalt:                   ${matches.gehalt.length}`)
    console.log(`❓ Keine Übereinstimmung:    ${matches.keineUebereinstimmung.length}`)
    console.log('═══════════════════════════════════════════════════════════════\n')
    
    // 7. Automatische Zuordnung (Kreditor + Regel + Gehalt)
    let autoZugeordnet = 0
    
    // Kreditor-Matches (hohe Confidence)
    for (const { zahlung, match } of matches.kreditor) {
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            kreditorKonto: match.kreditor.kreditorenNummer,
            kreditorName: match.kreditor.name,
            aufwandskonto: match.kreditor.standardAufwandskonto || '5200',
            istZugeordnet: true,
            zuordnungstyp: 'kreditor',
            zuordnungsmethode: 'smart-match-kreditor',
            matchReason: match.reason,
            zugeordnetAt: new Date()
          }
        }
      )
      autoZugeordnet++
    }
    
    // Regel-Matches
    for (const { zahlung, match } of matches.regel) {
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            sachkonto: match.regel.sachkonto,
            sachkontoBezeichnung: match.regel.bezeichnung,
            kreditorKonto: match.regel.kreditorKonto,
            istZugeordnet: true,
            zuordnungstyp: match.regel.kreditorKonto ? 'kreditor' : 'sachkonto',
            zuordnungsmethode: 'smart-match-regel',
            matchReason: match.reason,
            zugeordnetAt: new Date()
          }
        }
      )
      autoZugeordnet++
    }
    
    // Gehälter
    for (const { zahlung, match } of matches.gehalt) {
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            sachkonto: '6100',
            sachkontoBezeichnung: 'Löhne und Gehälter',
            mitarbeiter: match.mitarbeiter,
            istZugeordnet: true,
            zuordnungstyp: 'sachkonto',
            zuordnungsmethode: 'smart-match-gehalt',
            matchReason: match.reason,
            zugeordnetAt: new Date()
          }
        }
      )
      autoZugeordnet++
    }
    
    console.log(`✅ Automatisch zugeordnet: ${autoZugeordnet}\n`)
    
    // 8. Vorschläge speichern (Historisch + Keine Übereinstimmung)
    const vorschlaege = []
    
    for (const { zahlung, match } of matches.historisch) {
      vorschlaege.push({
        zahlungId: zahlung._id,
        zahlungBetrag: zahlung.betrag,
        zahlungDatum: zahlung.zahlungsdatum,
        empfaenger: zahlung.auftraggeber || zahlung.kundenName,
        iban: zahlung.iban,
        verwendungszweck: zahlung.verwendungszweck || zahlung.hinweis,
        
        vorschlagTyp: 'historisch',
        vorschlagSachkonto: match.historisch.sachkonto,
        vorschlagKreditor: match.historisch.kreditorKonto,
        vorschlagBezeichnung: match.historisch.sachkontoBezeichnung || match.historisch.kreditorName,
        vorschlagReason: match.reason,
        confidence: match.confidence,
        
        status: 'pending',
        createdAt: new Date()
      })
    }
    
    // Keine Übereinstimmung → Vorschlag zur manuellen Zuordnung
    for (const { zahlung, match } of matches.keineUebereinstimmung) {
      vorschlaege.push({
        zahlungId: zahlung._id,
        zahlungBetrag: zahlung.betrag,
        zahlungDatum: zahlung.zahlungsdatum,
        empfaenger: zahlung.auftraggeber || zahlung.kundenName,
        iban: zahlung.iban,
        verwendungszweck: zahlung.verwendungszweck || zahlung.hinweis,
        
        vorschlagTyp: 'manuell',
        status: 'pending',
        createdAt: new Date()
      })
    }
    
    if (vorschlaege.length > 0) {
      // Lösche alte Vorschläge für Commerzbank
      await db.collection('fibu_commerzbank_vorschlaege').deleteMany({})
      
      // Speichere neue
      await db.collection('fibu_commerzbank_vorschlaege').insertMany(vorschlaege)
      console.log(`📝 ${vorschlaege.length} Vorschläge zur manuellen Prüfung gespeichert\n`)
    }
    
    // 9. Beispiele anzeigen
    if (matches.kreditor.length > 0) {
      console.log('👤 KREDITOR-MATCHES (Top 5):')
      console.log('─────────────────────────────────────────────────────────────')
      matches.kreditor.slice(0, 5).forEach(({ zahlung, match }) => {
        console.log(`${match.kreditor.name}`)
        console.log(`   Betrag: ${zahlung.betrag.toFixed(2)}€`)
        console.log(`   Match: ${match.reason}`)
        console.log(`   Konto: ${match.kreditor.kreditorenNummer} → ${match.kreditor.standardAufwandskonto || '5200'}`)
        console.log()
      })
    }
    
    if (matches.regel.length > 0) {
      console.log('📖 REGEL-MATCHES (Top 5):')
      console.log('─────────────────────────────────────────────────────────────')
      matches.regel.slice(0, 5).forEach(({ zahlung, match }) => {
        console.log(`${zahlung.auftraggeber || zahlung.kundenName}`)
        console.log(`   Betrag: ${zahlung.betrag.toFixed(2)}€`)
        console.log(`   Match: ${match.reason}`)
        console.log(`   Konto: ${match.regel.sachkonto || match.regel.kreditorKonto}`)
        console.log()
      })
    }
    
    // 10. Zusammenfassung
    console.log('📈 ZUSAMMENFASSUNG:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Verarbeitet:             ${zahlungen.length}`)
    console.log(`Automatisch zugeordnet:  ${autoZugeordnet} (${Math.round((autoZugeordnet / zahlungen.length) * 100)}%)`)
    console.log(`Manuelle Prüfung:        ${vorschlaege.length}`)
    console.log('═══════════════════════════════════════════════════════════════')
    
  } finally {
    await client.close()
  }
}

/**
 * Findet beste Übereinstimmung für eine Zahlung
 */
async function findeMatch(zahlung, kreditoren, regeln, historisch) {
  const empfaenger = (zahlung.auftraggeber || zahlung.kundenName || '').toLowerCase()
  const verwendungszweck = (zahlung.verwendungszweck || zahlung.hinweis || '').toLowerCase()
  const iban = zahlung.iban || ''
  
  // 1. GEHALT-ERKENNUNG (höchste Priorität)
  if (empfaenger.includes('waller') || empfaenger.includes('angelika') || empfaenger.includes('dorothee')) {
    return {
      typ: 'gehalt',
      mitarbeiter: empfaenger,
      reason: `Mitarbeiter erkannt: ${empfaenger}`
    }
  }
  
  // 2. KREDITOR-MATCH (IBAN oder Name)
  for (const kreditor of kreditoren) {
    // IBAN-Match (höchste Confidence)
    if (iban && kreditor.iban && iban === kreditor.iban) {
      return {
        typ: 'kreditor',
        kreditor,
        reason: 'IBAN-Match (100%)',
        confidence: 100
      }
    }
    
    // Name-Match (fuzzy)
    const kreditorName = (kreditor.name || '').toLowerCase()
    if (kreditorName && empfaenger.includes(kreditorName)) {
      return {
        typ: 'kreditor',
        kreditor,
        reason: `Name-Match: ${kreditor.name}`,
        confidence: 90
      }
    }
    
    // Alias-Match (z.B. "KLINGSPOR" in "KLINGSPOR GmbH & Co.KG")
    const alias = kreditorName.split(' ')[0]  // Erstes Wort
    if (alias.length > 3 && empfaenger.includes(alias)) {
      return {
        typ: 'kreditor',
        kreditor,
        reason: `Name-Match (Alias): ${alias}`,
        confidence: 85
      }
    }
  }
  
  // 3. REGEL-MATCH (gelernte Regeln)
  for (const regel of regeln) {
    // IBAN-Match
    if (iban && regel.iban && iban === regel.iban) {
      return {
        typ: 'regel',
        regel,
        reason: 'Regel-Match (IBAN)',
        confidence: 100
      }
    }
    
    // Empfänger-Match
    if (regel.empfaengerPattern) {
      const pattern = new RegExp(regel.empfaengerPattern, 'i')
      if (pattern.test(empfaenger)) {
        return {
          typ: 'regel',
          regel,
          reason: `Regel-Match (Empfänger): ${regel.empfaengerPattern}`,
          confidence: 95
        }
      }
    }
    
    // Verwendungszweck-Match
    if (regel.verwendungszweckPattern) {
      const pattern = new RegExp(regel.verwendungszweckPattern, 'i')
      if (pattern.test(verwendungszweck)) {
        return {
          typ: 'regel',
          regel,
          reason: `Regel-Match (Verwendungszweck): ${regel.verwendungszweckPattern}`,
          confidence: 90
        }
      }
    }
  }
  
  // 4. HISTORISCH-MATCH (ähnliche Zahlung in der Vergangenheit)
  for (const hist of historisch) {
    const histEmpfaenger = (hist.auftraggeber || hist.kundenName || '').toLowerCase()
    const histIban = hist.iban || ''
    
    // IBAN-Match
    if (iban && histIban && iban === histIban) {
      return {
        typ: 'historisch',
        historisch: hist,
        reason: 'Historischer Match (IBAN)',
        confidence: 85
      }
    }
    
    // Empfänger-Match (exakt)
    if (histEmpfaenger && empfaenger && histEmpfaenger === empfaenger) {
      return {
        typ: 'historisch',
        historisch: hist,
        reason: `Historischer Match (Empfänger): ${empfaenger}`,
        confidence: 80
      }
    }
  }
  
  // 5. KEINE ÜBEREINSTIMMUNG
  return {
    typ: 'keine',
    reason: 'Keine Übereinstimmung gefunden'
  }
}

// Script ausführen
main().catch(console.error)
