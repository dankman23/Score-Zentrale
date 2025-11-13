#!/usr/bin/env node

/**
 * Re-Parse Invoices
 * 
 * Findet alle processed Email-Inbox Items die keine entsprechende EK-Rechnung haben
 * und verarbeitet sie neu
 */

const { MongoClient } = require('mongodb')
const { spawn } = require('child_process')
const path = require('path')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = 'score_zentrale'

async function parseInvoiceWithGemini(pdfBase64) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../python_libs/emergent_gemini_parser.py')
    const python = spawn('python3', [pythonScript])
    
    let stdout = ''
    let stderr = ''
    
    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}: ${stderr}`))
      } else {
        try {
          const result = JSON.parse(stdout)
          resolve(result)
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${stdout}`))
        }
      }
    })
    
    // Sende PDF als Base64 via stdin
    python.stdin.write(JSON.stringify({ pdfBase64 }))
    python.stdin.end()
  })
}

async function main() {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    
    console.log('🔍 Suche PDFs ohne zugehörige EK-Rechnung...\n')
    
    // Hole alle processed emails mit Attachments
    const emails = await db.collection('fibu_email_inbox')
      .find({ 
        status: 'processed',
        'attachments.0': { $exists: true }
      })
      .toArray()
    
    console.log(`📧 ${emails.length} processed Emails gefunden`)
    
    // Prüfe welche keine EK-Rechnung haben
    const toReparse = []
    
    for (const email of emails) {
      const rechnung = await db.collection('fibu_ek_rechnungen').findOne({
        sourceEmailId: email._id.toString()
      })
      
      if (!rechnung) {
        toReparse.push(email)
      }
    }
    
    console.log(`🔄 ${toReparse.length} PDFs müssen neu verarbeitet werden\n`)
    
    if (toReparse.length === 0) {
      console.log('✅ Alle PDFs haben bereits EK-Rechnungen!')
      return
    }
    
    console.log('Starte Re-Parsing mit verbessertem Gemini-Parser...\n')
    
    let success = 0
    let failed = 0
    
    for (let i = 0; i < toReparse.length; i++) {
      const email = toReparse[i]
      const attachment = email.attachments[0]
      
      process.stdout.write(`[${i+1}/${toReparse.length}] ${attachment.filename}... `)
      
      try {
        // Parse mit Gemini
        const result = await parseInvoiceWithGemini(attachment.content)
        
        if (result.success && result.data) {
          const data = result.data
          
          // Speichere in MongoDB
          await db.collection('fibu_ek_rechnungen').insertOne({
            lieferantName: data.lieferant || 'Unbekannt',
            rechnungsNummer: data.rechnungsnummer || 'N/A',
            rechnungsdatum: data.datum ? new Date(data.datum) : new Date(),
            gesamtBetrag: data.gesamtbetrag || 0,
            nettoBetrag: data.nettobetrag || 0,
            steuerBetrag: data.mehrwertsteuer || 0,
            steuersatz: data.mwstSatz || 19,
            kreditorKonto: null,
            aufwandskonto: '5200',
            sourceEmailId: email._id.toString(),
            pdfFileName: attachment.filename,
            parsing: {
              method: 'emergent-gemini',
              confidence: result.confidence || 80,
              parsedAt: new Date()
            },
            needsManualReview: data.gesamtbetrag === 0,
            created_at: new Date()
          })
          
          console.log(`✅ ${data.lieferant} | ${data.gesamtbetrag}€`)
          success++
        } else {
          console.log(`❌ ${result.error || 'Parsing failed'}`)
          failed++
        }
        
      } catch (error) {
        console.log(`❌ ${error.message}`)
        failed++
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('\n' + '='.repeat(80))
    console.log(`✅ Success: ${success}`)
    console.log(`❌ Failed:  ${failed}`)
    console.log('='.repeat(80))
    
    // Neuer Status
    const total = await db.collection('fibu_ek_rechnungen').countDocuments({})
    const ohneKreditor = await db.collection('fibu_ek_rechnungen').countDocuments({ 
      kreditorKonto: null, 
      gesamtBetrag: { $gt: 0 } 
    })
    
    console.log(`\n📊 Neuer Status:`)
    console.log(`   Total EK-Rechnungen: ${total}`)
    console.log(`   Ohne Kreditor: ${ohneKreditor}`)
    
  } catch (error) {
    console.error('❌ Fehler:', error.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
