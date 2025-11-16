const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkKontenplan() {
  const client = await MongoClient.connect(process.env.MONGO_URL);
  const db = client.db('fibu');
  
  const konten = await db.collection('fibu_konten').find({}).sort({ kontonummer: 1 }).toArray();
  
  console.log('=== AKTUELLE KONTEN IN DATENBANK ===');
  console.log('Anzahl:', konten.length);
  console.log('\nKontonummern:');
  konten.forEach(k => {
    console.log(`${k.kontonummer} - ${k.bezeichnung}`);
  });
  
  await client.close();
}

checkKontenplan().catch(console.error);
