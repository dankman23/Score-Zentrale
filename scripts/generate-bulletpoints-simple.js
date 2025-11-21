#!/usr/bin/env node

/**
 * Amazon Bulletpoints Generator - Vereinfachte Version
 */

const fs = require('fs')
const http = require('http')

const csvFilePath = '/tmp/tyrolit-bps_test.csv'
const userPrompt = 'kannst du bitte aus diesen produktinfos zu jedem artikel 5 hochwertige bulletpoints für amazon erstellen? am ende brauche ich eine csv mit den artikelnummern und in den spalten daneben dann die 5 bulletpoints. bitte gut geschrieben und für amazon, seo und kewords optimiert. die bulletpoints sollen den käufern alle vorteile des jeweiligen produktes genau erklären, und dabei sollen keine daten / infos verloren gehen. bitte die optimale zeichenlänge für amazon beachten'

function parseCSV(csvText) {
  const lines = csvText.split('\n')
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

async function generateBulletpoints(article) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      ...article,
      userPrompt
    })
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/amazon/bulletpoints/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }
    
    const req = http.request(options, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.ok) {
            resolve(response.bulletpoints)
          } else {
            reject(new Error(response.error || 'Unknown error'))
          }
        } catch (error) {
          reject(error)
        }
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    req.write(postData)
    req.end()
  })
}

async function main() {
  console.log('🚀 Amazon Bulletpoints Generator - Testlauf\n')
  
  // CSV laden
  console.log('📄 Lade CSV-Datei...')
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8')
  const articles = parseCSV(csvContent)
  
  console.log(`✅ ${articles.length} Artikel gefunden\n`)
  
  const results = []
  
  // Nur erste 3 Artikel für Testlauf
  const testArticles = articles.slice(0, 3)
  
  for (let i = 0; i < testArticles.length; i++) {
    const article = testArticles[i]
    console.log(`\n📦 Artikel ${i+1}/${testArticles.length}`)
    console.log(`   Nummer: ${article.artikelnummer}`)
    console.log(`   Name: ${article.artikelname}`)
    console.log(`   Generiere Bulletpoints...`)
    
    try {
      const bulletpoints = await generateBulletpoints(article)
      
      console.log(`\n✅ BULLETPOINTS GENERIERT:\n`)
      console.log(bulletpoints)
      console.log('\n' + '='.repeat(100))
      
      results.push({
        artikelnummer: article.artikelnummer,
        artikelname: article.artikelname,
        bulletpoints: bulletpoints
      })
    } catch (error) {
      console.error(`   ❌ Fehler: ${error.message}`)
    }
    
    // Warte 2 Sekunden zwischen Anfragen
    if (i < testArticles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log(`\n\n✅ TESTLAUF ABGESCHLOSSEN!`)
  console.log(`   ${results.length} von ${testArticles.length} Artikel erfolgreich verarbeitet\n`)
  
  // Speichere Ergebnisse
  const outputPath = '/tmp/bulletpoints_results.json'
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`💾 Ergebnisse gespeichert: ${outputPath}\n`)
  
  // Zeige Zusammenfassung
  console.log('\n📊 ZUSAMMENFASSUNG:')
  results.forEach((result, idx) => {
    console.log(`\n${idx + 1}. ${result.artikelnummer} - ${result.artikelname}`)
    console.log(result.bulletpoints)
  })
}

main().catch(console.error)
