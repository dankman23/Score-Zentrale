/**
 * Prüfe ob Link in versendeter E-Mail klickbar ist
 */

const { MongoClient } = require('mongodb')

async function checkClickableLink() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('prospects')
    
    console.log('🔍 Suche letzte versendete E-Mail...\n')
    
    const latestProspect = await collection
      .find({ 
        'followup_schedule.mail_1_sent': true,
        'email_sequence.mail_1.body': { $exists: true }
      })
      .sort({ 'followup_schedule.mail_1_sent_at': -1 })
      .limit(1)
      .toArray()
      .then(arr => arr[0])
    
    if (!latestProspect) {
      console.log('❌ Keine E-Mail gefunden')
      return
    }
    
    console.log(`📧 Firma: ${latestProspect.company_name}`)
    console.log(`📅 Versendet: ${latestProspect.followup_schedule?.mail_1_sent_at}`)
    console.log(`\n--- BETREFF ---`)
    console.log(latestProspect.email_sequence.mail_1.subject)
    
    const body = latestProspect.email_sequence.mail_1.body
    
    // Prüfe ob Link als HTML vorhanden ist
    const hasClickableLink = body.includes('<a href="https://score-schleifwerkzeuge.de/business">') ||
                             body.includes("<a href='https://score-schleifwerkzeuge.de/business'>")
    
    console.log(`\n✅ Klickbarer Link vorhanden: ${hasClickableLink ? '✅ JA' : '❌ NEIN'}`)
    
    if (hasClickableLink) {
      // Zeige den Teil mit dem Link
      const linkIndex = body.indexOf('/business')
      const start = Math.max(0, linkIndex - 200)
      const end = Math.min(body.length, linkIndex + 200)
      console.log(`\n--- AUSSCHNITT MIT LINK ---`)
      console.log(body.substring(start, end))
      console.log('\n🎉 Perfekt! Der Link ist klickbar!')
    } else if (body.includes('https://score-schleifwerkzeuge.de/business')) {
      console.log('\n⚠️  Link ist vorhanden aber NICHT klickbar (Plain-Text)')
      // Zeige wo der Link ist
      const linkIndex = body.indexOf('/business')
      const start = Math.max(0, linkIndex - 200)
      const end = Math.min(body.length, linkIndex + 200)
      console.log(`\n--- AUSSCHNITT ---`)
      console.log(body.substring(start, end))
    } else {
      console.log('\n❌ Kein Link gefunden!')
    }
    
  } finally {
    await client.close()
  }
}

checkClickableLink()
