/**
 * 1. Update Prompt mit neuer Signatur
 * 2. Markiere Prospects ohne E-Mail
 */

const { MongoClient } = require('mongodb')

async function fixAll() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    
    console.log('🔧 FIX 1: Update E-Mail-Prompt in Datenbank...\n')
    
    // Update aktiven Prompt
    const promptsCollection = db.collection('email_prompts')
    const activePrompt = await promptsCollection.findOne({ active: true })
    
    if (activePrompt) {
      console.log(`✅ Aktiver Prompt gefunden: v${activePrompt.version}`)
      
      // Update Prompt mit neuer Signatur und Link
      let updatedPrompt = activePrompt.prompt
      
      // 1. Update CTA mit klickbarem Link
      updatedPrompt = updatedPrompt.replace(
        /Ein paar Infos.*?https:\/\/score-schleifwerkzeuge\.de\/business"/s,
        `Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: <a href='https://score-schleifwerkzeuge.de/business'>https://score-schleifwerkzeuge.de/business</a>"`
      )
      
      await promptsCollection.updateOne(
        { _id: activePrompt._id },
        { $set: { prompt: updatedPrompt, updated_at: new Date() } }
      )
      
      console.log('✅ Prompt aktualisiert mit klickbarem Link\n')
    } else {
      console.log('ℹ️  Kein aktiver Prompt - verwendet Default aus Code\n')
    }
    
    console.log('🔧 FIX 2: Markiere Prospects ohne E-Mail...\n')
    
    const prospectsCollection = db.collection('prospects')
    
    // Finde ALLE analysierten Prospects
    const allAnalyzed = await prospectsCollection.find({
      status: 'analyzed'
    }).toArray()
    
    // Filtere die ohne gültige E-Mail
    const noEmailProspects = allAnalyzed.filter(p => {
      const email = p.analysis_v3?.contact_person?.email
      return !email || typeof email !== 'string' || email.length < 5 || !email.includes('@')
    })
    
    console.log(`📊 Gefunden: ${noEmailProspects.length} Prospects ohne E-Mail`)
    
    if (noEmailProspects.length > 0) {
      // Update zu "no_email" Status - hole IDs
      const idsToUpdate = noEmailProspects.map(p => p._id)
      
      const result = await prospectsCollection.updateMany(
        { _id: { $in: idsToUpdate } },
        { $set: { status: 'no_email' } }
      )
      
      console.log(`✅ ${result.modifiedCount} Prospects markiert als "no_email"\n`)
    }
    
    // Statistik
    const stats = {
      analyzed: await prospectsCollection.countDocuments({ status: 'analyzed' }),
      no_email: await prospectsCollection.countDocuments({ status: 'no_email' }),
      contacted: await prospectsCollection.countDocuments({ status: 'contacted' })
    }
    
    console.log('📊 NEUE STATISTIK:')
    console.log(`   Analyzed (mit E-Mail): ${stats.analyzed}`)
    console.log(`   No Email: ${stats.no_email}`)
    console.log(`   Contacted: ${stats.contacted}`)
    
    console.log('\n✅ FERTIG! Autopilot kann jetzt weiterlaufen!')
    
  } finally {
    await client.close()
  }
}

fixAll()
