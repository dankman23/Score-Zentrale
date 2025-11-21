#!/usr/bin/env node

/**
 * Initialisiert die Amazon Bulletpoint Prompts in MongoDB
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale'

// Prompt 1: Erste Version (einfach)
const PROMPT_1 = `Du bist ein Experte für Amazon-Produktbeschreibungen. Erstelle GENAU 5 Bulletpoints für Amazon.

Hier sind die Produktinformationen für EINEN Artikel:
{{PRODUKTINFO}}

Bitte erstelle GENAU 5 Bulletpoints für Amazon. Jeder Bulletpoint sollte:
- Maximal 200-250 Zeichen lang sein (Amazon-Richtlinien)
- Mit einem Großbuchstaben beginnen
- Die wichtigsten Produktvorteile hervorheben
- SEO-Keywords enthalten
- ALLE technischen Details aus den TECHNISCHEN MERKMALEN einbeziehen
- Keine Informationen weglassen - besonders nicht aus den technischen Merkmalen!
- Maße, Körnung, Bindung, Härte, Typ, Schaftmaße etc. MÜSSEN erwähnt werden

Format:
• [Bulletpoint 1]
• [Bulletpoint 2]
• [Bulletpoint 3]
• [Bulletpoint 4]
• [Bulletpoint 5]

Antworte NUR mit den 5 Bulletpoints, keine zusätzlichen Erklärungen.`

// Prompt 2: Finale Version mit Stil-Beispiel
const PROMPT_2 = `Du bist ein Experte für Amazon-Produktbeschreibungen. Erstelle GENAU 5 Bulletpoints nach diesem EXAKTEN Format und Stil:

PRODUKTINFORMATIONEN:
{{PRODUKTINFO}}

BEISPIEL für korrekten Stil (Artikel 426625):
Robuster keramischer Schleifstift (Industriequalität) für präzise Metallbearbeitung, selbst an schwer zugänglichen Stellen. Ideal zum Entgraten, Anfasen und Kantenbrechen an Stahloberflächen.;Langlebig und effizient: Keramische Bindung (V-Bindung) mit rosafarbenem Edelkorund (Aluminiumoxid 88A), Körnung 60 (mittelfein) – sorgt für hohe Abtragsleistung und hervorragende Standzeit.;Härtegrad P (universeller Einsatz) gewährleistet optimale Balance zwischen Materialabtrag und Oberflächenqualität.;Praktisches Format: Schleifkopf-Ø 20 x 63 mm, Schaft Ø 6 x 40 mm – passend für alle gängigen Geradschleifer.;Tyrolit Premium-Qualität: Hochleistungs-Schleifstift für Profis und anspruchsvolle Heimwerker. Entwickelt für maximale Effizienz und lange Standzeit bei intensiver Metallbearbeitung.

STRUKTUR (EXAKT einhalten!):
1. BP1: Hauptvorteil + (Qualifikation in Klammern) + Anwendungsgebiet
2. BP2: "Langlebig und effizient:" + technische Details (in Klammern) + Nutzen mit Bindestrich
3. BP3: Technisches Merkmal + konkrete Vorteile ("gewährleistet", "sorgt für")
4. BP4: "Praktisches Format:" + Maße mit Ø-Zeichen + "passend für..."
5. BP5: "Tyrolit Premium-Qualität:" + Zielgruppe + Zusammenfassung

WICHTIGE REGELN:
- ALLE technischen Merkmale verwenden (Maße, Körnung, Bindung, Härte, Material)
- Klammern für Spezifikationen nutzen: (Industriequalität), (V-Bindung), (mittelfein)
- Ø-Zeichen für Durchmesser verwenden
- Doppelpunkte nach Einleitungen: "Langlebig und effizient:", "Praktisches Format:"
- Aktive Verben: "gewährleistet", "sorgt für", "passend für", "entwickelt für"
- Professioneller, technischer aber verständlicher Stil
- Jeder Bulletpoint 150-250 Zeichen
- SEMIKOLON als Trennzeichen zwischen Bulletpoints (NICHT Bullet-Zeichen!)

AUSGABE: Gib NUR die 5 Bulletpoints mit Semikolon getrennt zurück, KEINE weiteren Erklärungen!

Format: [BP1];[BP2];[BP3];[BP4];[BP5]`

async function initPrompts() {
  console.log('🚀 Amazon Bulletpoint Prompts initialisieren...\n')
  
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    console.log('✅ Verbindung zu MongoDB hergestellt')
    
    const db = client.db()
    const collection = db.collection('amazon_bulletpoint_prompts')
    
    // Lösche alte Prompts
    await collection.deleteMany({})
    console.log('🗑️  Alte Prompts gelöscht')
    
    // Erstelle Prompts
    const prompts = [
      {
        version: 1,
        name: 'Standard (einfach)',
        beschreibung: 'Einfache Version mit allen technischen Details',
        prompt: PROMPT_1,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        version: 2,
        name: 'Premium mit Stil-Vorgabe',
        beschreibung: 'Finale Version mit Beispiel und exakter Stil-Vorgabe',
        prompt: PROMPT_2,
        isActive: true, // Standard-Prompt
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
    
    const result = await collection.insertMany(prompts)
    console.log(`✅ ${result.insertedCount} Prompts erstellt\n`)
    
    prompts.forEach((p, idx) => {
      console.log(`📝 Prompt ${p.version}: ${p.name}`)
      console.log(`   ${p.beschreibung}`)
      console.log(`   Aktiv: ${p.isActive ? '✅' : '❌'}`)
      console.log()
    })
    
    console.log('✅ Initialisierung abgeschlossen!')
    
  } catch (error) {
    console.error('❌ Fehler:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

initPrompts()
