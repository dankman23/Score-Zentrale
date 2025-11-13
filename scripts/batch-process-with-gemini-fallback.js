/**
 * Batch-Processing mit Python-Parsern + Gemini-Fallback
 * 1. Versuche Python-Parser (schnell, präzise)
 * 2. Falls unbekannter Lieferant: Gemini AI (flexibel, kostet API-Credits)
 */

const { MongoClient, ObjectId } = require('mongodb');
const { spawn } = require('child_process');
const fs = require('fs');

// Lade ENV
const envContent = fs.readFileSync('/app/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const MONGO_URL = env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale';
const GOOGLE_API_KEY = env.GOOGLE_API_KEY || '';

if (!GOOGLE_API_KEY) {
  console.log('⚠️  WARNUNG: GOOGLE_API_KEY nicht gesetzt. Gemini-Fallback deaktiviert.');
}

async function callPythonParser(pdfBase64, filename) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', ['/app/python_libs/fibu_invoice_parser.py']);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        reject(new Error(`JSON parse error: ${error.message}`));
      }
    });
    
    python.stdin.write(JSON.stringify({ pdf_base64: pdfBase64, filename }));
    python.stdin.end();
  });
}

async function callGeminiParser(pdfBase64, emailContext) {
  // Dynamischer Import von Gemini-Modul
  const { extractInvoiceData } = await import('../app/lib/gemini.ts');
  
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  
  try {
    const result = await extractInvoiceData(pdfBuffer, undefined, emailContext);
    
    if (result.error) {
      return {
        success: false,
        error: result.error
      };
    }
    
    // Mappe Gemini-Output zu unserem Format
    return {
      success: true,
      lieferant: result.lieferant || 'Unbekannt',
      rechnungsnummer: result.rechnungsnummer || 'Unbekannt',
      datum: result.datum || new Date().toISOString().split('T')[0],
      gesamtbetrag: result.gesamtbetrag || 0,
      nettobetrag: result.nettobetrag || 0,
      steuerbetrag: result.mehrwertsteuer || 0,
      steuersatz: result.mwstSatz || 19,
      kreditor: null, // Wird später manuell zugeordnet
      parsing_method: 'gemini-ai',
      confidence: result.gesamtbetrag > 0 ? 80 : 50,
      positions_count: result.positionen?.length || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const batchSize = parseInt(process.argv[2] || '200', 10);
  const dryRun = process.argv.includes('--dry-run');
  const useGemini = process.argv.includes('--gemini') || !process.argv.includes('--no-gemini');
  
  console.log('🤖 Hybrid Batch-Processing: Python + Gemini\n');
  console.log(`Batch-Size: ${batchSize}`);
  console.log(`Dry-Run: ${dryRun ? 'JA' : 'NEIN'}`);
  console.log(`Gemini-Fallback: ${useGemini && GOOGLE_API_KEY ? 'AKTIVIERT' : 'DEAKTIVIERT'}\n`);
  
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  
  const ekCol = db.collection('fibu_ek_rechnungen');
  const inboxCol = db.collection('fibu_email_inbox');
  const kreditorenCol = db.collection('kreditoren');
  
  const kreditoren = await kreditorenCol.find({}).toArray();
  console.log(`📋 ${kreditoren.length} Kreditoren geladen\n`);
  
  // Hole pending PDFs
  const toProcess = await inboxCol.find({ 
    pdfBase64: { $exists: true },
    status: 'pending'
  }).limit(batchSize).toArray();
  
  console.log(`📄 ${toProcess.length} PDFs zum Verarbeiten\n`);
  
  if (toProcess.length === 0) {
    console.log('✅ Keine PDFs zu verarbeiten!');
    await client.close();
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  let pythonSuccessCount = 0;
  let geminiSuccessCount = 0;
  let parsedWithAmount = 0;
  let totalAmount = 0;
  
  for (let i = 0; i < toProcess.length; i++) {
    const email = toProcess[i];
    const shortFilename = email.filename.substring(0, 50);
    
    console.log(`\n[${i+1}/${toProcess.length}] ${shortFilename}`);
    
    let parsed = null;
    let parsingMethod = 'none';
    
    try {
      // 1. Versuche Python-Parser
      parsed = await callPythonParser(email.pdfBase64, email.filename);
      
      if (parsed.success) {
        parsingMethod = 'python';
        pythonSuccessCount++;
        console.log(`   ✅ [Python] ${parsed.lieferant}`);
      } else {
        // 2. Fallback zu Gemini
        if (useGemini && GOOGLE_API_KEY) {
          console.log(`   🔄 [Python] ${parsed.error} - Versuche Gemini...`);
          
          const emailContext = {
            from: email.emailFrom,
            subject: email.subject,
            body: email.bodyText || ''
          };
          
          parsed = await callGeminiParser(email.pdfBase64, emailContext);
          
          if (parsed.success) {
            parsingMethod = 'gemini';
            geminiSuccessCount++;
            console.log(`   ✅ [Gemini] ${parsed.lieferant}`);
          } else {
            console.log(`   ❌ [Gemini] ${parsed.error}`);
            errorCount++;
            continue;
          }
        } else {
          console.log(`   ⚠️  ${parsed.error}`);
          errorCount++;
          continue;
        }
      }
      
      // Zeige Details
      console.log(`      RgNr: ${parsed.rechnungsnummer}`);
      console.log(`      Betrag: ${parsed.gesamtbetrag.toFixed(2)}€`);
      console.log(`      Kreditor: ${parsed.kreditor || 'N/A'}`);
      console.log(`      Confidence: ${parsed.confidence}%`);
      
      if (!dryRun) {
        // Speichere EK-Rechnung
        const ekRechnung = {
          lieferantName: parsed.lieferant,
          rechnungsNummer: parsed.rechnungsnummer,
          rechnungsdatum: new Date(parsed.datum),
          gesamtBetrag: parsed.gesamtbetrag,
          nettoBetrag: parsed.nettobetrag,
          steuerBetrag: parsed.steuerbetrag,
          steuersatz: parsed.steuersatz,
          kreditorKonto: parsed.kreditor,
          aufwandskonto: '5200',
          sourceEmailId: email._id.toString(),
          parsing: {
            method: parsed.parsing_method,
            confidence: parsed.confidence,
            parsedAt: new Date()
          },
          needsManualReview: !parsed.kreditor || parsed.gesamtbetrag === 0,
          created_at: new Date()
        };
        
        // Prüfe ob schon existiert
        const existing = await ekCol.findOne({ sourceEmailId: email._id.toString() });
        
        if (existing) {
          await ekCol.updateOne({ _id: existing._id }, { $set: ekRechnung });
        } else {
          await ekCol.insertOne(ekRechnung);
        }
        
        // Markiere Email als processed
        await inboxCol.updateOne(
          { _id: email._id },
          { 
            $set: { 
              status: 'processed',
              processedAt: new Date()
            }
          }
        );
      }
      
      successCount++;
      if (parsed.gesamtbetrag > 0) {
        parsedWithAmount++;
        totalAmount += parsed.gesamtbetrag;
      }
      
    } catch (error) {
      console.log(`   ❌ Unerwarteter Fehler: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`Verarbeitet: ${toProcess.length}`);
  console.log(`✅ Erfolg:   ${successCount}`);
  console.log(`   └─ Python:  ${pythonSuccessCount}`);
  console.log(`   └─ Gemini:  ${geminiSuccessCount}`);
  console.log(`💰 Mit Betrag: ${parsedWithAmount}`);
  console.log(`💶 Gesamt-Betrag: ${totalAmount.toFixed(2)}€`);
  console.log(`❌ Fehler:   ${errorCount}`);
  console.log(`📊 Erfolgsrate: ${(successCount/toProcess.length*100).toFixed(1)}%`);
  
  if (!dryRun) {
    const totalEK = await ekCol.countDocuments();
    const withBetrag = await ekCol.countDocuments({ gesamtBetrag: { $gt: 0 } });
    const withKreditor = await ekCol.countDocuments({ kreditorKonto: { $ne: null } });
    
    console.log('\n📋 NEUE GESAMT-STATISTIK:');
    console.log(`Total EK-Rechnungen: ${totalEK}`);
    console.log(`Mit Betrag > 0: ${withBetrag} (${(withBetrag/totalEK*100).toFixed(1)}%)`);
    console.log(`Mit Kreditor: ${withKreditor} (${(withKreditor/totalEK*100).toFixed(1)}%)`);
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
