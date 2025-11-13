#!/usr/bin/env node

/**
 * FIBU Datenqualitäts-Check
 * 
 * Prüft alle FIBU-Daten auf Vollständigkeit und Korrektheit
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

async function main() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db(DB_NAME)
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 FIBU DATENQUALITÄTS-CHECK')
    console.log('='.repeat(60) + '\n')
    
    // 1. EK-RECHNUNGEN
    console.log('🔍 EK-Rechnungen (Lieferantenrechnungen)')
    console.log('-'.repeat(60))
    
    const ekTotal = await db.collection('fibu_ek_rechnungen').countDocuments({})
    const ekMitBetrag = await db.collection('fibu_ek_rechnungen').countDocuments({ 
      gesamtBetrag: { $gt: 0 } 
    })
    const ekOhneBetrag = ekTotal - ekMitBetrag
    const ekMitKreditor = await db.collection('fibu_ek_rechnungen').countDocuments({ 
      kreditorKonto: { $ne: null } 
    })
    const ekOhneKreditor = await db.collection('fibu_ek_rechnungen').countDocuments({ 
      kreditorKonto: null 
    })
    
    const ekSumme = await db.collection('fibu_ek_rechnungen').aggregate([
      { $match: { gesamtBetrag: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$gesamtBetrag' } } }
    ]).toArray()
    
    console.log(`  Total:            ${ekTotal}`)
    console.log(`  ✅ Mit Betrag:     ${ekMitBetrag} (${(ekMitBetrag/ekTotal*100).toFixed(1)}%)`)
    console.log(`  ❌ Ohne Betrag:    ${ekOhneBetrag} (${(ekOhneBetrag/ekTotal*100).toFixed(1)}%)`)
    console.log(`  ✅ Mit Kreditor:   ${ekMitKreditor} (${(ekMitKreditor/ekTotal*100).toFixed(1)}%)`)
    console.log(`  ⚠️  Ohne Kreditor: ${ekOhneKreditor} (${(ekOhneKreditor/ekTotal*100).toFixed(1)}%)`)
    if (ekSumme.length > 0) {
      console.log(`  💶 Gesamt-Betrag:  ${ekSumme[0].total.toFixed(2)}€`)
    }
    
    // Parsing-Methoden
    const ekByMethod = await db.collection('fibu_ek_rechnungen').aggregate([
      { $group: { _id: '$parsing.method', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray()
    
    console.log('\n  Parsing-Methoden:')
    ekByMethod.forEach(m => {
      const pct = (m.count / ekTotal * 100).toFixed(1)
      console.log(`    ${m._id || 'unknown'}: ${m.count} (${pct}%)`)
    })
    
    // 2. KREDITOREN
    console.log('\n🔍 Kreditoren')
    console.log('-'.repeat(60))
    
    const kredTotal = await db.collection('kreditoren').countDocuments({})
    console.log(`  Total: ${kredTotal} Kreditoren`)
    
    const kredByKonto = await db.collection('kreditoren').aggregate([
      { $group: { _id: '$standardAufwandskonto', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray()
    
    console.log('  Nach Aufwandskonto:')
    kredByKonto.forEach(k => {
      console.log(`    ${k._id}: ${k.count}`)
    })
    
    // 3. VK-RECHNUNGEN
    console.log('\n🔍 VK-Rechnungen (Verkaufsrechnungen)')
    console.log('-'.repeat(60))
    
    // Wir zählen aus JTL
    console.log('  (VK-Rechnungen kommen aus JTL-MSSQL)')
    console.log('  Prüfe: /api/fibu/rechnungen/vk?from=2025-01-01&to=2025-12-31')
    
    // 4. ZAHLUNGEN
    console.log('\n🔍 Zahlungen')
    console.log('-'.repeat(60))
    
    const zahlungenTotal = await db.collection('fibu_zahlungen').countDocuments({})
    console.log(`  JTL Zahlungen: ${zahlungenTotal}`)
    
    const bankTotal = await db.collection('fibu_bank_transaktionen').countDocuments({})
    console.log(`  Bank-Transaktionen: ${bankTotal}`)
    
    if (bankTotal === 0) {
      console.log('  ⚠️  WARNUNG: Keine Postbank-Transaktionen importiert!')
      console.log('     Bitte CSV über /fibu → Bank-Import hochladen')
    }
    
    // 5. PENDING ITEMS
    console.log('\n🔍 Pending Email-Inbox')
    console.log('-'.repeat(60))
    
    const inboxPending = await db.collection('fibu_email_inbox').countDocuments({ status: 'pending' })
    const inboxProcessed = await db.collection('fibu_email_inbox').countDocuments({ status: 'processed' })
    const inboxError = await db.collection('fibu_email_inbox').countDocuments({ status: 'error' })
    
    console.log(`  ✅ Processed: ${inboxProcessed}`)
    console.log(`  ⏳ Pending:   ${inboxPending}`)
    console.log(`  ❌ Error:     ${inboxError}`)
    
    // 6. QUALITÄTS-SCORE
    console.log('\n' + '='.repeat(60))
    console.log('📈 DATENQUALITÄTS-SCORE')
    console.log('='.repeat(60))
    
    let score = 0
    let maxScore = 0
    
    // EK mit Betrag
    maxScore += 20
    score += Math.round((ekMitBetrag / ekTotal) * 20)
    
    // EK mit Kreditor
    maxScore += 30
    score += Math.round((ekMitKreditor / ekTotal) * 30)
    
    // Keine Pending Emails
    maxScore += 10
    if (inboxPending === 0) score += 10
    
    // Bank-Transaktionen vorhanden
    maxScore += 20
    if (bankTotal > 0) score += 20
    
    // Kreditoren angelegt
    maxScore += 20
    if (kredTotal > 50) score += 20
    else score += Math.round((kredTotal / 50) * 20)
    
    const percentage = Math.round((score / maxScore) * 100)
    
    console.log(`\n  Score: ${score} / ${maxScore} Punkte (${percentage}%)`)
    
    if (percentage >= 90) {
      console.log('  ✅ AUSGEZEICHNET - Daten sind exportbereit!')
    } else if (percentage >= 70) {
      console.log('  ⚠️  GUT - Einige Verbesserungen empfohlen')
    } else if (percentage >= 50) {
      console.log('  ⚠️  BEFRIEDIGEND - Mehrere Probleme zu beheben')
    } else {
      console.log('  ❌ UNZUREICHEND - Viele Daten fehlen noch')
    }
    
    // 7. HANDLUNGSEMPFEHLUNGEN
    console.log('\n' + '='.repeat(60))
    console.log('💡 HANDLUNGSEMPFEHLUNGEN')
    console.log('='.repeat(60) + '\n')
    
    const recommendations = []
    
    if (ekOhneKreditor > 0) {
      recommendations.push(`⚠️  ${ekOhneKreditor} EK-Rechnungen ohne Kreditor → /fibu Tab "Kreditor-Zuordnung"`)
    }
    
    if (ekOhneBetrag > 0) {
      recommendations.push(`❌ ${ekOhneBetrag} EK-Rechnungen ohne Betrag → Re-Parsing oder manuell prüfen`)
    }
    
    if (bankTotal === 0) {
      recommendations.push(`❌ Keine Bank-Transaktionen → Postbank CSV über /fibu Tab "Bank-Import" hochladen`)
    }
    
    if (inboxPending > 0) {
      recommendations.push(`⏳ ${inboxPending} PDFs pending → Batch-Processing ausführen`)
    }
    
    if (recommendations.length === 0) {
      console.log('  ✅ Keine kritischen Probleme gefunden!')
      console.log('  ✅ System ist bereit für Tennet-Export')
    } else {
      recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`)
      })
    }
    
    console.log('\n' + '='.repeat(60) + '\n')
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
