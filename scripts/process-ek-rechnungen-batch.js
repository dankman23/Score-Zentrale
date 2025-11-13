/**
 * Batch-Processing für EK-Rechnungen aus Email-Inbox
 * 
 * Verarbeitet alle pending PDFs mit intelligentem Parsing
 */

const { MongoClient } = require('mongodb');
const pdfParse = require('pdf-parse');
require('dotenv').config({ path: '/app/.env' });

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Kreditor-Matching Funktion
function findKreditorByFilename(filename, kreditoren) {
  // 1. Versuche Kreditor-Nummer (70XXX)
  const kreditorNrMatch = filename.match(/^(70\d{3})/);
  if (kreditorNrMatch) {
    const nr = kreditorNrMatch[1];
    const kreditor = kreditoren.find(k => k.kreditorenNummer === nr);
    if (kreditor) return { kreditor, method: 'number' };
  }
  
  // 2. Versuche Name im Dateinamen
  const lower = filename.toLowerCase();
  const nameMatches = [
    { pattern: 'klingspor', kreditorNr: '70004' },
    { pattern: 'rüggeberg', kreditorNr: '70005' },
    { pattern: 'ggeberg', kreditorNr: '70005' },
    { pattern: 'starcke', kreditorNr: '70006' },
    { pattern: 'vsm', kreditorNr: '70009' },
    { pattern: 'lukas', kreditorNr: '70010' },
    { pattern: 'dpd', kreditorNr: '70007' },
    { pattern: 'plastimex', kreditorNr: '70015' },
    { pattern: 'nissen', kreditorNr: '70018' },
    { pattern: 'grüne punkt', kreditorNr: '70014' },
    { pattern: 'händlerbund', kreditorNr: '70008' },
    { pattern: 'haufe', kreditorNr: '70001' }
  ];
  
  for (const match of nameMatches) {
    if (lower.includes(match.pattern)) {
      const kreditor = kreditoren.find(k => k.kreditorenNummer === match.kreditorNr);
      if (kreditor) return { kreditor, method: `name:${match.pattern}` };
    }
  }
  
  return { kreditor: null, method: 'none' };
}

// Template-basiertes Parsing
function parseWithTemplate(text, kreditor, filename) {
  const result = {
    lieferantName: kreditor?.name || 'Unbekannt',
    rechnungsNummer: '',
    rechnungsDatum: '',
    betrag: 0,
    nettoBetrag: null,
    steuersatz: 19,
    confidence: kreditor ? 60 : 30,
    method: 'template'
  };
  
  // Rechnungsnummer
  const rnPatterns = [
    /Rechnung[:\s-]*Nr?[.:\s]*(\d{5,10})/i,
    /Rg[.-]?Nr[.:\s]*(\d+)/i,
    /Invoice[:\s]*(\d+)/i,
    /Beleg[:\s-]*Nr?[.:\s]*(\d+)/i,
    /(\d{8,10})/  // Fallback: 8-10 stellige Zahl
  ];
  
  for (const pattern of rnPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.rechnungsNummer = match[1];
      result.confidence += 15;
      break;
    }
  }
  
  // Datum
  const datePatterns = [
    /Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i,
    /(\d{1,2}\.\d{1,2}\.\d{4})/,
    /(\d{4}-\d{2}-\d{2})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.rechnungsDatum = match[1];
      result.confidence += 10;
      break;
    }
  }
  
  // Betrag
  const betragPatterns = [
    /Gesamt[betrag]*[:\s]*([\d.,]+)\s*€?/i,
    /Rechnungsbetrag[:\s]*([\d.,]+)/i,
    /Total[:\s]*([\d.,]+)/i,
    /Summe[:\s]*([\d.,]+)/i,
    /Endbetrag[:\s]*([\d.,]+)/i
  ];
  
  for (const pattern of betragPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const betragStr = match[1].replace(/\./g, '').replace(',', '.');
      result.betrag = parseFloat(betragStr);
      if (result.betrag > 0) {
        result.confidence += 15;
        break;
      }
    }
  }
  
  return result;
}

// Gemini API Parsing (vereinfacht)
async function parseWithGemini(text, kreditorName) {
  if (!GEMINI_API_KEY) {
    console.log('⚠️ Kein Gemini API Key - überspringe AI-Parsing');
    return null;
  }
  
  // Hier würde der echte Gemini API Call kommen
  // Für jetzt: Fallback auf Template
  return null;
}

