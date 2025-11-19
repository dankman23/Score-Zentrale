#!/usr/bin/env node
/**
 * Script zum Bereinigen von Firmennamen in der Datenbank
 * Entfernt "Impressum - ", "Kontakt - ", etc.
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale'

function cleanCompanyName(name) {
  if (!name) return name
  
  // Entferne typische Seiten-Titel-Präfixe
  const prefixesToRemove = [
    'Impressum - ',
    'Impressum: ',
    'Impressum | ',
    'Kontakt - ',
    'Kontakt: ',
    'Kontakt | ',
    'Über uns - ',
    'Über uns: ',
    'About - ',
    'Contact - ',
    'Imprint - ',
    'Home - ',
    'Startseite - ',
    'Willkommen - ',
    'Welcome - '
  ]
  
  let cleaned = name
  for (const prefix of prefixesToRemove) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length)
      break
    }
  }
  
  // Entferne auch Suffix wie " - Impressum", " | Kontakt"
  const suffixesToRemove = [
    ' - Impressum',
    ' | Impressum',
    ' - Kontakt',
    ' | Kontakt',
    ' - Über uns',
    ' | Über uns'
  ]
  
  for (const suffix of suffixesToRemove) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.substring(0, cleaned.length - suffix.length)
      break
    }
  }
  
  return cleaned.trim()
}

async function run() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db()
    const prospects = db.collection('prospects')
    
    // Hole alle Prospects
    const allProspects = await prospects.find({}).toArray()
    console.log(`📊 Found ${allProspects.length} prospects`)
    
    let cleanedCount = 0
    
    for (const prospect of allProspects) {
      const originalName = prospect.company_name
      const cleanedName = cleanCompanyName(originalName)
      
      if (cleanedName !== originalName) {
        await prospects.updateOne(
          { _id: prospect._id },
          { 
            $set: { 
              company_name: cleanedName,
              company_name_original: originalName 
            } 
          }
        )
        cleanedCount++
        console.log(`🧹 Cleaned: "${originalName}" → "${cleanedName}"`)
      }
    }
    
    console.log(`\n✅ Done! Cleaned ${cleanedCount} company names`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.close()
  }
}

run()
