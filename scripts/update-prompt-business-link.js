/**
 * Update aktives E-Mail-Prompt mit /business Link
 * Führt aus: node scripts/update-prompt-business-link.js
 */

const { MongoClient } = require('mongodb')

async function updatePromptWithBusinessLink() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('email_prompts')
    
    console.log('🔍 Suche aktiven Prompt...')
    const activePrompt = await collection.findOne({ active: true })
    
    if (!activePrompt) {
      console.log('❌ Kein aktiver Prompt gefunden!')
      return
    }
    
    console.log(`✅ Aktiver Prompt gefunden (Version: ${activePrompt.version})`)
    
    // Prüfe ob der Link bereits vorhanden ist
    if (activePrompt.prompt.includes('score-schleifwerkzeuge.de/business')) {
      console.log('ℹ️  Link ist bereits im Prompt enthalten')
      return
    }
    
    // Aktualisiere den CTA-Teil im Prompt
    let updatedPrompt = activePrompt.prompt
    
    // Finde und ersetze den CTA-Bereich
    const oldCTA = `4. **Call-to-Action:**
   "Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr)."`
    
    const newCTA = `4. **Call-to-Action:**
   "Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr).
   Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: https://score-schleifwerkzeuge.de/business"`
    
    updatedPrompt = updatedPrompt.replace(oldCTA, newCTA)
    
    // Update in Datenbank
    await collection.updateOne(
      { _id: activePrompt._id },
      { 
        $set: { 
          prompt: updatedPrompt,
          updated_at: new Date()
        } 
      }
    )
    
    console.log('✅ Prompt erfolgreich aktualisiert mit /business Link!')
    console.log(`   Version: ${activePrompt.version}`)
    console.log('\n📧 Alle zukünftigen E-Mails enthalten nun den Link zu /business')
    
  } catch (error) {
    console.error('❌ Fehler:', error)
  } finally {
    await client.close()
  }
}

updatePromptWithBusinessLink()
