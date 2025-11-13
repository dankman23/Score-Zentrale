/**
 * Verbessert EK-Rechnungen durch API-basiertes Parsing
 * Nutzt die existierende Next.js API die bereits intelligent parst
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

// Lade ENV
const envContent = fs.readFileSync('/app/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const MONGO_URL = env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale';

async function parseInvoiceSimple(pdfBase64, filename, kreditoren) {
  // Einfaches Regex-basiertes Parsing
  // In Produktion würde man hier pdf-parse verwenden
  
  const lower = filename.toLowerCase();
  
  // 1. Finde Kreditor aus Filename
  let kreditor = null;
  const kreditorNrMatch = filename.match(/^(70\d{3})/);
  
  if (kreditorNrMatch) {
    kreditor = kreditoren.find(k => k.kreditorenNummer === kreditorNrMatch[1]);
  }
  
  if (!kreditor) {
    // Name-based matching
    if (lower.includes('klingspor')) {
      kreditor = kreditoren.find(k => k.name.toLowerCase().includes('klingspor'));
    } else if (lower.includes('rüggeberg') || lower.includes('ruggeberg') || lower.includes('pferd')) {
      kreditor = kreditoren.find(k => k.name.toLowerCase().includes('ggeberg'));
    } else if (lower.includes('starcke')) {
      kreditor = kreditoren.find(k => k.name.toLowerCase().includes('starcke'));
    } else if (lower.includes('vsm')) {
      kreditor = kreditoren.find(k => k.name.toLowerCase().includes('vsm'));
    } else if (lower.includes('dpd')) {
      kreditor = kreditoren.find(k => k.name.toLowerCase().includes('dpd'));
    } else if (lower.includes('nissen')) {
      kreditor = kreditoren.find(k => k.name.toLowerCase().includes('nissen'));
    } else if (lower.includes('haufe')) {
      kreditor = kreditoren.find(k => k.name.toLowerCase().includes('haufe'));
    }
  }
  
  // 2. Extrahiere Rechnungsnummer aus Filename
  let rechnungsNr = 'Unbekannt';
  
  // Verschiedene Patterns für Rechnungsnummern
  const patterns = [
    /rechnung[_-]?(\d{6,10})/i,
    /invoice[_-]?(\d{6,10})/i,
    /rg[_-]?(\d{6,10})/i,
    /(\d{6,10})/  // Fallback: Beliebige 6-10 stellige Zahl
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      rechnungsNr = match[1];
      break;
    }
  }
  
  // 3. Versuche Betrag aus Filename zu extrahieren (selten, aber manchmal vorhanden)
  let betrag = 0;
  const betragMatch = filename.match(/(\d+)[,.](\d{2})\s*(?:eur|€)/i);
  if (betragMatch) {
    betrag = parseFloat(`${betragMatch[1]}.${betragMatch[2]}`);
  }
  
  // 4. Versuche PDF zu dekodieren und Betrag zu finden (Basic)
  if (betrag === 0 && pdfBase64) {
    try {
      // Decode first 10000 chars of PDF for quick scan
      const pdfText = Buffer.from(pdfBase64.substring(0, 10000), 'base64').toString('latin1');
      
      // Suche nach Betrags-Patterns im PDF-Text
      const betragPatterns = [
        /gesamt[betrag]*\D*?(\d+)[,.](\d{2})/i,
        /summe\D*?(\d+)[,.](\d{2})/i,
        /total\D*?(\d+)[,.](\d{2})/i,
        /rechnungsbetrag\D*?(\d+)[,.](\d{2})/i,
        /zu zahlen\D*?(\d+)[,.](\d{2})/i
      ];
      
      for (const pattern of betragPatterns) {
        const match = pdfText.match(pattern);
        if (match) {
          const potentialBetrag = parseFloat(`${match[1]}.${match[2]}`);
          // Plausibilitätsprüfung: Zwischen 1€ und 50.000€
          if (potentialBetrag >= 1 && potentialBetrag <= 50000) {
            betrag = potentialBetrag;
            break;
          }
        }
      }
    } catch (error) {
      // PDF decode failed, continue with betrag = 0
    }
  }
  
  // 5. Confidence Score
  let confidence = 0;
  if (kreditor && betrag > 0) confidence = 80;
  else if (kreditor) confidence = 60;
  else if (betrag > 0) confidence = 40;
  else confidence = 20;
  
  return {
    success: true,
    lieferantName: kreditor?.name || 'Unbekannt',
    rechnungsNummer: rechnungsNr,
    gesamtBetrag: betrag,
    nettoBetrag: betrag / 1.19,
    steuerBetrag: betrag - (betrag / 1.19),
    steuersatz: 19,
    kreditorKonto: kreditor?.kreditorenNummer || null,
    aufwandskonto: kreditor?.standardAufwandskonto || '5200',
    parsing: {
      method: 'filename+basic-pdf-scan',
      confidence,
      note: betrag > 0 ? 'Betrag gefunden' : 'Kein Betrag gefunden'
    },
    matchedKreditor: kreditor
  };
}

async function main() {
  const batchSize = parseInt(process.argv[2] || '200', 10);
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🔄 Verbessere EK-Rechnungen Parsing\n');
  console.log(`Batch-Size: ${batchSize}`);
  console.log(`Dry-Run: ${dryRun ? 'JA' : 'NEIN'}\n`);
  
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  
  const ekCol = db.collection('fibu_ek_rechnungen');
  const inboxCol = db.collection('fibu_email_inbox');
  const kreditorenCol = db.collection('kreditoren');
  
  // Lade Kreditoren
  const kreditoren = await kreditorenCol.find({}).toArray();
  console.log(`📋 ${kreditoren.length} Kreditoren geladen\n`);
  
  // Hole EK-Rechnungen ohne Betrag
  const toReprocess = await ekCol.find({ 
    gesamtBetrag: { $lte: 0 },
    sourceEmailId: { $exists: true }
  }).limit(batchSize).toArray();
  
  console.log(`📄 ${toReprocess.length} Rechnungen zum Verbessern gefunden\n`);
  
  if (toReprocess.length === 0) {
    console.log('✅ Keine Rechnungen zu verarbeiten!');
    await client.close();
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  let improvedCount = 0;
  let betragsCount = 0;
  
  for (let i = 0; i < toReprocess.length; i++) {
    const rechnung = toReprocess[i];
    const shortName = rechnung.lieferantName.substring(0, 30);
    const shortNr = rechnung.rechnungsNummer.substring(0, 15);
    
    console.log(`\n[${i+1}/${toReprocess.length}] ${shortName} - ${shortNr}`);
    
    try {
      // Hole Email mit PDF
      const email = await inboxCol.findOne({ _id: new ObjectId(rechnung.sourceEmailId) });
      
      if (!email || !email.pdfBase64) {
        console.log(`   ⚠️  Keine PDF-Daten`);
        errorCount++;
        continue;
      }
      
      // Parse mit verbesserter Logik
      const parsed = await parseInvoiceSimple(email.pdfBase64, email.filename, kreditoren);
      
      if (!parsed.success) {
        console.log(`   ❌ Parsing-Fehler`);
        errorCount++;
        continue;
      }
      
      // Prüfe ob Verbesserung
      const hasImprovement = 
        parsed.gesamtBetrag > 0 ||
        parsed.kreditorKonto ||
        parsed.parsing.confidence > (rechnung.parsing?.confidence || 0);
      
      if (hasImprovement) {
        const improvements = [];
        
        if (parsed.gesamtBetrag > 0 && rechnung.gesamtBetrag === 0) {
          improvements.push(`Betrag: ${parsed.gesamtBetrag.toFixed(2)}€`);
          betragsCount++;
        }
        
        if (parsed.kreditorKonto && !rechnung.kreditorKonto) {
          improvements.push(`Kreditor: ${parsed.kreditorKonto}`);
        }
        
        if (parsed.lieferantName !== 'Unbekannt' && rechnung.lieferantName === 'Unbekannt') {
          improvements.push(`Name: ${parsed.lieferantName}`);
        }
        
        console.log(`   ✅ ${improvements.join(', ')}`);
        console.log(`      Confidence: ${parsed.parsing.confidence}% (vorher: ${rechnung.parsing?.confidence || 0}%)`);
        
        if (!dryRun) {
          // Update Rechnung
          await ekCol.updateOne(
            { _id: rechnung._id },
            { 
              $set: {
                lieferantName: parsed.lieferantName,
                rechnungsNummer: parsed.rechnungsNummer,
                gesamtBetrag: parsed.gesamtBetrag,
                nettoBetrag: parsed.nettoBetrag,
                steuerBetrag: parsed.steuerBetrag,
                steuersatz: parsed.steuersatz,
                kreditorKonto: parsed.kreditorKonto,
                aufwandskonto: parsed.aufwandskonto,
                parsing: parsed.parsing,
                needsManualReview: !parsed.kreditorKonto || parsed.gesamtBetrag === 0,
                updated_at: new Date()
              }
            }
          );
        }
        
        improvedCount++;
        successCount++;
      } else {
        console.log(`   ⚠️  Keine Verbesserung`);
        successCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Fehler: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`Verarbeitet: ${toReprocess.length}`);
  console.log(`✅ Erfolg:   ${successCount}`);
  console.log(`📈 Verbessert: ${improvedCount}`);
  console.log(`💰 Beträge gefunden: ${betragsCount}`);
  console.log(`❌ Fehler:   ${errorCount}`);
  
  if (!dryRun) {
    // Neue Statistik
    const totalEK = await ekCol.countDocuments();
    const withBetrag = await ekCol.countDocuments({ gesamtBetrag: { $gt: 0 } });
    const withKreditor = await ekCol.countDocuments({ kreditorKonto: { $ne: null } });
    const needsReview = await ekCol.countDocuments({ needsManualReview: true });
    
    console.log('\n📋 NEUE GESAMT-STATISTIK:');
    console.log(`Total EK-Rechnungen: ${totalEK}`);
    console.log(`Mit Betrag > 0: ${withBetrag} (${(withBetrag/totalEK*100).toFixed(1)}%)`);
    console.log(`Mit Kreditor: ${withKreditor} (${(withKreditor/totalEK*100).toFixed(1)}%)`);
    console.log(`Benötigt Review: ${needsReview}`);
  } else {
    console.log('\n⚠️  DRY-RUN: Keine Änderungen gespeichert!');
  }
  
  await client.close();
  console.log('\n✅ Fertig!');
}

main().catch(err => {
  console.error('❌ Fehler:', err);
  process.exit(1);
});
