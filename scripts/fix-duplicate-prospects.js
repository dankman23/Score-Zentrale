#!/usr/bin/env node
/**
 * Script zum Bereinigen von duplizierten Prospects mit /impressum/, /kontakt/ URLs
 * 
 * Problem: Manche Prospects wurden mit URLs wie "https://example.de/kontakt/" gespeichert
 * statt nur "https://example.de". Dies führt zu Duplikaten mit derselben E-Mail-Adresse.
 * 
 * Lösung: Normalisiere alle website-URLs zu Hauptdomains und merge Duplikate
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale'

// Normalisiere URL zu Hauptdomain
function normalizeWebsite(url) {
  if (!url) return url
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url)
    return `${urlObj.protocol}//${urlObj.hostname}`
  } catch (e) {
    // Fallback: Entferne nur den Pfad
    return url.replace(/\/[^\/]*\/?$/, '')
  }
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
    
    // Gruppiere nach normalisierter Website
    const groups = new Map()
    let updatedCount = 0
    let mergedCount = 0
    
    for (const prospect of allProspects) {
      const normalized = normalizeWebsite(prospect.website)
      
      if (!groups.has(normalized)) {
        groups.set(normalized, [])
      }
      groups.get(normalized).push(prospect)
      
      // Update prospect mit normalisierter URL wenn verschieden
      if (normalized !== prospect.website) {
        await prospects.updateOne(
          { _id: prospect._id },
          { 
            $set: { 
              website: normalized,
              website_original: prospect.website 
            } 
          }
        )
        updatedCount++
        console.log(`🔧 Normalized: ${prospect.website} → ${normalized}`)
      }
    }
    
    console.log(`\n📝 Updated ${updatedCount} prospects with normalized URLs`)
    
    // Finde und merge Duplikate
    for (const [normalizedWebsite, duplicates] of groups.entries()) {
      if (duplicates.length > 1) {
        console.log(`\n🔍 Found ${duplicates.length} duplicates for ${normalizedWebsite}:`)
        
        // Sortiere nach Priorität: contacted > analyzed > new
        const priorityOrder = { contacted: 3, analyzed: 2, new: 1 }
        duplicates.sort((a, b) => 
          (priorityOrder[b.status] || 0) - (priorityOrder[a.status] || 0)
        )
        
        const keepProspect = duplicates[0]
        const removeProspects = duplicates.slice(1)
        
        console.log(`  ✅ Keeping: ${keepProspect.company_name} (${keepProspect.status})`)
        
        for (const dup of removeProspects) {
          console.log(`  ❌ Removing: ${dup.company_name} (${dup.status})`)
          
          // Lösche Duplikat
          await prospects.deleteOne({ _id: dup._id })
          mergedCount++
        }
      }
    }
    
    console.log(`\n✅ Done! Updated ${updatedCount} URLs, merged ${mergedCount} duplicates`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.close()
  }
}

run()
