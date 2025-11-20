/**
 * Prüfe warum keine E-Mails versendet werden
 */

const { MongoClient } = require('mongodb')

async function checkEmailProblem() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('prospects')
    
    console.log('🔍 Analysiere E-Mail-Versand-Problem...\n')
    
    // Hole analysierte Prospects
    const analyzedProspects = await collection
      .find({ 
        'analysis_v3': { $exists: true },
        'followup_schedule.mail_1_sent': { $ne: true },
        'autopilot_skip': { $ne: true }
      })
      .limit(10)
      .toArray()
    
    console.log(`📊 Gefunden: ${analyzedProspects.length} analysierte Prospects (nicht kontaktiert)\n`)
    
    let withEmail = 0
    let withoutEmail = 0
    let invalidEmail = 0
    
    for (const p of analyzedProspects) {
      const email = p.analysis_v3?.contact_person?.email
      const hasValidEmail = email && typeof email === 'string' && email.length > 5 && email.includes('@')
      
      if (hasValidEmail) {
        withEmail++
        console.log(`✅ ${p.company_name}`)
        console.log(`   E-Mail: ${email}`)
      } else if (email) {
        invalidEmail++
        console.log(`⚠️  ${p.company_name}`)
        console.log(`   Ungültig: ${email}`)
      } else {
        withoutEmail++
        console.log(`❌ ${p.company_name}`)
        console.log(`   Keine E-Mail`)
      }
    }
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n📊 STATISTIK:`)
    console.log(`   ✅ Mit gültiger E-Mail: ${withEmail}`)
    console.log(`   ⚠️  Mit ungültiger E-Mail: ${invalidEmail}`)
    console.log(`   ❌ Ohne E-Mail: ${withoutEmail}`)
    
    if (withEmail === 0) {
      console.log(`\n❌ PROBLEM: Keine Prospects mit gültiger E-Mail gefunden!`)
      console.log(`   → Autopilot kann keine E-Mails versenden`)
      console.log(`   → Analyzer findet keine E-Mail-Adressen`)
    } else {
      console.log(`\n✅ Es gibt Prospects mit E-Mail!`)
      console.log(`   → Prüfe Autopilot-Logik...`)
    }
    
  } finally {
    await client.close()
  }
}

checkEmailProblem()
