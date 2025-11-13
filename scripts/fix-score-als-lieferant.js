#!/usr/bin/env node

/**
 * Fix: Score Schleifwerkzeuge als Lieferant
 * 
 * Markiert alle EK-Rechnungen wo "Score Schleifwerkzeuge" fälschlicherweise
 * als Lieferant erkannt wurde für Re-Parsing
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

async function main() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    
    console.log('=' .repeat(80))
    console.log('🔧 FIX: Score Schleifwerkzeuge als Lieferant')
    console.log('='.repeat(80))
    console.log()
    
    // Finde alle betroffenen Rechnungen
    const betroffene = await db.collection('fibu_ek_rechnungen').find({
      lieferantName: /Score.*Schleif/i
    }).toArray()
    
    console.log(`❌ ${betroffene.length} fehlerhafte Rechnungen gefunden`)
    console.log()
    
    if (betroffene.length === 0) {
      console.log('✅ Keine fehlerhaften Rechnungen - alles OK!')
      return
    }
    
    // Zeige Details
    console.log('Details:')
    const byMethod = {}
    betroffene.forEach(r => {
      const method = r.parsing?.method || 'unknown'
      byMethod[method] = (byMethod[method] || 0) + 1
    })
    
    Object.entries(byMethod).forEach(([method, count]) => {
      console.log(`  ${method}: ${count}`)
    })
    
    const totalBetrag = betroffene.reduce((sum, r) => sum + (r.gesamtBetrag || 0), 0)
    console.log(`  Gesamt-Betrag: ${totalBetrag.toFixed(2)}€`)
    console.log()
    
    // Frage Benutzer
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    console.log('⚠️  OPTIONEN:')
    console.log('  1) Löschen - Diese Rechnungen komplett entfernen')
    console.log('  2) Markieren - Für manuelles Re-Parsing markieren')
    console.log('  3) Abbrechen - Keine Änderungen')
    console.log()
    
    const answer = await new Promise((resolve) => {
      readline.question('Wähle Option (1/2/3): ', resolve)
    })
    
    readline.close()
    
    if (answer === '1') {
      console.log('\n🗑️  Lösche fehlerhafte Rechnungen...')
      
      const result = await db.collection('fibu_ek_rechnungen').deleteMany({
        lieferantName: /Score.*Schleif/i
      })
      
      console.log(`✅ ${result.deletedCount} Rechnungen gelöscht`)
      console.log(`💶 ${totalBetrag.toFixed(2)}€ aus Datenbank entfernt`)
      
    } else if (answer === '2') {
      console.log('\n🏷️  Markiere für Re-Parsing...')
      
      const result = await db.collection('fibu_ek_rechnungen').updateMany(
        { lieferantName: /Score.*Schleif/i },
        { 
          $set: { 
            needsManualReview: true,
            parsingError: 'Eigene Firma als Lieferant erkannt',
            needsReparse: true,
            updated_at: new Date()
          } 
        }
      )
      
      console.log(`✅ ${result.modifiedCount} Rechnungen markiert`)
      console.log('💡 Diese können später mit verbessertem Parser neu verarbeitet werden')
      
    } else {
      console.log('\n❌ Abgebrochen - keine Änderungen')
    }
    
    console.log()
    console.log('='.repeat(80))
    console.log('💡 HINWEIS: Gemini-Parser sollte verbessert werden!')
    console.log('   Prompt muss explizit sagen: "Score Schleifwerkzeuge ist NICHT der Lieferant"')
    console.log('='.repeat(80))
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
