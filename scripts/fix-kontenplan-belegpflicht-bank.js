/**
 * Korrektur: Bank-Konten vs. Debitoren-Belegpflicht
 * 
 * BANK-KONTEN (keine Belegpflicht):
 * - 1600 Kasse
 * - 1701 Postbank
 * - 1801 PayPal SCORE
 * - 1802 Commerzbank
 * - 1810 eBay-Konto
 * - 1820 PayPal-Konto
 * - 1825 Amazon-Konto
 * - 1830 Mollie-Konto
 * 
 * DEBITOREN (MIT Belegpflicht):
 * - 69001-69020 (alle Sammeldebitoren)
 */

const { MongoClient } = require('mongodb')
const fs = require('fs')

const envContent = fs.readFileSync('/app/.env', 'utf-8')
const MONGO_URL = envContent.match(/MONGO_URL=(.+)/)?.[1]

// Bank-/Zahlungskonten: KEINE Belegpflicht
const BANK_KONTEN = {
  '1600': { bezeichnung: 'Kasse', belegpflicht: false },
  '1701': { bezeichnung: '1 Postbank', belegpflicht: false },
  '1801': { bezeichnung: '1a PayPal SCORE', belegpflicht: false },
  '1802': { bezeichnung: 'Commerzbank Girokonto', belegpflicht: false },
  '1810': { bezeichnung: 'eBay-Konto', belegpflicht: false },
  '1820': { bezeichnung: 'PayPal-Konto', belegpflicht: false },
  '1825': { bezeichnung: 'Amazon-Konto', belegpflicht: false },
  '1830': { bezeichnung: 'Mollie-Konto', belegpflicht: false }
}

// Debitoren: MIT Belegpflicht + Bankkonto-Zuordnung
const DEBITOREN = {
  '69001': { bezeichnung: 'Amazon (1825)', belegpflicht: true },
  '69002': { bezeichnung: 'Bar (1600)', belegpflicht: true },
  '69003': { bezeichnung: 'eBay Managed Payments (1810)', belegpflicht: true },
  '69005': { bezeichnung: 'EPS', belegpflicht: true },
  '69006': { bezeichnung: 'GiroPay', belegpflicht: true },
  '69007': { bezeichnung: 'Kaufland.de', belegpflicht: true },
  '69008': { bezeichnung: 'Kreditkarte', belegpflicht: true },
  '69010': { bezeichnung: 'Nachnahme', belegpflicht: true },
  '69011': { bezeichnung: 'Otto.de', belegpflicht: true },
  '69012': { bezeichnung: 'PayPal (1801)', belegpflicht: true },
  '69013': { bezeichnung: 'PayPal Express (1801)', belegpflicht: true },
  '69014': { bezeichnung: 'Ratepay', belegpflicht: true },
  '69015': { bezeichnung: 'Rechnung', belegpflicht: true },
  '69018': { bezeichnung: 'Überweisung (1701/1802)', belegpflicht: true },
  '69020': { bezeichnung: 'Mollie (1830)', belegpflicht: true }
}

async function fixKontenplan() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden\n')
    
    const db = client.db()
    const collection = db.collection('kontenplan')
    
    // 1. Bank-Konten: belegpflicht = false
    console.log('=== BANK-/ZAHLUNGSKONTEN (belegpflicht = FALSE) ===\n')
    
    for (const [nr, data] of Object.entries(BANK_KONTEN)) {
      const exists = await collection.findOne({ kontonummer: nr })
      
      if (exists) {
        await collection.updateOne(
          { kontonummer: nr },
          { $set: { belegpflicht: false } }
        )
        console.log(`✅ ${nr} - ${data.bezeichnung}: belegpflicht = FALSE (aktualisiert)`)
      } else {
        // Konto existiert nicht - anlegen
        await collection.insertOne({
          kontonummer: nr,
          bezeichnung: data.bezeichnung,
          klasse: '1',
          typ: 'Bank',
          belegpflicht: false,
          istAktiv: true
        })
        console.log(`✅ ${nr} - ${data.bezeichnung}: belegpflicht = FALSE (NEU angelegt)`)
      }
    }
    
    // 2. Debitoren: belegpflicht = true
    console.log('\n=== DEBITOREN (belegpflicht = TRUE) ===\n')
    
    for (const [nr, data] of Object.entries(DEBITOREN)) {
      const exists = await collection.findOne({ kontonummer: nr })
      
      if (exists) {
        await collection.updateOne(
          { kontonummer: nr },
          { 
            $set: { 
              belegpflicht: true,
              bezeichnung: data.bezeichnung  // Update auch Bezeichnung
            } 
          }
        )
        console.log(`✅ ${nr} - ${data.bezeichnung}: belegpflicht = TRUE (aktualisiert)`)
      } else {
        // Debitor existiert nicht - anlegen
        await collection.insertOne({
          kontonummer: nr,
          bezeichnung: data.bezeichnung,
          klasse: '6',
          typ: 'Debitor',
          belegpflicht: true,
          istAktiv: true
        })
        console.log(`✅ ${nr} - ${data.bezeichnung}: belegpflicht = TRUE (NEU angelegt)`)
      }
    }
    
    // 3. Statistik
    console.log('\n=== STATISTIK ===\n')
    const bankCount = await collection.countDocuments({ 
      kontonummer: { $in: Object.keys(BANK_KONTEN) }
    })
    const debitorCount = await collection.countDocuments({ 
      kontonummer: { $in: Object.keys(DEBITOREN) }
    })
    
    console.log(`Bank-Konten (belegpflicht=false): ${bankCount}`)
    console.log(`Debitoren (belegpflicht=true): ${debitorCount}`)
    
    // 4. Verifizierung
    console.log('\n=== VERIFIZIERUNG ===\n')
    
    const testKonten = ['1801', '1825', '69012', '69001']
    for (const nr of testKonten) {
      const konto = await collection.findOne({ kontonummer: nr })
      if (konto) {
        console.log(`${nr} - ${konto.bezeichnung}: belegpflicht = ${konto.belegpflicht}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Fehler:', error)
    throw error
  } finally {
    await client.close()
    console.log('\n✅ Verbindung geschlossen')
  }
}

fixKontenplan()
  .then(() => {
    console.log('\n🎉 KONTENPLAN-FIX ERFOLGREICH!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 FIX FEHLGESCHLAGEN:', error)
    process.exit(1)
  })
