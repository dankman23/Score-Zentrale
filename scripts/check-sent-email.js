/**
 * Prüfe letzte versendete E-Mail
 */

const { MongoClient } = require('mongodb')

async function check() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    
    const latest = await db.collection('prospects')
      .find({ 'followup_schedule.mail_1_sent': true })
      .sort({ 'followup_schedule.mail_1_sent_at': -1 })
      .limit(1)
      .toArray()
    
    if (latest.length === 0) {
      console.log('Keine E-Mail gefunden')
      return
    }
    
    const p = latest[0]
    console.log(`📧 Firma: ${p.company_name}`)
    console.log(`📅 Versendet: ${p.followup_schedule?.mail_1_sent_at}`)
    console.log(`\n--- BETREFF ---`)
    console.log(p.email_sequence?.mail_1?.subject || 'N/A')
    
    const body = p.email_sequence?.mail_1?.body || ''
    
    // Prüfe neue E-Mail-Adresse
    const hasNewEmail = body.includes('daniel@score-schleifwerkzeuge.de')
    const hasOldEmail = body.includes('leismann@score-schleifwerkzeuge.de')
    
    console.log(`\n✅ Neue E-Mail (daniel@): ${hasNewEmail ? '✅' : '❌'}`)
    console.log(`❌ Alte E-Mail (leismann@): ${hasOldEmail ? '❌ NOCH DA!' : '✅ Entfernt'}`)
    
    // Prüfe klickbaren Link
    const hasClickableLink = body.includes('<a href="https://score-schleifwerkzeuge.de/business">')
    console.log(`✅ Klickbarer /business Link: ${hasClickableLink ? '✅' : '❌'}`)
    
    // Prüfe Formatierung
    const hasNewFormat = body.includes('Viele Grüße\nDaniel Leismann\n\nScore')
    console.log(`✅ Neue Formatierung (Absatz): ${hasNewFormat ? '✅' : '❌'}`)
    
    // Zeige Ausschnitt
    if (body.includes('/business')) {
      const idx = body.indexOf('/business')
      console.log(`\n--- AUSSCHNITT (Link-Bereich) ---`)
      console.log(body.substring(idx - 150, idx + 150))
    }
    
    if (body.includes('daniel@') || body.includes('leismann@')) {
      const idx = body.indexOf('daniel@') !== -1 ? body.indexOf('daniel@') : body.indexOf('leismann@')
      console.log(`\n--- AUSSCHNITT (Signatur) ---`)
      console.log(body.substring(idx - 100, idx + 150))
    }
    
  } finally {
    await client.close()
  }
}

check()
