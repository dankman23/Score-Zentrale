/**
 * Automatische Sachkonto-Zuordnung für Zahlungen OHNE Rechnung
 * 
 * Kategorisiert und bucht:
 * - Gehälter → 6100
 * - Amazon Gebühren → 4985
 * - PayPal Gebühren → 4985
 * - Versandkosten → 4910
 * - Steuern → 3800/4830
 * etc.
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

// Sachkonten-Mapping
const SACHKONTEN = {
  gehalt: '6100',           // Löhne und Gehälter
  gebuehren: '4985',        // Sonstige betriebliche Aufwendungen (Gebühren)
  versand: '4910',          // Porto, Versand, Fracht
  steuern_ust: '3800',      // Umsatzsteuer
  steuern_vst: '1576',      // Abziehbare Vorsteuer
  steuern_lohn: '4830',     // Lohnsteuer
  miete: '4210',            // Miet- und Pachtaufwand
  kfz: '4530',              // KFZ-Kosten
  buero: '4940',            // Bürobedarf
  telekom: '4720',          // Telefon, Internet
  bank_gebuehren: '4950',   // Bank-Gebühren
  sonstige: '4980'          // Sonstige Aufwendungen
}

async function main() {
  const client = await MongoClient.connect(MONGO_URL)
  const db = client.db(DB_NAME)
  
  console.log('💼 Starte automatische Sachkonto-Zuordnung...\n')
  
  try {
    // Zeitraum von Kommandozeile
    const zeitraumVon = process.argv[2] || null
    const zeitraumBis = process.argv[3] || null
    
    let query = {
      $or: [
        { istZugeordnet: false },
        { istZugeordnet: { $exists: false } },
        { kRechnung: 0 },
        { kRechnung: { $exists: false } }
      ],
      betrag: { $lt: 0 }  // Nur Ausgaben (negative Beträge)
    }
    
    if (zeitraumVon && zeitraumBis) {
      query.zahlungsdatum = {
        $gte: new Date(zeitraumVon + 'T00:00:00.000Z'),
        $lte: new Date(zeitraumBis + 'T23:59:59.999Z')
      }
      console.log(`📅 Zeitraum: ${zeitraumVon} bis ${zeitraumBis}\n`)
    }
    
    // Lade nicht zugeordnete Ausgaben
    const zahlungen = await db.collection('fibu_zahlungen').find(query).toArray()
    
    console.log(`📊 Gefunden: ${zahlungen.length} nicht zugeordnete Ausgaben\n`)
    
    if (zahlungen.length === 0) {
      console.log('✅ Keine Ausgaben zur Zuordnung!')
      return
    }
    
    // Kategorisiere Zahlungen
    const kategorien = {
      gehalt: [],
      gebuehren: [],
      versand: [],
      steuern: [],
      bank_gebuehren: [],
      sonstige: []
    }
    
    for (const zahlung of zahlungen) {
      const kategorie = kategorisiereZahlung(zahlung)
      
      if (kategorien[kategorie]) {
        kategorien[kategorie].push(zahlung)
      } else {
        kategorien.sonstige.push(zahlung)
      }
    }
    
    // Zeige Statistik
    console.log('📋 KATEGORISIERUNG:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`💰 Gehälter:         ${kategorien.gehalt.length}`)
    console.log(`💳 Gebühren:         ${kategorien.gebuehren.length}`)
    console.log(`📦 Versand:          ${kategorien.versand.length}`)
    console.log(`🏦 Steuern:          ${kategorien.steuern.length}`)
    console.log(`🏦 Bank-Gebühren:    ${kategorien.bank_gebuehren.length}`)
    console.log(`📂 Sonstige:         ${kategorien.sonstige.length}`)
    console.log('═══════════════════════════════════════════════════════════════\n')
    
    // Zuordnung durchführen
    let zugeordnet = 0
    
    // Gehälter
    for (const zahlung of kategorien.gehalt) {
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            sachkonto: SACHKONTEN.gehalt,
            sachkontoBezeichnung: 'Löhne und Gehälter',
            istZugeordnet: true,
            zuordnungstyp: 'sachkonto',
            zuordnungsmethode: 'auto-sachkonto',
            zugeordnetAt: new Date()
          }
        }
      )
      zugeordnet++
    }
    
    // Gebühren (Amazon, PayPal, eBay)
    for (const zahlung of kategorien.gebuehren) {
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            sachkonto: SACHKONTEN.gebuehren,
            sachkontoBezeichnung: 'Sonstige betriebliche Aufwendungen (Gebühren)',
            istZugeordnet: true,
            zuordnungstyp: 'sachkonto',
            zuordnungsmethode: 'auto-sachkonto',
            zugeordnetAt: new Date()
          }
        }
      )
      zugeordnet++
    }
    
    // Versand
    for (const zahlung of kategorien.versand) {
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            sachkonto: SACHKONTEN.versand,
            sachkontoBezeichnung: 'Porto, Versandkosten, Fracht',
            istZugeordnet: true,
            zuordnungstyp: 'sachkonto',
            zuordnungsmethode: 'auto-sachkonto',
            zugeordnetAt: new Date()
          }
        }
      )
      zugeordnet++
    }
    
    // Steuern
    for (const zahlung of kategorien.steuern) {
      const istLohnsteuer = zahlung.verwendungszweck?.toLowerCase().includes('lohnsteuer')
      const konto = istLohnsteuer ? SACHKONTEN.steuern_lohn : SACHKONTEN.steuern_ust
      const bezeichnung = istLohnsteuer ? 'Lohnsteuer' : 'Umsatzsteuer'
      
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            sachkonto: konto,
            sachkontoBezeichnung: bezeichnung,
            istZugeordnet: true,
            zuordnungstyp: 'sachkonto',
            zuordnungsmethode: 'auto-sachkonto',
            zugeordnetAt: new Date()
          }
        }
      )
      zugeordnet++
    }
    
    // Bank-Gebühren
    for (const zahlung of kategorien.bank_gebuehren) {
      await db.collection('fibu_zahlungen').updateOne(
        { _id: zahlung._id },
        {
          $set: {
            sachkonto: SACHKONTEN.bank_gebuehren,
            sachkontoBezeichnung: 'Bankgebühren',
            istZugeordnet: true,
            zuordnungstyp: 'sachkonto',
            zuordnungsmethode: 'auto-sachkonto',
            zugeordnetAt: new Date()
          }
        }
      )
      zugeordnet++
    }
    
    // Beispiele anzeigen
    console.log('✅ BEISPIELE (Top 5 pro Kategorie):')
    console.log('─────────────────────────────────────────────────────────────\n')
    
    if (kategorien.gehalt.length > 0) {
      console.log('💰 GEHÄLTER:')
      kategorien.gehalt.slice(0, 5).forEach(z => {
        console.log(`   ${z.auftraggeber || z.kundenName}: ${z.betrag.toFixed(2)}€`)
      })
      console.log()
    }
    
    if (kategorien.gebuehren.length > 0) {
      console.log('💳 GEBÜHREN:')
      kategorien.gebuehren.slice(0, 5).forEach(z => {
        console.log(`   ${z.zahlungsanbieter}: ${z.betrag.toFixed(2)}€ - ${z.hinweis?.substring(0, 50) || z.verwendungszweck?.substring(0, 50) || ''}`)
      })
      console.log()
    }
    
    if (kategorien.versand.length > 0) {
      console.log('📦 VERSAND:')
      kategorien.versand.slice(0, 5).forEach(z => {
        console.log(`   ${z.auftraggeber || z.zahlungsanbieter}: ${z.betrag.toFixed(2)}€`)
      })
      console.log()
    }
    
    // Zusammenfassung
    console.log('📈 ZUSAMMENFASSUNG:')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`Verarbeitet:       ${zahlungen.length}`)
    console.log(`Zugeordnet:        ${zugeordnet} (${Math.round((zugeordnet / zahlungen.length) * 100)}%)`)
    console.log(`Verbleibend:       ${zahlungen.length - zugeordnet}`)
    console.log('═══════════════════════════════════════════════════════════════')
    
  } finally {
    await client.close()
  }
}

/**
 * Kategorisiert eine Zahlung basierend auf Inhalt
 */
