require('dotenv').config({ path: '/app/.env' })
const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL

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
