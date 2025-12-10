const { MongoClient } = require('mongodb')
const xml2js = require('xml2js')
const https = require('https')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const FEED_URLS = [
  'https://score-schleifwerkzeuge.de/store-api/product-export/SWPEWTLUSNPQB202UDVMOXDCQG/google.xml',
  'https://score-schleifwerkzeuge.de/store-api/product-export/SWPEV096MGCWNMTERMPLTK90YG/google2.xml',
  'https://score-schleifwerkzeuge.de/store-api/product-export/SWPERULYSJRJNE1WMZFIS0DNUQ/google3.xml',
  'https://score-schleifwerkzeuge.de/store-api/product-export/SWPEBWNYNGPGU2J4EDLVNHJRDW/google4.xml'
]

async function fetchFeed() {
  return new Promise((resolve, reject) => {
    let data = ''
    
    https.get(FEED_URL, (res) => {
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function importShoppingFeed() {
  console.log('🚀 Starte Shopping Feed Import...')
  console.log('📥 Lade Feed von:', FEED_URL)
  
  const mongoUrl = process.env.MONGO_URL
  const dbName = process.env.DB_NAME || process.env.MONGO_DB
  
  if (!mongoUrl || !dbName) {
    console.error('❌ MONGO_URL oder DB_NAME nicht gesetzt!')
    process.exit(1)
  }
  
  const client = new MongoClient(mongoUrl)
  
  try {
    // Fetch Feed
    const xmlData = await fetchFeed()
    console.log('✅ Feed geladen')
    
    // Parse XML
    const parser = new xml2js.Parser()
    const result = await parser.parseStringPromise(xmlData)
    const items = result.rss.channel[0].item || []
    
    console.log(`📦 ${items.length} Produkte gefunden`)
    
    // Connect MongoDB
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db(dbName)
    const collection = db.collection('shopping_feed')
    
    // Lösche alte Daten
    await collection.deleteMany({})
    console.log('🗑️  Alte Feed-Daten gelöscht')
    
    // Verarbeite Produkte
    const products = []
    
    for (const item of items) {
      const getField = (field) => {
        const value = item[field]
        if (!value) return null
        return Array.isArray(value) ? value[0] : value
      }
      
      const getGField = (field) => {
        const gField = `g:${field}`
        return getField(gField)
      }
      
      const product = {
        product_id: getGField('id'),
        title: getField('title'),
        description: getField('description'),
        link: getField('link'),
        image_link: getGField('image_link'),
        price: getGField('price'),
        brand: getGField('brand'),
        mpn: getGField('mpn'),
        gtin: getGField('gtin'),
        availability: getGField('availability'),
        condition: getGField('condition'),
        product_type: getGField('product_type'),
        imported_at: new Date()
      }
      
      products.push(product)
    }
    
    // Bulk Insert
    if (products.length > 0) {
      await collection.insertMany(products)
      console.log(`✅ ${products.length} Produkte importiert`)
    }
    
    // Erstelle Indexes für schnelle Suche
    await collection.createIndex({ mpn: 1 })
    await collection.createIndex({ gtin: 1 })
    await collection.createIndex({ brand: 1 })
    await collection.createIndex({ title: 'text', description: 'text' })
    console.log('✅ Indexes erstellt')
    
    console.log(`\n🎉 Shopping Feed Import erfolgreich!`)
    console.log(`📊 ${products.length} Produkte in MongoDB gespeichert`)
    
  } catch (error) {
    console.error('❌ Fehler beim Import:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

importShoppingFeed()
