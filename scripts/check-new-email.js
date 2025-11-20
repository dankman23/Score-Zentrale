/**
 * Prüfe NEU versendete E-Mail auf neue Signatur
 */

const { MongoClient } = require('mongodb')

async function check() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    
    // Suche nach Funke (gerade versendet)
    const prospect = await db.collection('prospects').findOne({
      company_name: /Funke.*Stahlbau/
    })
    
    if (!prospect || !prospect.email_sequence?.mail_1) {
      console.log('E-Mail noch nicht in DB')
      return
    }
    
    const body = prospect.email_sequence.mail_1.body
    
    console.log(`📧 Firma: ${prospect.company_name}`)
    console.log(`📅 Versendet: ${prospect.followup_schedule?.mail_1_sent_at}\n`)
    
    // Prüfungen
    const checks = {
      'Neue E-Mail (daniel@)': body.includes('daniel@score-schleifwerkzeuge.de'),
      'Alte E-Mail ENTFERNT (leismann@)': !body.includes('leismann@score-schleifwerkzeuge.de'),
      'Klickbarer /business Link': body.includes('<a href="https://score-schleifwerkzeuge.de/business">'),
      'Neue Formatierung': body.includes('Viele Grüße\nDaniel Leismann\n\nScore'),
      'Zeitangabe Mo-Fr': body.includes('Mo-Fr 10-18 Uhr')
    }
    
    console.log('📋 CHECKS:')
    for (const [check, result] of Object.entries(checks)) {
      console.log(`${result ? '✅' : '❌'} ${check}`)
    }
    
    const allGood = Object.values(checks).every(v => v)
    console.log(`\n${allGood ? '🎉 ALLES PERFEKT!' : '⚠️  Einige Checks fehlgeschlagen'}`)
    
    // Zeige Signatur
    if (body.includes('daniel@') || body.includes('leismann@')) {
      const idx = body.indexOf('daniel@') !== -1 ? body.indexOf('daniel@') : body.indexOf('leismann@')
      console.log(`\n--- SIGNATUR ---`)
      console.log(body.substring(idx - 100, idx + 150))
    }
    
  } finally {
    await client.close()
  }
}

check()
