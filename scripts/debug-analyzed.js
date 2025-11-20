/**
 * Debug: Warum werden analyzed Prospects nicht ausgewählt?
 */

const { MongoClient } = require('mongodb')

async function debug() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('prospects')
    
    console.log('🔍 Debug analyzed Prospects...\n')
    
    // Gleiche Query wie Autopilot
    const candidates = await collection.find({
      'analysis_v3': { $exists: true },
      'followup_schedule.mail_1_sent': { $ne: true },
      'autopilot_skip': { $ne: true }
    }).limit(5).toArray()
    
    console.log(`📊 Gefunden: ${candidates.length} candidates\n`)
    
    for (const c of candidates) {
      const email = c.analysis_v3?.contact_person?.email
      const isValid = email && typeof email === 'string' && email.length > 5 && email.includes('@')
      
      console.log(`${isValid ? '✅' : '❌'} ${c.company_name}`)
      console.log(`   Status: ${c.status}`)
      console.log(`   E-Mail: ${email || 'KEINE'}`)
      console.log(`   E-Mail Type: ${typeof email}`)
      console.log(`   Mail sent: ${c.followup_schedule?.mail_1_sent}`)
      console.log(`   Skip: ${c.autopilot_skip}`)
      console.log('')
    }
    
  } finally {
    await client.close()
  }
}

debug()
