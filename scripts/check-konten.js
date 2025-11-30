const { MongoClient } = require('mongodb')
const fs = require('fs')

// Parse .env manually
const envContent = fs.readFileSync('/app/.env', 'utf8')
const MONGO_URL = envContent.split('\n').find(line => line.startsWith('MONGO_URL=')).split('=')[1].trim()

async function check() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('fibu_kontenplan')
    
    // Check wichtige Konten
    const konten = ['8400', '6770', '4910', '1815', '69001']
    
    for (const nr of konten) {
      const konto = await collection.findOne({ kontonummer: nr })
      if (konto) {
        console.log(`${nr}: ${konto.bezeichnung} → belegpflicht = ${konto.belegpflicht}`)
      } else {
        console.log(`${nr}: NICHT GEFUNDEN`)
      }
    }
    
    // Stats
    const mit = await collection.countDocuments({ belegpflicht: true })
    const ohne = await collection.countDocuments({ belegpflicht: false })
    console.log(`\nStats: ${mit} mit, ${ohne} ohne Belegpflicht`)
    
  } finally {
    await client.close()
  }
}

check()
