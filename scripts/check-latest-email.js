/**
 * Zeige letzte versendete E-Mail
 */

const { MongoClient } = require('mongodb')

async function checkLatestEmail() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('prospects')
    
    console.log('🔍 Suche letzte versendete E-Mail...\n')
    
    const latestProspect = await collection.findOne(
      { 'email_sequence.mail_1': { $exists: true } },
      { sort: { 'followup_schedule.mail_1_sent_at': -1 } }
    )
    
    if (!latestProspect || !latestProspect.email_sequence) {
      console.log('❌ Keine E-Mail gefunden')
      return
    }
    
    console.log(`📧 E-Mail an: ${latestProspect.company_name}`)
    console.log(`📬 Empfänger: ${latestProspect.analysis_v3?.contact_person?.email}`)
    console.log(`\n--- BETREFF ---`)
    console.log(latestProspect.email_sequence.mail_1.subject)
    console.log(`\n--- BODY (erste 800 Zeichen) ---`)
    const body = latestProspect.email_sequence.mail_1.body
    console.log(body.substring(0, 800))
    
    // Prüfe ob Link enthalten ist
    const hasBusinessLink = body.includes('score-schleifwerkzeuge.de/business')
    console.log(`\n\n✅ /business Link enthalten: ${hasBusinessLink ? '✅ JA' : '❌ NEIN'}`)
    
    if (hasBusinessLink) {
      console.log('\n🎉 Perfekt! Der Link ist in der E-Mail enthalten!')
    }
    
  } finally {
    await client.close()
  }
}

checkLatestEmail()
