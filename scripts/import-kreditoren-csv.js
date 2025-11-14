/**
 * Import-Script für Kreditoren aus CSV
 * Liest CSV und fügt Kreditoren in MongoDB ein
 */

const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale';
const DB_NAME = new URL(MONGO_URL).pathname.substring(1) || 'score_zentrale';

async function importKreditoren(csvPath) {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ MongoDB verbunden');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('kreditoren');
    
    const kreditoren = [];
    
    // Lese CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath, { encoding: 'latin1' })
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          const nummer = row['70000'];
          const name = row['Lieferant'];
          
          if (nummer && name && nummer !== '70000') {
            kreditoren.push({
              kreditorenNummer: nummer.trim(),
              name: name.trim(),
              kategorie: row['4'] || '4',
              created_at: new Date(),
              source: 'csv_import'
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📄 ${kreditoren.length} Kreditoren aus CSV gelesen`);
    
    // WICHTIG: Lösche ALLE alten Kreditoren und ersetze mit CSV-Daten
    console.log('\n⚠️  ACHTUNG: Lösche ALLE bestehenden Kreditoren...');
    const deleteResult = await collection.deleteMany({});
    console.log(`🗑️ ${deleteResult.deletedCount} alte Kreditoren gelöscht`);
    
    if (kreditoren.length > 0) {
      const insertResult = await collection.insertMany(kreditoren);
      console.log(`✅ ${insertResult.insertedCount} Kreditoren importiert`);
      console.log('\n✅ CSV ist jetzt die EINZIGE Datenquelle für Kreditoren');
    }
    
    console.log('\n📊 Beispiele:');
    kreditoren.slice(0, 5).forEach(k => {
      console.log(`  ${k.kreditorenNummer} - ${k.name}`);
    });
    
  } catch (error) {
    console.error('❌ Fehler:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run import
const csvPath = process.argv[2] || '/tmp/kreditoren.csv';
console.log(`\n🚀 Importiere Kreditoren aus: ${csvPath}\n`);
importKreditoren(csvPath);
