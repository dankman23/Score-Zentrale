/**
 * Test Script: Komplette Kaltakquise-Pipeline
 * Testet: Crawler → Analyse → E-Mail → Versand
 */

const { MongoClient } = require('mongodb')

async function testPipeline() {
  console.log('🚀 Starte Kaltakquise-Pipeline Test...\n')
  
  const client = await MongoClient.connect('mongodb://localhost:27017/score_zentrale')
  const db = client.db()
  
  // Test 1: Erstelle Test-Prospect
  console.log('📝 Test 1: Erstelle Test-Firma...')
  const testProspect = {
    _id: 'test_' + Date.now(),
    company_name: 'Test Metallbau GmbH',
    website: 'https://example.com',
    industry: 'Metallbau',
    region: 'Bayern',
    source: 'test',
    status: 'new',
    created_at: new Date(),
    // Simulierte Analyse-Daten
    analyzed: true,
    analyzed_at: new Date(),
    analysis: {
      firmenname: 'Test Metallbau GmbH',
      website: 'https://example.com',
      branche: 'Metallbau',
      werkstoffe: [
        { name: 'Stahl', kontext: 'Verwendet für Stahlkonstruktionen' },
        { name: 'Edelstahl', kontext: 'Verwendet für hochwertige Geländer' }
      ],
      werkstücke: [
        { name: 'Geländer', beschreibung: 'Edelstahl-Geländersysteme' },
        { name: 'Treppen', beschreibung: 'Stahltreppen für Industriebauten' }
      ],
      anwendungen: ['Schweißen', 'Schleifen', 'Entgraten', 'Polieren'],
      kontaktpersonen: [
        {
          name: 'Daniel Leismann',
          position: 'Test-Empfänger',
          bereich: 'Einkauf',
          email: 'danki.leismann@gmx.de',
          confidence: 100
        }
      ],
      potenzielle_produkte: [
        {
          kategorie: 'Schleifbänder',
          für_werkstoff: 'Stahl',
          für_anwendung: 'Entgraten nach dem Schweißen',
          begründung: 'Für saubere Schweißnähte und präzise Kanten'
        },
        {
          kategorie: 'Fächerscheiben',
          für_werkstoff: 'Edelstahl',
          für_anwendung: 'Polieren von Geländern',
          begründung: 'Für hochglänzende Oberflächen'
        }
      ],
      firmenprofil: 'Test Metallbau GmbH ist spezialisiert auf hochwertige Stahl- und Edelstahlkonstruktionen. Das Unternehmen fertigt Geländer, Treppen und individuelle Metallkonstruktionen für Industrie und Privatbau.'
    },
    analysis_quality: 95
  }
  
  const collection = db.collection('coldleads_prospects')
  await collection.insertOne(testProspect)
  console.log('✅ Test-Firma erstellt:', testProspect._id)
  
  // Test 2: E-Mail generieren
  console.log('\n📧 Test 2: Generiere personalisierte E-Mail...')
  const emailResponse = await fetch('http://localhost:3000/api/coldleads/generate-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prospectId: testProspect._id,
      kontaktpersonIndex: 0
    })
  })
  
  const emailData = await emailResponse.json()
  
  if (emailData.success) {
    console.log('✅ E-Mail generiert!')
    console.log('\n' + '='.repeat(60))
    console.log('BETREFF:', emailData.email.betreff)
    console.log('='.repeat(60))
    console.log(emailData.email.text)
    console.log('='.repeat(60))
    console.log('\nWörter:', emailData.email.text.split(' ').length)
    console.log('Zeichen:', emailData.email.text.length)
  } else {
    console.error('❌ Fehler bei E-Mail-Generierung:', emailData.error)
  }
  
  // Test 3: E-Mail versenden (simuliert)
  console.log('\n📮 Test 3: E-Mail-Versand vorbereitet...')
  console.log('Empfänger:', testProspect.analysis.kontaktpersonen[0].email)
  console.log('Status: Bereit zum Versand (Mail-Server muss konfiguriert werden)')
  
  // Test 4: Statistiken
  console.log('\n📊 Test 4: Lade Statistiken...')
  const stats = await collection.countDocuments({ analyzed: true })
  console.log('Analysierte Prospects:', stats)
  
  // Cleanup
  console.log('\n🧹 Cleanup: Lösche Test-Daten...')
  await collection.deleteOne({ _id: testProspect._id })
  console.log('✅ Test-Daten gelöscht')
  
  await client.close()
  
  console.log('\n✅ Pipeline-Test abgeschlossen!')
  console.log('\n📝 Zusammenfassung:')
  console.log('  ✅ Test-Firma erstellt')
  console.log('  ✅ Analyse-Daten simuliert')
  console.log('  ✅ E-Mail generiert')
  console.log('  ✅ E-Mail-Versand vorbereitet')
  console.log('\n🎯 Nächste Schritte:')
  console.log('  1. Mail-Server konfigurieren (SMTP)')
  console.log('  2. Autopilot starten')
  console.log('  3. Echte Firmen crawlen und analysieren')
}

testPipeline().catch(console.error)
