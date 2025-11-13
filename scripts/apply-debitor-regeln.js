#!/usr/bin/env node

/**
 * Apply Debitor-Regeln
 * 
 * Wendet die Debitor-Zuordnungsregeln auf alle VK-Rechnungen an
 */

const { MongoClient, ObjectId } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

// EU-Länder Liste
const EU_LAENDER = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']

async function main() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    
    console.log('='.repeat(80))
    console.log('🔄 DEBITOR-REGELN ANWENDEN')
    console.log('='.repeat(80))
    console.log()
    
    // Lade Regeln
    const regeln = await db.collection('fibu_debitor_regeln').find({}).toArray()
    const sammelkonten = regeln.filter(r => r.typ === 'sammelkonto')
    const iglRegel = regeln.find(r => r.typ === 'igl_ausnahme')
    
    console.log(`📋 ${sammelkonten.length} Sammelkonten geladen`)
    console.log(`📋 IGL-Regel: ${iglRegel ? '✅' : '❌'}`)
    console.log()
    
    // Lade alle VK-Rechnungen
    const rechnungen = await db.collection('fibu_vk_rechnungen').find({}).toArray()
    console.log(`📄 ${rechnungen.length} VK-Rechnungen zu prüfen`)
    console.log()
    
    let iglKunden = 0
    let sammelkontoZuordnungen = 0
    let fehler = 0
    let debitorCounter = 10000 // Start für IGL-Debitoren
    
    // Hole höchste IGL-Debitor-Nummer
    const hochsteIGL = await db.collection('fibu_vk_rechnungen').findOne(
      { debitorKonto: { $gte: '10000', $lt: '20000' } },
      { sort: { debitorKonto: -1 } }
    )
    if (hochsteIGL && hochsteIGL.debitorKonto) {
      debitorCounter = parseInt(hochsteIGL.debitorKonto) + 1
    }
    
    console.log('🔄 Starte Zuordnung...')
    console.log()
    
    for (const rechnung of rechnungen) {
      try {
        let debitorKonto = null
        let zuordnungsgrund = ''
        
        // REGEL 1: IGL-Kunde? (EU + USt-ID + MwSt=0)
        const istEU = EU_LAENDER.includes(rechnung.kundenLand)
        const hatUstId = rechnung.kundenUstId && rechnung.kundenUstId.length > 0
        const istMwst0 = rechnung.mwst === 0 || rechnung.steuersatz === 0
        
        if (istEU && hatUstId && istMwst0) {
          // IGL-Kunde → Eigener Debitor
          // Prüfe ob schon ein Debitor existiert für diesen Kunden
          const existierend = await db.collection('fibu_igl_debitoren').findOne({
            kundenUstId: rechnung.kundenUstId
          })
          
          if (existierend) {
            debitorKonto = existierend.debitorNr
          } else {
            // Neuen IGL-Debitor anlegen
            debitorKonto = debitorCounter.toString()
            debitorCounter++
            
            await db.collection('fibu_igl_debitoren').insertOne({
              debitorNr: debitorKonto,
              kundenName: rechnung.kundenName,
              kundenUstId: rechnung.kundenUstId,
              kundenLand: rechnung.kundenLand,
              created_at: new Date()
            })
          }
          
          zuordnungsgrund = 'IGL (EU + USt-ID)'
          iglKunden++
        } else {
          // REGEL 2: Standard → Sammelkonto nach Zahlungsart
          const sammelkonto = sammelkonten.find(s => 
            s.zahlungsart.toLowerCase() === rechnung.zahlungsart?.toLowerCase()
          )
          
          if (sammelkonto) {
            debitorKonto = sammelkonto.debitorNr
            zuordnungsgrund = `Sammelkonto ${sammelkonto.zahlungsart}`
            sammelkontoZuordnungen++
          } else {
            // Fallback: Sammelkonto "Rechnung"
            const fallback = sammelkonten.find(s => s.zahlungsart === 'Rechnung')
            if (fallback) {
              debitorKonto = fallback.debitorNr
              zuordnungsgrund = 'Sammelkonto Rechnung (Fallback)'
              sammelkontoZuordnungen++
            }
          }
        }
        
        // Update Rechnung
        if (debitorKonto) {
          await db.collection('fibu_vk_rechnungen').updateOne(
            { _id: rechnung._id },
            { 
              $set: { 
                debitorKonto,
                debitor_zuordnungsgrund: zuordnungsgrund,
                debitor_zugeordnet_am: new Date()
              } 
            }
          )
        } else {
          fehler++
        }
        
      } catch (err) {
        console.error(`Fehler bei Rechnung ${rechnung._id}:`, err.message)
        fehler++
      }
    }
    
    console.log('='.repeat(80))
    console.log('✅ FERTIG!')
    console.log('='.repeat(80))
    console.log()
    console.log(`✅ ${iglKunden} IGL-Kunden → Eigene Debitoren (10xxx)`)
    console.log(`✅ ${sammelkontoZuordnungen} Kunden → Sammelkonten (69xxx)`)
    console.log(`❌ ${fehler} Fehler`)
    console.log()
    
    // Zeige IGL-Debitoren
    const iglDebitoren = await db.collection('fibu_igl_debitoren').find({}).toArray()
    if (iglDebitoren.length > 0) {
      console.log('📊 IGL-DEBITOREN (mit USt-ID):')
      console.log('─'.repeat(80))
      iglDebitoren.forEach(d => {
        console.log(`  ${d.debitorNr}: ${d.kundenName} (${d.kundenLand}) - USt-ID: ${d.kundenUstId}`)
      })
      console.log()
    }
    
    console.log('='.repeat(80))
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