function kategorisiereZahlung(zahlung) {
  const text = `${zahlung.verwendungszweck || ''} ${zahlung.hinweis || ''} ${zahlung.auftraggeber || ''} ${zahlung.buchungstext || ''}`.toLowerCase()
  const anbieter = (zahlung.zahlungsanbieter || '').toLowerCase()
  
  // Gehälter (Namen der Mitarbeiter)
  if (text.includes('waller') || text.includes('angelika') || text.includes('dorothee') || 
      text.includes('gehalt') || text.includes('lohn')) {
    return 'gehalt'
  }
  
  // Amazon Gebühren
  if (anbieter.includes('amazon')) {
    // Amazon hat viele Gebühren: FBA, Werbekosten, Provisionen
    if (text.includes('fee') || text.includes('gebühr') || text.includes('provision') ||
        text.includes('advertising') || text.includes('fba') || text.includes('storage') ||
        text.includes('refund') || text.includes('commission')) {
      return 'gebuehren'
    }
  }
  
  // PayPal Gebühren
  if (anbieter.includes('paypal')) {
    if (text.includes('gebühr') || text.includes('fee') || text.includes('provision')) {
      return 'gebuehren'
    }
  }
  
  // eBay Gebühren
  if (anbieter.includes('ebay')) {
    if (text.includes('gebühr') || text.includes('fee') || text.includes('provision')) {
      return 'gebuehren'
    }
  }
  
  // Versandkosten
  if (text.includes('deutsche post') || text.includes('dhl') || text.includes('paket') ||
      text.includes('porto') || text.includes('versand') || text.includes('fracht')) {
    return 'versand'
  }
  
  // Steuern
  if (text.includes('finanzamt') || text.includes('steuerverwaltung') || 
      text.includes('umsatzsteuer') || text.includes('lohnsteuer') ||
      text.includes('gewerbesteuer') || text.includes('finanzamt')) {
    return 'steuern'
  }
  
  // Bank-Gebühren
  if (text.includes('kontoführung') || text.includes('bankgebühr') || 
      (anbieter.includes('commerzbank') && text.includes('gebühr'))) {
    return 'bank_gebuehren'
  }
  
  // Standard: Sonstige
  return 'sonstige'
}

// Script ausführen
main().catch(console.error)
