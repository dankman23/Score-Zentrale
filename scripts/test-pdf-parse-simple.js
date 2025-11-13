/**
 * Einfacher Test ob PDF-Parsing funktioniert
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');

// Lade ENV
const envContent = fs.readFileSync('/app/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const MONGO_URL = env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale';
const BASE_URL = env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('🧪 Teste PDF-Parsing mit existierender API\n');
  
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  
  // Hole ein Email mit PDF
  const email = await db.collection('fibu_email_inbox').findOne({ 
    pdfBase64: { $exists: true } 
  });
  
  if (!email) {
    console.log('❌ Keine Emails mit PDF gefunden');
    await client.close();
    return;
  }
  
  console.log(`📄 Teste mit: ${email.filename}`);
  console.log(`📧 Von: ${email.emailFrom}`);
  console.log(`📦 PDF-Größe: ${email.pdfBase64.length} chars\n`);
  
  // Verwende die existierende API
  const fetch = (await import('node-fetch')).default;
  
  try {
    const response = await fetch(`${BASE_URL}/api/fibu/rechnungen/ek`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lieferantName: 'Test Supplier',
        rechnungsnummer: 'TEST-123',
        rechnungsdatum: new Date().toISOString(),
        gesamtBetrag: 100,
        pdf_base64: email.pdfBase64.substring(0, 1000) // Nur Test
      })
    });
    
    const result = await response.json();
    console.log('✅ API Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('❌ API Fehler:', error.message);
  }
  
  await client.close();
  console.log('\n✅ Test abgeschlossen');
}

main().catch(err => {
  console.error('❌ Fehler:', err);
  process.exit(1);
});
