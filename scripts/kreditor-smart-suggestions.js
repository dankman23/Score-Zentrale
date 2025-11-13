#!/usr/bin/env node

/**
 * Smart Kreditor Suggestions
 * 
 * Zeigt für jede unzugeordnete Rechnung die besten Kreditor-Matches
 * Hilft beim manuellen Zuordnen
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

function extractKeywords(text) {
  // Entferne häufige Wörter und extrahiere Schlüsselwörter
  const common = ['gmbh', 'co', 'kg', 'ag', 'gbr', 'ohg', 'und', 'der', 'die', 'das', 'ltd', 'inc', 'corp']
  const words = text.toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !common.includes(w))
  
  return words
}

function smartMatch(lieferant, kreditor) {
  const liefWords = extractKeywords(lieferant)
  const kredWords = extractKeywords(kreditor)
  
  if (liefWords.length === 0 || kredWords.length === 0) return 0
  
  let score = 0
  
  // Exakte Wort-Matches
  for (const lw of liefWords) {
    for (const kw of kredWords) {
      if (lw === kw) {
        score += 1.0
      } else if (lw.includes(kw) || kw.includes(lw)) {
        score += 0.7
      } else if (lw.substring(0, 3) === kw.substring(0, 3)) {
        score += 0.3
      }
    }
  }
  
  return score / Math.max(liefWords.length, kredWords.length)
}

async function main() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    
    // Lade Kreditoren
    const kreditoren = await db.collection('kreditoren').find({}).toArray()
    
    // Lade EK ohne Kreditor (Top 20)
    const rechnungen = await db.collection('fibu_ek_rechnungen')
      .find({ kreditorKonto: null, gesamtBetrag: { $gt: 0 } })
      .sort({ gesamtBetrag: -1 })
      .limit(20)
      .toArray()
    
    console.log('╔' + '═'.repeat(78) + '╗')
    console.log('║' + ' SMART KREDITOR SUGGESTIONS'.padEnd(78) + '║')
    console.log('╠' + '═'.repeat(78) + '╣')
    console.log('║ Top 20 Rechnungen ohne Kreditor (sortiert nach Betrag)'.padEnd(78) + '║')
    console.log('╚' + '═'.repeat(78) + '╝')
    console.log()
    
    for (let i = 0; i < rechnungen.length; i++) {
      const rechnung = rechnungen[i]
      
      // Finde beste Matches
      const matches = kreditoren.map(k => ({
        kreditor: k,
        score: smartMatch(rechnung.lieferantName, k.name)
      })).filter(m => m.score > 0.3).sort((a, b) => b.score - a.score).slice(0, 3)
      
      console.log(`${(i + 1).toString().padStart(2)}. ${rechnung.lieferantName}`)
      console.log(`    RgNr: ${rechnung.rechnungsNummer} | ${rechnung.gesamtBetrag.toFixed(2)}€ | ${new Date(rechnung.rechnungsdatum).toLocaleDateString('de-DE')}`)
      console.log(`    ID: ${rechnung._id}`)
      
      if (matches.length > 0) {
        console.log('    💡 Vorschläge:')
        matches.forEach((m, idx) => {
          const bar = '▓'.repeat(Math.floor(m.score * 10))
          console.log(`       ${idx + 1}) ${m.kreditor.name} (${m.kreditor.kreditorenNummer})`)
          console.log(`          ${bar} ${(m.score * 100).toFixed(0)}% | Konto: ${m.kreditor.standardAufwandskonto}`)
        })
      } else {
        console.log('    ⚠️  Keine Matches gefunden - manuell zuordnen oder neuen Kreditor anlegen')
      }
      
      console.log()
    }
    
    console.log('─'.repeat(80))
    console.log('💡 Tipp: Nutze /fibu → Kreditor-Zuordnung für interaktive Zuordnung')
    console.log('─'.repeat(80))
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
