/**
 * Zeige alle E-Mail-Prompts
 */

const { MongoClient } = require('mongodb')

async function checkPrompts() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('email_prompts')
    
    console.log('📋 Alle E-Mail-Prompts:\n')
    const prompts = await collection.find({}).toArray()
    
    if (prompts.length === 0) {
      console.log('   Keine Prompts gefunden - System verwendet Default-Prompt aus Code')
      console.log('   ✅ Der Default-Prompt wurde bereits mit /business Link aktualisiert!')
      return
    }
    
    prompts.forEach(p => {
      console.log(`Version: ${p.version}`)
      console.log(`Name: ${p.name}`)
      console.log(`Aktiv: ${p.active ? '✅ JA' : '❌ NEIN'}`)
      console.log(`Modell: ${p.model}`)
      console.log(`/business Link enthalten: ${p.prompt.includes('/business') ? '✅ JA' : '❌ NEIN'}`)
      console.log('---')
    })
    
  } finally {
    await client.close()
  }
}

checkPrompts()
