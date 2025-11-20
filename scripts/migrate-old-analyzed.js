/**
 * Migriere alte 'analyzed' Prospects ohne E-Mail zu 'no_email'
 */

const { MongoClient, ObjectId } = require('mongodb')

async function migrate() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/score'
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('prospects')
    
    console.log('🔍 Suche alte analyzed Prospects ohne E-Mail...\n')
    
    // Hole ALLE analyzed
    const analyzed = await collection.find({ status: 'analyzed' }).toArray()
    console.log(`📊 Total analyzed: ${analyzed.length}`)
    
    // Filtere ohne gültige E-Mail
    const withoutEmail = []
    const withEmail = []
    
    for (const p of analyzed) {
      const email = p.analysis_v3?.contact_person?.email
      const hasValid = email && typeof email === 'string' && email.length > 5 && email.includes('@')
      
      if (hasValid) {
        withEmail.push(p)
      } else {
        withoutEmail.push(p)
      }
    }
    
    console.log(`✅ Mit E-Mail: ${withEmail.length}`)
    console.log(`❌ Ohne E-Mail: ${withoutEmail.length}\n`)
    
    if (withoutEmail.length > 0) {
      // Update zu no_email
      const ids = withoutEmail.map(p => p._id)
      const result = await collection.updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'no_email' } }
      )
      
      console.log(`✅ ${result.modifiedCount} Prospects auf "no_email" gesetzt\n`)
    }
    
    // Neue Stats
    const stats = {
      new: await collection.countDocuments({ status: 'new' }),
      analyzed: await collection.countDocuments({ status: 'analyzed' }),
      no_email: await collection.countDocuments({ status: 'no_email' }),
      contacted: await collection.countDocuments({ status: 'contacted' })
    }
    
    console.log('📊 NEUE STATISTIK:')
    console.log(`   New: ${stats.new}`)
    console.log(`   Analyzed (mit E-Mail): ${stats.analyzed}`)
    console.log(`   No Email: ${stats.no_email}`)
    console.log(`   Contacted: ${stats.contacted}`)
    
    console.log('\n✅ Migration abgeschlossen! Autopilot kann jetzt E-Mails versenden!')
    
  } finally {
    await client.close()
  }
}

migrate()
