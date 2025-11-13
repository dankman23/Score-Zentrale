#!/usr/bin/env node

/**
 * Setup Debitor-Sammelkonten
 * 
 * Erstellt die Sammelkonten für verschiedene Zahlungsarten
 * AUSNAHME: IGL-Kunden (Innergemeinschaftliche Lieferung mit USt-ID) bekommen eigene Debitoren
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

// Debitor-Sammelkonten nach Zahlungsart
const DEBITOR_SAMMELKONTEN = [
  { debitorNr: '69001', zahlungsart: 'Amazon Payment', beschreibung: 'Sammelkonto Amazon Payment' },
  { debitorNr: '69002', zahlungsart: 'Bar', beschreibung: 'Sammelkonto Bar' },
  { debitorNr: '69003', zahlungsart: 'eBay Managed Payments', beschreibung: 'Sammelkonto eBay Managed Payments' },
  { debitorNr: '69004', zahlungsart: 'eBay Rechnungskauf', beschreibung: 'Sammelkonto eBay Rechnungskauf' },
  { debitorNr: '69005', zahlungsart: 'EPS', beschreibung: 'Sammelkonto EPS' },
  { debitorNr: '69006', zahlungsart: 'GiroPay', beschreibung: 'Sammelkonto GiroPay' },
  { debitorNr: '69007', zahlungsart: 'Kaufland.de', beschreibung: 'Sammelkonto Kaufland.de' },
  { debitorNr: '69008', zahlungsart: 'Kreditkarte', beschreibung: 'Sammelkonto Kreditkarte' },
  { debitorNr: '69010', zahlungsart: 'Nachnahme', beschreibung: 'Sammelkonto Nachnahme' },
  { debitorNr: '69011', zahlungsart: 'Otto.de', beschreibung: 'Sammelkonto Otto.de' },
  { debitorNr: '69012', zahlungsart: 'Paypal', beschreibung: 'Sammelkonto Paypal' },
  { debitorNr: '69013', zahlungsart: 'PayPal Express', beschreibung: 'Sammelkonto PayPal Express' },
  { debitorNr: '69014', zahlungsart: 'Ratepay', beschreibung: 'Sammelkonto Ratepay' },
  { debitorNr: '69015', zahlungsart: 'Rechnung', beschreibung: 'Sammelkonto Rechnung' },
  { debitorNr: '69016', zahlungsart: 'Rechnungskauf', beschreibung: 'Sammelkonto Rechnungskauf' },
  { debitorNr: '69017', zahlungsart: 'Scheck', beschreibung: 'Sammelkonto Scheck' },
  { debitorNr: '69018', zahlungsart: 'Überweisung / Vorkasse', beschreibung: 'Sammelkonto Überweisung/Vorkasse' },
  { debitorNr: '69019', zahlungsart: 'Überweisung / Vorkasse mit 2% Skc', beschreibung: 'Sammelkonto Überweisung mit Skonto' },
  { debitorNr: '69020', zahlungsart: 'Mollie', beschreibung: 'Sammelkonto Mollie' },
  { debitorNr: '69022', zahlungsart: 'Apple Pay', beschreibung: 'Sammelkonto Apple Pay' }
]

async function main() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    
    console.log('='.repeat(80))
    console.log('📊 DEBITOR-SAMMELKONTEN SETUP')
    console.log('='.repeat(80))
    console.log()
    
    // Erstelle Collection für Debitor-Regeln
    const collection = db.collection('fibu_debitor_regeln')
    
    // Lösche alte Regeln
    await collection.deleteMany({})
    console.log('✅ Alte Regeln gelöscht')
    
    // Füge Sammelkonten hinzu
    for (const konto of DEBITOR_SAMMELKONTEN) {
      await collection.insertOne({
        ...konto,
        typ: 'sammelkonto',
        regel: 'zahlungsart_match',
        created_at: new Date()
      })
    }
    
    console.log(`✅ ${DEBITOR_SAMMELKONTEN.length} Sammelkonten angelegt`)
    console.log()
    
    // IGL-Regel (Ausnahme)
    await collection.insertOne({
      typ: 'igl_ausnahme',
      regel: 'eigener_debitor',
      beschreibung: 'IGL-Kunden mit USt-ID bekommen eigenen Debitor',
      bedingungen: {
        land_eu: true,
        ustId_vorhanden: true,
        mwst: 0
      },
      debitorNr_range: '10000-19999',
      created_at: new Date()
    })
    
    console.log('✅ IGL-Ausnahme-Regel angelegt')
    console.log()
    console.log('📋 REGEL-LOGIK:')
    console.log('─'.repeat(80))
    console.log('1. STANDARD: Alle Kunden → Sammelkonto nach Zahlungsart (69xxx)')
    console.log('2. AUSNAHME: IGL-Kunden (EU + USt-ID + MwSt=0) → Eigener Debitor (10xxx)')
    console.log()
    console.log('💡 IGL = Innergemeinschaftliche Lieferung')
    console.log('   - Land in EU')
    console.log('   - USt-ID vorhanden')
    console.log('   - MwSt = 0%')
    console.log('   → Brauchen eigenen Debitor für USt-ID-Hinterlegung')
    console.log()
    console.log('='.repeat(80))
    
    // Zähle VK-Rechnungen für Stats
    const vkTotal = await db.collection('fibu_vk_rechnungen').countDocuments({})
    const vkMitDebitor = await db.collection('fibu_vk_rechnungen').countDocuments({ 
      debitorKonto: { $ne: null } 
    })
    const vkOhneDebitor = vkTotal - vkMitDebitor
    
    console.log()
    console.log('📊 AKTUELLER STATUS:')
    console.log(`   Total VK-Rechnungen: ${vkTotal}`)
    console.log(`   ✅ Mit Debitor: ${vkMitDebitor}`)
    console.log(`   ⚠️  Ohne Debitor: ${vkOhneDebitor}`)
    
    if (vkOhneDebitor > 0) {
      console.log()
      console.log('💡 NÄCHSTER SCHRITT:')
      console.log('   node scripts/apply-debitor-regeln.js')
      console.log('   → Wendet die Regeln auf alle VK-Rechnungen an')
    }
    
    console.log()
    console.log('='.repeat(80))
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
