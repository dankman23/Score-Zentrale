/**
 * Analyse: Datenbank-Struktur für Zahlungen & VK-Belege
 */

import { getDb } from '@/lib/db/mongodb'

async function analyze() {
  const db = await getDb()
  
  console.log('\n=== ANALYSE: Zahlungen & VK-Belege ===\n')
  
  // 1. VK-Rechnungen Sample
  console.log('1️⃣ VK-RECHNUNGEN (fibu_vk_rechnungen):')
  const vkSample = await db.collection('fibu_vk_rechnungen').findOne({})
  if (vkSample) {
    console.log('   Felder:', Object.keys(vkSample).join(', '))
    console.log('\n   Sample:')
    console.log('   - cRechnungsNr:', vkSample.cRechnungsNr)
    console.log('   - cBestellNr:', vkSample.cBestellNr)
    console.log('   - kRechnung:', vkSample.kRechnung)
    console.log('   - brutto:', vkSample.brutto)
    console.log('   - zahlungsart:', vkSample.zahlungsart)
  }
  
  // 2. Zahlungen Samples
  const collections = [
    'fibu_amazon_settlements',
    'fibu_paypal_transactions',
    'fibu_commerzbank_transactions',
    'fibu_ebay_transactions'
  ]
  
  for (const coll of collections) {
    console.log(`\n2️⃣ ${coll.toUpperCase()}:`)
    const sample = await db.collection(coll).findOne({})
    if (sample) {
      console.log('   Felder:', Object.keys(sample).filter(k => !k.startsWith('_')).slice(0, 20).join(', '))
      
      // Prüfe auf Zuordnungs-Felder
      const zuordnungsFelder = Object.keys(sample).filter(k => 
        k.includes('zugeordnet') || k.includes('rechnung') || k.includes('konto') || k.includes('beleg') || k.includes('match')
      )
      
      if (zuordnungsFelder.length > 0) {
        console.log('   Zuordnungs-Felder:', zuordnungsFelder.join(', '))
        zuordnungsFelder.forEach((f: string) => {
          console.log(`     - ${f}:`, (sample as any)[f])
        })
      }
      
      // Zeige Referenz-Felder
      if ((sample as any).orderId) console.log('   orderId:', (sample as any).orderId)
      if ((sample as any).referenz) console.log('   referenz:', (sample as any).referenz)
      if ((sample as any).rechnungsNr) console.log('   rechnungsNr:', (sample as any).rechnungsNr)
      if ((sample as any).cBestellNr) console.log('   cBestellNr:', (sample as any).cBestellNr)
    }
  }
  
  // 3. Statistiken
  console.log('\n3️⃣ STATISTIKEN:')
  const vkCount = await db.collection('fibu_vk_rechnungen').countDocuments({})
  console.log(`   VK-Rechnungen gesamt: ${vkCount}`)
  
  const vkMitBestellung = await db.collection('fibu_vk_rechnungen').countDocuments({
    cBestellNr: { $exists: true, $nin: [null, ''] }
  })
  console.log(`   VK-Rechnungen mit cBestellNr: ${vkMitBestellung}`)
  
  for (const coll of collections) {
    const count = await db.collection(coll).countDocuments({})
    const mitZuordnung = await db.collection(coll).countDocuments({
      istZugeordnet: true
    })
    console.log(`   ${coll}: ${count} total, ${mitZuordnung} zugeordnet`)
  }
  
  console.log('\n✅ Analyse abgeschlossen\n')
  process.exit(0)
}

analyze().catch(err => {
  console.error('❌ Fehler:', err)
  process.exit(1)
})
