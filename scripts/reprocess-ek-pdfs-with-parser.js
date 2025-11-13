/**
 * Re-Prozessiert EK-Rechnungen mit intelligentem PDF-Parsing
 * Nutzt pdf-parse + Templates aus ek-rechnung-parser.ts
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');

// PDF-Parse Import (default export)
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  // Falls es ein default export ist
  if (pdfParse.default) {
    pdfParse = pdfParse.default;
  }
} catch (error) {
  console.error('❌ pdf-parse konnte nicht geladen werden:', error.message);
  process.exit(1);
}

// Lade ENV
const envContent = fs.readFileSync('/app/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const MONGO_URL = env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale';

// LIEFERANT TEMPLATES (aus ek-rechnung-parser.ts)
const LIEFERANT_TEMPLATES = [
  {
    name: 'Klingspor',
    kontonummer: '70004',
    patterns: {
      name: [/Klingspor/i, /KLINGSPOR/i],
      rechnungsNr: [/Rechnung[:\s]*(\d{7,10})/i, /Rg[.-]?Nr[.:\s]*(\d+)/i, /Invoice[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i, /(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})/],
      betrag: [/Gesamt[betrag]*[:\s]*([\d.,]+)\s*€?/i, /Rechnungsbetrag[:\s]*([\d.,]+)/i, /Total[:\s]*([\d.,]+)/i],
    },
    priority: 10
  },
  {
    name: 'VSM',
    kontonummer: '70009',
    patterns: {
      name: [/VSM/i, /Vereinigte\s+Schmirgel/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /RE[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i, /Endbetrag[:\s]*([\d.,]+)/i],
    },
    priority: 10
  },
  {
    name: 'Starcke',
    kontonummer: '70006',
    patterns: {
      name: [/Starcke/i, /STARCKE/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /RG[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    priority: 10
  },
  {
    name: 'Rüggeberg',
    kontonummer: '70005',
    patterns: {
      name: [/R[üu]ggeberg/i, /PFERD/i, /RUGGEBERG/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /Rechnungs-Nr[.:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i],
    },
    priority: 10
  },
  {
    name: 'DPD',
    kontonummer: '70007',
    patterns: {
      name: [/DPD/i, /DPD\s+Deutschland/i],
      rechnungsNr: [/Rechnung[:\s]*(\d+)/i, /Invoice[:\s]*(\d+)/i],
      datum: [/Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i],
      betrag: [/Gesamt[:\s]*([\d.,]+)/i, /Total[:\s]*([\d.,]+)/i],
    },
    priority: 7
  }
];

// Generische Patterns für unbekannte Lieferanten
const GENERIC_PATTERNS = {
  rechnungsNr: [
    /Rechnung[snr.:\s-]*(\d+)/i,
    /Invoice[:\s]*(\d+)/i,
    /RG[.-]?Nr[.:\s]*(\d+)/i,
    /Rechnungs[- ]?Nr[.:\s]*(\d+)/i,
    /RE[:\s-]*(\d+)/i
  ],
  datum: [
    /Rechnungsdatum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i,
    /Datum[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/i,
    /Date[:\s]*(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})/i,
    /(\d{1,2}\.\d{1,2}\.\d{4})/
  ],
  betrag: [
    /Gesamt[betrag]*[:\s]*([\d.,]+)\s*€?/i,
    /Rechnungsbetrag[:\s]*([\d.,]+)/i,
    /Endbetrag[:\s]*([\d.,]+)/i,
    /Total[:\s]*([\d.,]+)/i,
    /Summe[:\s]*([\d.,]+)/i,
    /zu\s+zahlen[:\s]*([\d.,]+)/i
  ]
};

function extractWithPattern(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function parseBetrag(betragStr) {
  if (!betragStr) return 0;
  // Deutsche Zahlenformatierung: 1.234,56 -> 1234.56
  const cleaned = betragStr
    .replace(/\s/g, '')
    .replace(/\./g, '') // Tausendertrennzeichen weg
    .replace(',', '.'); // Komma zu Punkt
  return parseFloat(cleaned) || 0;
}

function parseDatum(datumStr) {
  if (!datumStr) return new Date();
  
  // Format: DD.MM.YYYY oder DD/MM/YYYY
  const parts = datumStr.split(/[.\/]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // JS months are 0-based
    const year = parseInt(parts[2]);
    const fullYear = year < 100 ? 2000 + year : year;
    return new Date(fullYear, month, day);
  }
  
  return new Date(datumStr);
}

async function parseInvoicePDF(pdfBase64, filename, kreditoren) {
  try {
    // Decode base64
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    
    // Parse PDF
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    
    if (!text || text.length < 50) {
      return {
        success: false,
        error: 'PDF-Text zu kurz oder leer'
      };
    }
    
    // 1. Template-basiertes Parsing
    let matchedTemplate = null;
    let matchScore = 0;
    
    for (const template of LIEFERANT_TEMPLATES) {
      let score = 0;
      
      // Prüfe Name-Patterns
      for (const pattern of template.patterns.name) {
        if (pattern.test(text)) {
          score += 30;
          break;
        }
      }
      
      // Prüfe auch Dateiname
      for (const pattern of template.patterns.name) {
        if (pattern.test(filename)) {
          score += 20;
          break;
        }
      }
      
      if (score > matchScore) {
        matchScore = score;
        matchedTemplate = template;
      }
    }
    
    // 2. Extrahiere Daten mit Template oder generisch
    let rechnungsNr = null;
    let datum = null;
    let betrag = null;
    let lieferantName = null;
    
    if (matchedTemplate && matchScore >= 30) {
      // Template-basiert
      lieferantName = matchedTemplate.name;
      rechnungsNr = extractWithPattern(text, matchedTemplate.patterns.rechnungsNr);
      datum = extractWithPattern(text, matchedTemplate.patterns.datum);
      betrag = extractWithPattern(text, matchedTemplate.patterns.betrag);
    } else {
      // Generisch
      rechnungsNr = extractWithPattern(text, GENERIC_PATTERNS.rechnungsNr);
      datum = extractWithPattern(text, GENERIC_PATTERNS.datum);
      betrag = extractWithPattern(text, GENERIC_PATTERNS.betrag);
      
      // Versuche Lieferant aus erstem Wort zu extrahieren
      const lines = text.split('\n').filter(l => l.trim());
      lieferantName = lines[0]?.substring(0, 50) || 'Unbekannt';
    }
    
    // Fallback: Dateiname für Rechnungsnummer
    if (!rechnungsNr) {
      const nrMatch = filename.match(/(\d{6,10})/);
      rechnungsNr = nrMatch ? nrMatch[1] : 'Unbekannt';
    }
    
    // Parse Werte
    const parsedBetrag = parseBetrag(betrag);
    const parsedDatum = datum ? parseDatum(datum) : new Date();
    
    // 3. Finde Kreditor
    let kreditor = null;
    if (matchedTemplate) {
      kreditor = kreditoren.find(k => k.kreditorenNummer === matchedTemplate.kontonummer);
    }
    
    if (!kreditor && lieferantName !== 'Unbekannt') {
      const lower = lieferantName.toLowerCase();
      kreditor = kreditoren.find(k => {
        const kName = (k.name || '').toLowerCase();
        return kName.includes(lower) || lower.includes(kName);
      });
    }
    
    // Confidence Score
    let confidence = 0;
    if (matchedTemplate && matchScore >= 50) confidence = 90;
    else if (matchedTemplate && matchScore >= 30) confidence = 70;
    else if (parsedBetrag > 0 && rechnungsNr !== 'Unbekannt') confidence = 60;
    else if (parsedBetrag > 0) confidence = 40;
    else confidence = 20;
    
    return {
      success: true,
      lieferantName,
      rechnungsNummer: rechnungsNr,
      rechnungsdatum: parsedDatum,
      gesamtBetrag: parsedBetrag,
      nettoBetrag: parsedBetrag / 1.19,
      steuerBetrag: parsedBetrag - (parsedBetrag / 1.19),
      steuersatz: 19,
      kreditorKonto: kreditor?.kreditorenNummer || null,
      aufwandskonto: kreditor?.standardAufwandskonto || '5200',
      parsing: {
        method: matchedTemplate ? 'template-based' : 'generic',
        template: matchedTemplate?.name,
        confidence,
        extractedFrom: 'pdf-text'
      },
      matchedKreditor: kreditor
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const batchSize = parseInt(process.argv[2] || '50', 10);
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('🔄 Re-Prozessiere EK-Rechnungen mit intelligentem Parsing\n');
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
  
  console.log(`📄 ${toReprocess.length} Rechnungen zum Re-Processing gefunden\n`);
  
  if (toReprocess.length === 0) {
    console.log('✅ Keine Rechnungen zu verarbeiten!');
    await client.close();
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  let improvedCount = 0;
  
  for (let i = 0; i < toReprocess.length; i++) {
    const rechnung = toReprocess[i];
    console.log(`\n[${i+1}/${toReprocess.length}] ${rechnung.lieferantName} - ${rechnung.rechnungsNummer}`);
    
    try {
      // Hole Email mit PDF
      const email = await inboxCol.findOne({ _id: new ObjectId(rechnung.sourceEmailId) });
      
      if (!email || !email.pdfBase64) {
        console.log(`   ⚠️  Keine PDF-Daten gefunden`);
        errorCount++;
        continue;
      }
      
      // Parse PDF
      const parsed = await parseInvoicePDF(email.pdfBase64, email.filename, kreditoren);
      
      if (!parsed.success) {
        console.log(`   ❌ Parsing-Fehler: ${parsed.error}`);
        errorCount++;
        continue;
      }
      
      // Prüfe ob Verbesserung
      const hasImprovement = 
        parsed.gesamtBetrag > 0 ||
        parsed.kreditorKonto ||
        parsed.parsing.confidence > (rechnung.parsing?.confidence || 0);
      
      if (hasImprovement) {
        console.log(`   ✅ ${parsed.lieferantName}`);
        console.log(`      Betrag: ${parsed.gesamtBetrag.toFixed(2)}€ (vorher: ${rechnung.gesamtBetrag})`);
        console.log(`      Kreditor: ${parsed.kreditorKonto || 'N/A'} (vorher: ${rechnung.kreditorKonto || 'N/A'})`);
        console.log(`      Confidence: ${parsed.parsing.confidence}% (vorher: ${rechnung.parsing?.confidence || 0}%)`);
        
        if (!dryRun) {
          // Update Rechnung
          await ekCol.updateOne(
            { _id: rechnung._id },
            { 
              $set: {
                lieferantName: parsed.lieferantName,
                rechnungsNummer: parsed.rechnungsNummer,
                rechnungsdatum: parsed.rechnungsdatum,
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
        console.log(`   ⚠️  Keine Verbesserung gefunden`);
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
  console.log(`❌ Fehler:   ${errorCount}`);
  console.log(`📊 Rate:     ${(successCount/toReprocess.length*100).toFixed(1)}%`);
  
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
