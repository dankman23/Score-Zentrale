/**
 * Sync Script: Befüllt fibu_rechnungen_alle aus funktionierenden APIs
 * 
 * Verwendet:
 * - /api/fibu/rechnungen/vk (funktioniert bereits)
 * - /api/fibu/rechnungen/extern (funktioniert bereits)
 */

import { getDb } from '../app/lib/db/mongodb'

async function main() {
  console.log('\n=== SYNC: fibu_rechnungen_alle ===\n')
  
  const zeitraum = {
    from: '2025-10-01',
    to: '2025-10-31'
  }
  
  console.log(`Zeitraum: ${zeitraum.from} bis ${zeitraum.to}`)
  
  const db = await getDb()
  const alleRechnungenColl = db.collection('fibu_rechnungen_alle')
  
  // 1. VK-Rechnungen aus MongoDB laden
  console.log('\n1️⃣ Lade VK-Rechnungen...')
  const vkColl = db.collection('fibu_vk_rechnungen')
  const vkRechnungen = await vkColl.find({
    rechnungsdatum: {
      $gte: new Date(zeitraum.from),
      $lte: new Date(zeitraum.to + 'T23:59:59.999Z')
    }
  }).toArray()
  
  console.log(`   Gefunden: ${vkRechnungen.length} VK-Rechnungen`)
  
  // In fibu_rechnungen_alle speichern
  let vkSaved = 0
  for (const r of vkRechnungen) {
    const uniqueId = `RECHNUNG_${r.kRechnung || r._id.toString()}`
    
    await alleRechnungenColl.updateOne(
      { uniqueId },
      {
        $set: {
          uniqueId,
          quelle: 'RECHNUNG',
          belegId: r.kRechnung || r._id.toString(),
          belegnummer: r.cRechnungsNr || r.rechnungsNr,
          belegdatum: r.rechnungsdatum,
          brutto: r.brutto || 0,
          netto: r.netto || 0,
          mwst: r.mwst || 0,
          kundenName: r.kundenName || 'Unbekannt',
          kundenLand: r.kundenLand || 'DE',
          kundenUstId: r.kundenUstId || '',
          zahlungsart: r.zahlungsart || 'Unbekannt',
          status: r.status || 'Offen',
          debitorKonto: r.debitorKonto,
          sachkonto: r.sachkonto,
          updated_at: new Date()
        },
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true }
    )
    vkSaved++
  }
  
  console.log(`   ✅ ${vkSaved} VK-Rechnungen in fibu_rechnungen_alle gespeichert`)
  
  // 2. Externe Rechnungen aus JTL laden
  console.log('\n2️⃣ Lade Externe Rechnungen (Amazon VCS-Lite)...')
  
  // Diese kommen direkt aus JTL via /api/fibu/rechnungen/extern
  // Die API lädt sie aus MSSQL, aber speichert sie nicht in MongoDB
  // Wir können sie aber aus der Response nehmen
  
  const response = await fetch(`http://localhost:3000/api/fibu/rechnungen/extern?from=${zeitraum.from}&to=${zeitraum.to}&limit=5000`)
  const data = await response.json()
  
  if (data.ok && data.rechnungen) {
    console.log(`   Gefunden: ${data.rechnungen.length} externe Rechnungen`)
    
    let externSaved = 0
    for (const r of data.rechnungen) {
      const uniqueId = `EXTERN_${r.kExternerBeleg}`
      
      await alleRechnungenColl.updateOne(
        { uniqueId },
        {
          $set: {
            uniqueId,
            quelle: 'EXTERN',
            belegId: r.kExternerBeleg,
            belegnummer: r.rechnungsNr,
            belegdatum: r.datum,
            brutto: r.brutto || r.betrag || 0,
            netto: r.netto || 0,
            mwst: r.steuer || 0,
            kundenName: r.kunde || 'Unbekannt',
            kundenLand: r.kundenLand || 'DE',
            kundenUstId: r.kundenUstId || '',
            zahlungsart: r.zahlungsart || 'Amazon Payment',
            status: r.status || 'Offen',
            cBestellNr: r.bestellnummer || '',
            kBestellung: r.kBestellung,
            debitorKonto: r.debitorKonto || null,
            sachkonto: r.sachkonto || '8400',
            herkunft: 'VCS-Lite',
            updated_at: new Date()
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
      externSaved++
    }
    
    console.log(`   ✅ ${externSaved} externe Rechnungen in fibu_rechnungen_alle gespeichert`)
  } else {
    console.log(`   ❌ Fehler beim Laden externer Rechnungen:`, data.error)
  }
  
  // Statistik
  console.log('\n=== STATISTIK ===')
  const total = await alleRechnungenColl.countDocuments()
  const rechnung = await alleRechnungenColl.countDocuments({ quelle: 'RECHNUNG' })
  const extern = await alleRechnungenColl.countDocuments({ quelle: 'EXTERN' })
  
  console.log(`📊 fibu_rechnungen_alle gesamt: ${total}`)
  console.log(`   - RECHNUNG (VK): ${rechnung}`)
  console.log(`   - EXTERN (Amazon): ${extern}`)
  
  console.log('\n✅ Sync abgeschlossen!\n')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Fehler:', err)
  process.exit(1)
})
