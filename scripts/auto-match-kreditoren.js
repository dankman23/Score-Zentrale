#!/usr/bin/env node

/**
 * Auto-Match Kreditoren
 * 
 * Ordnet EK-Rechnungen automatisch Kreditoren zu basierend auf Lieferantenname
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

// Ähnlichkeits-Matching
function similarity(str1, str2) {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // Exakte Übereinstimmung
  if (s1 === s2) return 1.0
  
  // Einer enthält den anderen
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8
  }
  
  // Wort-basierte Ähnlichkeit
  const words1 = str1.toLowerCase().split(/\s+/)
  const words2 = str2.toLowerCase().split(/\s+/)
  
  let matches = 0
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1.length > 3 && w2.length > 3) {
        if (w1.includes(w2) || w2.includes(w1)) {
          matches++
        }
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length)
}

async function main() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden\n')
    
    const db = client.db(DB_NAME)
    
    // Lade alle Kreditoren
    const kreditoren = await db.collection('kreditoren').find({}).toArray()
    console.log(`📦 ${kreditoren.length} Kreditoren geladen\n`)
    
    // Lade EK-Rechnungen ohne Kreditor
    const rechnungen = await db.collection('fibu_ek_rechnungen').find({
      kreditorKonto: null,
      gesamtBetrag: { $gt: 0 }
    }).toArray()
    
    console.log(`📄 ${rechnungen.length} Rechnungen ohne Kreditor\n`)
    console.log('=' .repeat(80))
    console.log('🔍 STARTE AUTO-MATCHING')
    console.log('='.repeat(80) + '\n')
    
    let matched = 0
    let notMatched = 0
    const matches = []
    
    for (const rechnung of rechnungen) {
      let bestMatch = null
      let bestScore = 0
      
      // Finde besten Kreditor
      for (const kreditor of kreditoren) {
        const score = similarity(rechnung.lieferantName, kreditor.name)
        
        if (score > bestScore) {
          bestScore = score
          bestMatch = kreditor
        }
      }
      
      // Match nur wenn Score > 0.6 (ziemlich sicher)
      if (bestScore >= 0.6) {
        matches.push({
          rechnungId: rechnung._id,
          lieferant: rechnung.lieferantName,
          kreditor: bestMatch.kreditorenNummer,
          kreditorName: bestMatch.name,
          score: bestScore,
          betrag: rechnung.gesamtBetrag,
          rechnungsNr: rechnung.rechnungsNummer
        })
        matched++
      } else {
        notMatched++
      }
    }
    
    // Sortiere nach Score (beste zuerst)
    matches.sort((a, b) => b.score - a.score)
    
    // Zeige Matches
    console.log(`✅ ${matched} Matches gefunden (Score >= 0.6)`)
    console.log(`⚠️  ${notMatched} keine Matches (Score < 0.6)\n`)
    
    if (matches.length === 0) {
      console.log('Keine Auto-Matches möglich.\n')
      return
    }
    
    console.log('Top Matches:\n')
    matches.slice(0, 10).forEach((m, i) => {
      const scoreBar = '█'.repeat(Math.floor(m.score * 20))
      console.log(`${i + 1}. ${m.lieferant}`)
      console.log(`   → ${m.kreditorName} (${m.kreditor})`)
      console.log(`   Score: ${scoreBar} ${(m.score * 100).toFixed(0)}% | ${m.betrag.toFixed(2)}€`)
      console.log()
    })
    
    // Frage ob zuordnen
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    const answer = await new Promise((resolve) => {
      readline.question(`\n⚠️  Möchtest du alle ${matched} Matches automatisch zuordnen? (ja/nein): `, resolve)
    })
    
    readline.close()
    
    if (answer.toLowerCase() === 'ja' || answer.toLowerCase() === 'j') {
      console.log('\n📝 Ordne Kreditoren zu...\n')
      
      let success = 0
      let failed = 0
      
      for (const match of matches) {
        try {
          const result = await db.collection('fibu_ek_rechnungen').updateOne(
            { _id: match.rechnungId },
            { 
              $set: { 
                kreditorKonto: match.kreditor,
                needsManualReview: false,
                autoMatched: true,
                autoMatchScore: match.score,
                updated_at: new Date()
              } 
            }
          )
          
          if (result.modifiedCount > 0) {
            success++
            process.stdout.write('.')
          } else {
            failed++
            process.stdout.write('x')
          }
        } catch (error) {
          failed++
          process.stdout.write('!')
        }
      }
      
      console.log('\n')
      console.log('='.repeat(80))
      console.log(`✅ ${success} Kreditoren erfolgreich zugeordnet`)
      console.log(`❌ ${failed} Fehler`)
      console.log('='.repeat(80))
      
      // Zeige neuen Status
      const ohneKreditor = await db.collection('fibu_ek_rechnungen').countDocuments({
        kreditorKonto: null,
        gesamtBetrag: { $gt: 0 }
      })
      
      console.log(`\n📊 Neue Statistik:`)
      console.log(`   Noch ${ohneKreditor} Rechnungen ohne Kreditor`)
      
    } else {
      console.log('\n❌ Abgebrochen - keine Änderungen vorgenommen')
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
