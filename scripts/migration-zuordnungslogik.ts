/**
 * Migration: Erweitere Zuordnungslogik
 * 
 * Fügt neue Felder hinzu (ohne bestehende zu löschen):
 * - vk_beleg_id (FK auf fibu_vk_rechnungen)
 * - match_source ('import_vk' | 'auto_vk' | 'manuell' | null)
 * - konto_vorschlag_id (vorgeschlagenes Konto)
 * 
 * WICHTIG: Bestehende Felder bleiben erhalten!
 */

import { getDb } from '../app/lib/db/mongodb'

async function migrate() {
  const db = await getDb()
  
  console.log('\n=== MIGRATION: Zuordnungslogik ===\n')
  
  const collections = [
    'fibu_amazon_settlements',
    'fibu_paypal_transactions',
    'fibu_commerzbank_transactions',
    'fibu_postbank_transactions',
    'fibu_ebay_transactions',
    'fibu_mollie_transactions'
  ]
  
  for (const collName of collections) {
    console.log(`📦 ${collName}:`)
    const coll = db.collection(collName)
    
    // 1. Konvertiere bestehende Zuordnungen zu neuem Format
    const mitZuordnung = await coll.find({
      zugeordneteRechnung: { $exists: true, $ne: null }
    }).toArray()
    
    console.log(`   Gefunden: ${mitZuordnung.length} Zahlungen mit zugeordneteRechnung`)
    
    let convertedCount = 0
    const vkRechnungen = db.collection('fibu_vk_rechnungen')
    
    for (const zahlung of mitZuordnung) {
      // Finde zugehörige Rechnung via cRechnungsNr
      const rechnung = await vkRechnungen.findOne({
        cRechnungsNr: zahlung.zugeordneteRechnung
      })
      
      if (rechnung) {
        // Setze vk_beleg_id
        const match_source = 
          zahlung.zuordnungsMethode === 'auNummerBetragDatum' ? 'auto_vk' :
          zahlung.zuordnungsMethode === 'auto-amazon-type' ? 'auto_vk' :
          zahlung.zuordnungsMethode ? 'auto_vk' :
          'import_vk'  // Default für alte Zuordnungen
        
        await coll.updateOne(
          { _id: zahlung._id },
          {
            $set: {
              vk_beleg_id: rechnung._id.toString(),
              match_source: match_source
            }
          }
        )
        convertedCount++
      }
    }
    
    console.log(`   ✅ ${convertedCount} Zuordnungen konvertiert (vk_beleg_id + match_source gesetzt)`)
    
    // 2. Setze konto_vorschlag_id für alle ohne zugeordnetesKonto
    const ohneKonto = await coll.countDocuments({
      zugeordnetesKonto: { $in: [null, ''] }
    })
    
    console.log(`   ${ohneKonto} Zahlungen ohne Konto (konto_vorschlag_id wird später berechnet)`)
    console.log()
  }
  
  console.log('✅ Migration abgeschlossen\n')
  process.exit(0)
}

migrate().catch(err => {
  console.error('❌ Fehler:', err)
  process.exit(1)
})
