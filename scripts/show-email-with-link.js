/**
 * Zeige E-Mail mit /business Link
 */

const { MongoClient } = require('mongodb')

async function showEmailWithLink() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('prospects')
    
    console.log('🔍 Suche Prospects mit E-Mail...\n')
    
    const prospects = await collection
      .find({ 'followup_schedule.mail_1_sent': true })
      .sort({ 'followup_schedule.mail_1_sent_at': -1 })
      .limit(3)
      .toArray()
    
    if (prospects.length === 0) {
      console.log('❌ Keine versendeten E-Mails gefunden')
      return
    }
    
    console.log(`✅ Gefunden: ${prospects.length} versendete E-Mails\n`)
    
    for (const p of prospects) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📧 Firma: ${p.company_name}`)
      console.log(`📅 Versendet: ${p.followup_schedule?.mail_1_sent_at}`)
      
      if (p.email_sequence && p.email_sequence.mail_1) {
        console.log(`\n--- BETREFF ---`)
        console.log(p.email_sequence.mail_1.subject)
        
        const body = p.email_sequence.mail_1.body
        const hasLink = body.includes('/business')
        
        console.log(`\n✅ /business Link: ${hasLink ? '✅ JA' : '❌ NEIN'}`)
        
        if (hasLink) {
          // Zeige den Teil mit dem Link
          const linkIndex = body.indexOf('/business')
          const start = Math.max(0, linkIndex - 150)
          const end = Math.min(body.length, linkIndex + 150)
          console.log(`\n--- AUSSCHNITT MIT LINK ---`)
          console.log(body.substring(start, end))
        }
      }
    }
    
  } finally {
    await client.close()
  }
}

showEmailWithLink()
