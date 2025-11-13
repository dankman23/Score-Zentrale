/**
 * Nur Gemini-Parsing (kein Python-Fallback)
 * Für problematische PDFs die Python-Parser nicht verarbeiten kann
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
const EMERGENT_LLM_KEY = env.GOOGLE_API_KEY || env.EMERGENT_LLM_KEY || '';

async function callGeminiParser(pdfBase64, emailContext) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', ['/app/python_libs/emergent_gemini_parser.py'], {
      env: { 
        ...process.env,
        EMERGENT_LLM_KEY: EMERGENT_LLM_KEY,
        GOOGLE_API_KEY: EMERGENT_LLM_KEY
      }
    });
    
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
        reject(new Error(`Gemini exited with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        reject(new Error(`JSON parse error: ${error.message}`));
      }
    });
    
    const input = {
      pdf_base64: pdfBase64,
      filename: '',
      email_context: emailContext
    };
    python.stdin.write(JSON.stringify(input));
    python.stdin.end();
  });
}

async function main() {
  const batchSize = parseInt(process.argv[2] || '50', 10);
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🤖 Gemini-Only Batch-Processing\n');
  console.log(`Batch-Size: ${batchSize}`);
  console.log(`Dry-Run: ${dryRun ? 'JA' : 'NEIN'}\n`);
  
  const client = await MongoClient.connect(MONGO_URL);
  const db = client.db();
  
  const ekCol = db.collection('fibu_ek_rechnungen');
  const inboxCol = db.collection('fibu_email_inbox');
  
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
  let parsedWithAmount = 0;
  let totalAmount = 0;
  
  for (let i = 0; i < toProcess.length; i++) {
    const email = toProcess[i];
    const shortFilename = email.filename.substring(0, 50);
    
    console.log(`\n[${i+1}/${toProcess.length}] ${shortFilename}`);
    
    try {
      const emailContext = {
        from: email.emailFrom,
        subject: email.subject,
        body: email.bodyText || ''
      };
      
      const parsed = await callGeminiParser(email.pdfBase64, emailContext);
      
      if (!parsed.success) {
        console.log(`   ❌ ${parsed.error}`);
        errorCount++;
        continue;
      }
      
      console.log(`   ✅ ${parsed.lieferant}`);
      console.log(`      RgNr: ${parsed.rechnungsnummer}`);
      console.log(`      Betrag: ${parsed.gesamtbetrag.toFixed(2)}€`);
      console.log(`      Kreditor: ${parsed.kreditor || 'N/A'}`);
      
      if (!dryRun) {
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
        
        const existing = await ekCol.findOne({ sourceEmailId: email._id.toString() });
        
        if (existing) {
          await ekCol.updateOne({ _id: existing._id }, { $set: ekRechnung });
        } else {
          await ekCol.insertOne(ekRechnung);
        }
        
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
      console.log(`   ❌ Fehler: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`Verarbeitet: ${toProcess.length}`);
  console.log(`✅ Erfolg:   ${successCount}`);
  console.log(`💰 Mit Betrag: ${parsedWithAmount}`);
  console.log(`💶 Gesamt-Betrag: ${totalAmount.toFixed(2)}€`);
  console.log(`❌ Fehler:   ${errorCount}`);
  
  if (!dryRun) {
    const totalEK = await ekCol.countDocuments();
    const withBetrag = await ekCol.countDocuments({ gesamtBetrag: { $gt: 0 } });
    
    console.log('\n📋 GESAMT-STATISTIK:');
    console.log(`Total EK-Rechnungen: ${totalEK}`);
    console.log(`Mit Betrag > 0: ${withBetrag} (${(withBetrag/totalEK*100).toFixed(1)}%)`);
  }
  
  await client.close();
  console.log('\n✅ Fertig!');
}

main().catch(err => {
  console.error('❌ Fehler:', err);
  process.exit(1);
});
