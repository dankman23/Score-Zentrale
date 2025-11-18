const fetch = require('node-fetch');

async function runLiveTest() {
  console.log('🚀 LIVE TEST: Komplette Kaltakquise-Pipeline\n');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: DACH-Crawler starten
    console.log('\n📍 SCHRITT 1: Starte DACH-Crawler...');
    console.log('Land: DE (Deutschland)');
    console.log('Region: Bayern');
    console.log('Branche: Metallbau');
    console.log('Limit: 5 Firmen\n');
    
    const crawlResponse = await fetch('http://localhost:3000/api/coldleads/dach-crawler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'DE',
        region: 'Bayern',
        industry: 'Metallbau',
        limit: 5
      })
    });
    
    const crawlData = await crawlResponse.json();
    
    if (!crawlData.ok || !crawlData.prospects || crawlData.prospects.length === 0) {
      console.error('❌ Crawler lieferte keine Ergebnisse:', crawlData);
      return;
    }
    
    console.log(`✅ ${crawlData.prospects.length} Firmen gefunden!`);
    crawlData.prospects.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.company_name} (${p.website})`);
    });
    
    // Wähle erste Firma für Analyse
    const testProspect = crawlData.prospects[0];
    console.log(`\n📊 Test-Firma: ${testProspect.company_name}`);
    console.log(`Website: ${testProspect.website}`);
    
    // Test 2: Firma analysieren
    console.log('\n📊 SCHRITT 2: Analysiere Firma...');
    console.log('(Dies kann 10-20 Sekunden dauern - LLM-Analyse läuft...)\n');
    
    const analyzeResponse = await fetch('http://localhost:3000/api/coldleads/analyze-deep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website: testProspect.website,
        firmenname: testProspect.company_name,
        branche: testProspect.industry,
        prospectId: testProspect.id
      })
    });
    
    const analyzeData = await analyzeResponse.json();
    
    if (!analyzeData.success) {
      console.error('❌ Analyse fehlgeschlagen:', analyzeData.error);
      return;
    }
    
    const analysis = analyzeData.analysis;
    console.log('✅ Analyse abgeschlossen!');
    console.log(`\nQualität: ${analysis.analyse_qualität}%`);
    console.log(`Branche: ${analysis.branche}`);
    console.log(`Werkstoffe: ${analysis.werkstoffe.map(w => w.name).join(', ')}`);
    console.log(`Kontakte: ${analysis.kontaktpersonen.length}`);
    
    if (analysis.kontaktpersonen.length === 0) {
      console.warn('⚠️ Keine Kontaktpersonen gefunden - kann keine E-Mail senden');
      return;
    }
    
    const kontakt = analysis.kontaktpersonen[0];
    console.log(`\nHauptkontakt: ${kontakt.name} (${kontakt.position})`);
    console.log(`E-Mail: ${kontakt.email || 'Nicht gefunden'}`);
    
    if (!kontakt.email) {
      console.warn('⚠️ Keine E-Mail-Adresse - kann nicht senden');
      return;
    }
    
    // Test 3: E-Mail generieren & versenden
    console.log('\n📧 SCHRITT 3: Generiere & versende E-Mail...');
    console.log(`An: ${kontakt.email}`);
    console.log(`BCC: danki.leismann@gmx.de\n`);
    
    const emailResponse = await fetch('http://localhost:3000/api/coldleads/generate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospectId: testProspect.id,
        kontaktpersonIndex: 0,
        sendNow: true
      })
    });
    
    const emailData = await emailResponse.json();
    
    if (!emailData.success) {
      console.error('❌ E-Mail-Generierung fehlgeschlagen:', emailData.error);
      return;
    }
    
    console.log('✅ E-Mail generiert!');
    console.log('\n' + '='.repeat(60));
    console.log('BETREFF:', emailData.email.betreff);
    console.log('='.repeat(60));
    console.log(emailData.email.text);
    console.log('='.repeat(60));
    
    if (emailData.sent) {
      console.log('\n✅✅✅ E-MAIL ERFOLGREICH VERSENDET! ✅✅✅');
      console.log(`\nEmpfänger: ${kontakt.email}`);
      console.log(`BCC: danki.leismann@gmx.de`);
      console.log(`Message-ID: ${emailData.sendResult?.messageId || 'N/A'}`);
      console.log('\n📬 Prüfen Sie Ihr Postfach: danki.leismann@gmx.de');
    } else {
      console.warn('\n⚠️ E-Mail wurde generiert, aber NICHT versendet');
      console.warn('Mögliche Gründe: SMTP-Fehler, fehlende Konfiguration');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST ABGESCHLOSSEN!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    console.error(error.stack);
  }
}

runLiveTest();
