/**
 * Analysiert FIBU Collections
 */

import { getDb } from '../app/lib/db/mongodb'

async function main() {
  console.log('\n=== FIBU COLLECTIONS ANALYSE ===\n')
  
  const db = await getDb()
  
  // Alle Collections
  const collections = await db.listCollections().toArray()
  const fibuColls = collections.filter(c => c.name.includes('fibu')).map(c => c.name)
  
  console.log('📦 Gefundene FIBU Collections:\n')
  for (const collName of fibuColls) {
    const coll = db.collection(collName)
    const count = await coll.countDocuments()
    console.log(`   ${collName}: ${count} Dokumente`)
  }
  
  // Rechnungen Details
  console.log('\n=== RECHNUNGEN DETAILS ===\n')
  const rechnungenColl = db.collection('fibu_rechnungen_alle')
  const totalRechnungen = await rechnungenColl.countDocuments()
  const vkRechnungen = await rechnungenColl.countDocuments({ belegnummer: /^RE/ })
  const xreRechnungen = await rechnungenColl.countDocuments({ quelle: 'EXTERN' })
  
  console.log(`📋 fibu_rechnungen_alle: ${totalRechnungen} gesamt`)
  console.log(`   - VK-Rechnungen (RE-*): ${vkRechnungen}`)
  console.log(`   - XRE (Externe): ${xreRechnungen}`)
  
  if (totalRechnungen > 0) {
    const sampleRE = await rechnungenColl.findOne({ belegnummer: /^RE/ })
    if (sampleRE) {
      console.log(`\n   ✅ VK-Rechnung Sample:`)
      console.log(`      Belegnr: ${sampleRE.belegnummer}`)
      console.log(`      Datum: ${sampleRE.rechnungsdatum}`)
      console.log(`      Brutto: ${sampleRE.brutto} €`)
    }
  } else {
    console.log('\n   ⚠️ PROBLEM: fibu_rechnungen_alle ist LEER!')
  }
  
  // EK-Rechnungen
  const ekColl = db.collection('fibu_ek_rechnungen')
  const totalEK = await ekColl.countDocuments()
  console.log(`\n📋 fibu_ek_rechnungen: ${totalEK}`)
  
  if (totalEK > 0) {
    const sampleEK = await ekColl.findOne()
    console.log(`   ✅ EK-Rechnung Sample:`)
    console.log(`      Rechnungsnr: ${sampleEK.rechnungsnummer || sampleEK.rechnungsNummer}`)
    console.log(`      Lieferant: ${sampleEK.lieferantName}`)
    console.log(`      Brutto: ${sampleEK.gesamtBetrag || sampleEK.brutto} €`)
  }
  
  // Zahlungen
  console.log('\n=== ZAHLUNGEN DETAILS ===\n')
  const zahlungsQuellen = [
    'fibu_amazon_settlements',
    'fibu_paypal_transactions',
    'fibu_bank_transaktionen',
    'fibu_bank_postbank',
    'mollie_payments'
  ]
  
  for (const source of zahlungsQuellen) {
    const coll = db.collection(source)
    const count = await coll.countDocuments()
    const zugeordnet = await coll.countDocuments({ istZugeordnet: true })
    console.log(`💰 ${source}: ${count} gesamt (${zugeordnet} zugeordnet)`)
  }
  
  console.log('\n=== ANALYSE ABGESCHLOSSEN ===\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Fehler:', err)
  process.exit(1)
})