async function main() {
  const limit = parseInt(process.argv[2] || '20', 10);
  const testMode = process.argv[3] === 'test';
  
  console.log('🚀 Batch-Processing für EK-Rechnungen');
  console.log(`   Limit: ${limit} PDFs`);
  console.log(`   Modus: ${testMode ? 'TEST (kein Speichern)' : 'PRODUKTIV'}\n`);
  
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  
  const inboxCol = db.collection('fibu_email_inbox');
  const ekCol = db.collection('fibu_ek_rechnungen');
  const kreditorenCol = db.collection('kreditoren');
  
  // Lade alle Kreditoren
  const kreditoren = await kreditorenCol.find({}).toArray();
  console.log(`📋 ${kreditoren.length} Kreditoren geladen\n`);
  
  // Hole pending PDFs
  const pdfs = await inboxCol.find({ status: 'pending' }).limit(limit).toArray();
  console.log(`📄 ${pdfs.length} PDFs zum Verarbeiten gefunden\n`);
  
  if (pdfs.length === 0) {
    console.log('✅ Keine pending PDFs - fertig!');
    await client.close();
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];
    console.log(`\n[${i+1}/${pdfs.length}] ${pdf.filename}`);
    
    try {
      // 1. PDF Text extrahieren
      const pdfBuffer = Buffer.from(pdf.pdfBase64, 'base64');
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;
      console.log(`   Text: ${pdfText.length} Zeichen`);
      
      // 2. Kreditor-Matching
      const { kreditor, method } = findKreditorByFilename(pdf.filename, kreditoren);
      if (kreditor) {
        console.log(`   ✅ Kreditor: ${kreditor.name} (${kreditor.kreditorenNummer}) [${method}]`);
      } else {
        console.log(`   ⚠️ Kein Kreditor gefunden`);
      }
      
      // 3. Parsing mit Template
      const parsed = parseWithTemplate(pdfText, kreditor, pdf.filename);
      console.log(`   📊 Parsed: RgNr=${parsed.rechnungsNummer}, Betrag=${parsed.betrag}€, Confidence=${parsed.confidence}%`);
      
      // 4. Validierung
      if (!parsed.rechnungsNummer || parsed.betrag === 0) {
        console.log(`   ⚠️ Unvollständig - überspringe`);
        errorCount++;
        results.push({
          filename: pdf.filename,
          status: 'incomplete',
          parsed
        });
        continue;
      }
      
      // 5. Speichern (wenn nicht Test-Modus)
      if (!testMode) {
        const rechnung = {
          lieferantName: parsed.lieferantName,
          rechnungsNummer: parsed.rechnungsNummer,
          rechnungsdatum: parsed.rechnungsDatum ? new Date(parsed.rechnungsDatum) : new Date(),
          eingangsdatum: new Date(pdf.emailDate),
          gesamtBetrag: parsed.betrag,
          nettoBetrag: parsed.nettoBetrag || (parsed.betrag / 1.19),
          steuerBetrag: parsed.betrag - (parsed.nettoBetrag || parsed.betrag / 1.19),
          steuersatz: parsed.steuersatz,
          kreditorKonto: kreditor?.kreditorenNummer || null,
          aufwandskonto: kreditor?.standardAufwandskonto || '5200',
          beschreibung: `Email-Import: ${pdf.filename}`,
          pdf_base64: pdf.pdfBase64,
          parsed_data: parsed,
          parsing: {
            method: parsed.method,
            confidence: parsed.confidence,
            kreditorMethod: method
          },
          sourceEmailId: pdf._id,
          created_at: new Date(),
          updated_at: new Date()
        };
        
        const insertResult = await ekCol.insertOne(rechnung);
        
        // Update Inbox Status
        await inboxCol.updateOne(
          { _id: pdf._id },
          { 
            $set: { 
              status: 'processed',
              processedAt: new Date(),
              rechnungId: insertResult.insertedId
            }
          }
        );
        
        console.log(`   ✅ Gespeichert in DB`);
      } else {
        console.log(`   ✅ Test OK (nicht gespeichert)`);
      }
      
      successCount++;
      results.push({
        filename: pdf.filename,
        status: 'success',
        lieferant: parsed.lieferantName,
        rechnungsNr: parsed.rechnungsNummer,
        betrag: parsed.betrag,
        confidence: parsed.confidence
      });
      
    } catch (error) {
      console.log(`   ❌ Fehler: ${error.message}`);
      errorCount++;
      results.push({
        filename: pdf.filename,
        status: 'error',
        error: error.message
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`Verarbeitet: ${pdfs.length}`);
  console.log(`✅ Erfolg:   ${successCount}`);
  console.log(`❌ Fehler:   ${errorCount}`);
  console.log(`📈 Rate:     ${(successCount/pdfs.length*100).toFixed(1)}%`);
  
  if (!testMode && successCount > 0) {
    console.log(`\n💾 ${successCount} Rechnungen in MongoDB gespeichert`);
  }
  
  // Top Lieferanten
  const byLieferant = {};
  results.filter(r => r.status === 'success').forEach(r => {
    byLieferant[r.lieferant] = (byLieferant[r.lieferant] || 0) + 1;
  });
  
  if (Object.keys(byLieferant).length > 0) {
    console.log('\n🏭 Top Lieferanten:');
    Object.entries(byLieferant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([name, count]) => {
        console.log(`   ${count}x ${name}`);
      });
  }
  
  await client.close();
  console.log('\n✅ Fertig!');
}

main().catch(err => {
  console.error('❌ Fehler:', err);
  process.exit(1);
});
