#!/usr/bin/env node

/**
 * Amazon Bulletpoints Generator - Testlauf
 * Liest CSV und generiert Bulletpoints mit Claude Sonnet
 */

const fs = require('fs')
const https = require('https')

// OpenAI API Key (aus .env)
const API_KEY = process.env.OPENAI_API_KEY || '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'
const API_URL = 'https://api.openai.com/v1/chat/completions'

// CSV Datei laden
const csvFilePath = '/tmp/tyrolit-bps_test.csv'

function parseCSV(csvText) {
  const lines = csvText.split('\n')
  const headers = lines[0].split(';')
  
  const articles = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    
    const values = lines[i].split(';')
    if (values.length < 5) continue
    
    articles.push({
      artikelnummer: values[0]?.trim(),
      artikelname: values[1]?.trim(),
      beschreibung: values[2]?.trim().replace(/<br\/>/g, '\n').replace(/<li>/g, '• ').replace(/<\/li>/g, ''),
      kurzbeschreibung: values[3]?.trim(),
      merkmale: values[4]?.trim()
    })
  }
  
  return articles
}

async function callOpenAIAPI(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für Amazon-Produktbeschreibungen und SEO-optimierte Bulletpoints.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    })
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': data.length
      }
    }
    
    const req = https.request(options, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content)
          } else {
            reject(new Error('Unexpected API response format'))
          }
        } catch (error) {
          reject(error)
        }
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    req.write(data)
    req.end()
  })
}

async function generateBulletpoints(article, userPrompt) {
  const productInfo = `
ARTIKELNUMMER: ${article.artikelnummer}
PRODUKTNAME: ${article.artikelname}

KURZBESCHREIBUNG:
${article.kurzbeschreibung}

BESCHREIBUNG:
${article.beschreibung}

TECHNISCHE MERKMALE:
${article.merkmale}
`

  const fullPrompt = `${userPrompt}

Hier sind die Produktinformationen für EINEN Artikel:
${productInfo}

Bitte erstelle GENAU 5 Bulletpoints für Amazon. Jeder Bulletpoint sollte:
- Maximal 200-250 Zeichen lang sein (Amazon-Richtlinien)
- Mit einem Großbuchstaben beginnen
- Die wichtigsten Produktvorteile hervorheben
- SEO-Keywords enthalten
- Technische Details einbeziehen
- Keine Informationen weglassen

Format:
• [Bulletpoint 1]
• [Bulletpoint 2]
• [Bulletpoint 3]
• [Bulletpoint 4]
• [Bulletpoint 5]

Antworte NUR mit den 5 Bulletpoints, keine zusätzlichen Erklärungen.`

  try {
    const response = await callClaudeAPI(fullPrompt)
    return response
  } catch (error) {
    console.error(`❌ Fehler bei Artikel ${article.artikelnummer}:`, error.message)
    return null
  }
}

async function main() {
  console.log('🚀 Amazon Bulletpoints Generator - Testlauf\n')
  
  // CSV laden
  console.log('📄 Lade CSV-Datei...')
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8')
  const articles = parseCSV(csvContent)
  
  console.log(`✅ ${articles.length} Artikel gefunden\n`)
  
  // User Prompt
  const userPrompt = `kannst du bitte aus diesen produktinfos zu jedem artikel 5 hochwertige bulletpoints für amazon erstellen? am ende brauche ich eine csv mit den artikelnummern und in den spalten daneben dann die 5 bulletpoints. bitte gut geschrieben und für amazon, seo und kewords optimiert. die bulletpoints sollen den käufern alle vorteile des jeweiligen produktes genau erklären, und dabei sollen keine daten / infos verloren gehen. bitte die optimale zeichenlänge für amazon beachten`
  
  const results = []
  
  // Nur erste 3 Artikel für Testlauf
  const testArticles = articles.slice(0, 3)
  
  for (let i = 0; i < testArticles.length; i++) {
    const article = testArticles[i]
    console.log(`\n📦 Verarbeite Artikel ${i+1}/${testArticles.length}: ${article.artikelnummer}`)
    console.log(`   Name: ${article.artikelname}`)
    
    const bulletpoints = await generateBulletpoints(article, userPrompt)
    
    if (bulletpoints) {
      console.log(`\n✅ Bulletpoints generiert:\n`)
      console.log(bulletpoints)
      console.log('\n' + '='.repeat(80))
      
      results.push({
        artikelnummer: article.artikelnummer,
        artikelname: article.artikelname,
        bulletpoints: bulletpoints
      })
    }
    
    // Warte 1 Sekunde zwischen Anfragen
    if (i < testArticles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.log(`\n\n✅ Testlauf abgeschlossen!`)
  console.log(`   ${results.length} von ${testArticles.length} Artikel erfolgreich verarbeitet\n`)
  
  // Speichere Ergebnisse
  const outputPath = '/tmp/bulletpoints_results.json'
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`💾 Ergebnisse gespeichert: ${outputPath}\n`)
}

main().catch(console.error)
