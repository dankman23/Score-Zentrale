const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const CATALOG_DIR = path.join(__dirname, '../data/catalogs')

const catalogs = [
  { 
    file: 'klingspor.pdf',
    manufacturer: 'Klingspor',
    name: 'Klingspor Katalog',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/40xfkgzc_Klingspor%20Katalog.pdf'
  },
  {
    file: 'norton.pdf',
    manufacturer: 'Norton',
    name: 'Norton St. Gobain INDUSTRIELLE ANWENDUNGEN KATALOG 2025',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/p7mzcjps_Norton%20St.%20Gobain%20INDUSTRIELLE%20ANWENDUNGEN%20KATALOG%202025.pdf'
  },
  {
    file: 'norton-clipper.pdf',
    manufacturer: 'Norton Clipper',
    name: 'NORTON CLIPPER KATALOG 2025',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/i26renzq_NORTON%20CLIPPER%20%20KATALOG%202025.pdf'
  },
  {
    file: 'norton-schleifmittel.pdf',
    manufacturer: 'Norton',
    name: 'Norton Schleifmittel AAM_Cat_2025-SWISS',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/0r73wvws_Norton%20Schleifmittel%20AAM_Cat_2025-SWISS.pdf'
  },
  {
    file: 'pferd.pdf',
    manufacturer: 'PFERD',
    name: 'PFERD Katalog',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/n2uanbjc_PFERD%20Katalog.pdf'
  },
  {
    file: 'starke.pdf',
    manufacturer: 'Starcke',
    name: 'Starcke Katalog',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/p062vivj_Starke%20Katalog.pdf'
  },
  {
    file: 'vsm.pdf',
    manufacturer: 'VSM',
    name: 'VSM Katalog',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/of6i0cm8_VSM%20Katalog.pdf'
  },
  {
    file: '3m.pdf',
    manufacturer: '3M',
    name: '3M Katalog',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/0ct5f2qg_3M%20Katalog.pdf'
  },
  {
    file: 'lukas.pdf',
    manufacturer: 'LUKAS',
    name: 'LUKAS Gesamtkatalog 2026-2027',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/s0omg7no_LUKAS_Gesamtkatalog_2026-2027_deutsch_gesamt_web_2.pdf'
  },
  {
    file: 'rhodius.pdf',
    manufacturer: 'RHODIUS',
    name: 'RHODIUS Katalog',
    url: 'https://customer-assets.emergentagent.com/job_jtlsync/artifacts/15xs37ic_RHODIUS%20Katalog.pdf'
  }
]

async function importCatalogs() {
  console.log('🚀 Starte Katalog-Import...')
  
  const mongoUrl = process.env.MONGO_URL
  const dbName = process.env.DB_NAME || process.env.MONGO_DB
  
  if (!mongoUrl || !dbName) {
    console.error('❌ MONGO_URL oder DB_NAME nicht gesetzt!')
    process.exit(1)
  }
  
  const client = new MongoClient(mongoUrl)
  
  try {
    await client.connect()
    console.log('✅ MongoDB verbunden')
    
    const db = client.db(dbName)
    const collection = db.collection('manufacturer_catalogs')
    
    // Lösche alte Kataloge
    await collection.deleteMany({})
    console.log('🗑️  Alte Kataloge gelöscht')
    
    for (const catalog of catalogs) {
      const filePath = path.join(CATALOG_DIR, catalog.file)
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  ${catalog.file} nicht gefunden, überspringe...`)
        continue
      }
      
      const stats = fs.statSync(filePath)
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
      
      console.log(`📄 Importiere ${catalog.manufacturer} (${sizeInMB} MB)...`)
      
      // Speichere Katalog-Metadaten in MongoDB
      await collection.insertOne({
        manufacturer: catalog.manufacturer,
        name: catalog.name,
        file: catalog.file,
        url: catalog.url,
        size_mb: parseFloat(sizeInMB),
        file_path: filePath,
        imported_at: new Date(),
        status: 'active'
      })
      
      console.log(`✅ ${catalog.manufacturer} importiert`)
    }
    
    const count = await collection.countDocuments()
    console.log(`\n🎉 ${count} Kataloge erfolgreich importiert!`)
    
  } catch (error) {
    console.error('❌ Fehler beim Import:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

importCatalogs()
