/**
 * Initialisiert den Standard-Amazon-Bulletpoint-Prompt in der Datenbank
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/scoredb'

const standardPrompt = {
  _id: 'amazon-bp-standard-v1',
  name: 'Amazon Bulletpoints - Standard (SEO-optimiert)',
  description: 'Werbender, SEO-optimierter Stil mit vollständiger Produktbeschreibung',
  active: true,
  version: 1,
  systemPrompt: 'Du bist ein Experte für Amazon-Produktbeschreibungen und SEO-optimierte Bulletpoints.',
  userPromptTemplate: `Erstelle GENAU 5 Amazon-Bulletpoints für dieses Produkt.

**WICHTIGE VORGABEN:**
- Aufbereitung: Anwenderfreundlich erklärt, immer im Fließtext, werbende Sprache
- SEO & Keywords: Optimiert für Suchmaschinen
- Alle Produktdaten einbeziehen: Technische Daten, Beschreibungen, Merkmale
- Individuell: Keine allgemeinen, sich wiederholenden Floskeln
- Trennzeichen: Semikolon zwischen den Bulletpoints

**STRUKTUR:**
1. **BP1 - Produktart & Verwendung:**
   Format: "[Produktart mit Qualität] für [Hauptanwendung], [zusätzliche Anwendung]. [Ideale Verwendung]."
   Beispiel: "Robuster keramischer Schleifstift (Industriequalität) für präzise Metallbearbeitung, selbst an schwer zugänglichen Stellen. Ideal zum Entgraten, Anfasen und Kantenbrechen an Stahloberflächen."

2. **BP2 - Material & Leistung:**
   Format: "Langlebig und effizient: [Material/Bindung] mit [Spezifikation], [Körnung/Details] – [Nutzen]."
   Fließtext mit technischen Details in Klammern

3. **BP3 - Technische Eigenschaften:**
   Härtegrad, Werkstoffe (z.B. "Zur schnellen Bearbeitung von: Holz, Metall, Kunststoff"), Kompatibilität
   Format: "[Eigenschaft] gewährleistet [Vorteil]"

4. **BP4 - Maße & Kompatibilität:**
   Format: "Praktisches Format: [Maße mit Ø-Zeichen] – passend für [Maschinen/Geräte]."
   Anwendungshinweise, mit welchen Maschinen kompatibel

5. **BP5 - Marke & Qualitätsversprechen:**
   Format: "[Marke] Premium-Qualität: [Zielgruppe]. [Qualitätsaussage] bei [Anwendungsfall]."

**STIL-BEISPIEL (Artikel 426625):**
Robuster keramischer Schleifstift (Industriequalität) für präzise Metallbearbeitung, selbst an schwer zugänglichen Stellen. Ideal zum Entgraten, Anfasen und Kantenbrechen an Stahloberflächen.;Langlebig und effizient: Keramische Bindung (V-Bindung) mit rosafarbenem Edelkorund (Aluminiumoxid 88A), Körnung 60 (mittelfein) – sorgt für hohe Abtragsleistung und hervorragende Standzeit.;Härtegrad P (universeller Einsatz) gewährleistet optimale Balance zwischen Materialabtrag und Oberflächenqualität.;Praktisches Format: Schleifkopf-Ø 20 x 63 mm, Schaft Ø 6 x 40 mm – passend für alle gängigen Geradschleifer.;Tyrolit Premium-Qualität: Hochleistungs-Schleifstift für Profis und anspruchsvolle Heimwerker. Entwickelt für maximale Effizienz und lange Standzeit bei intensiver Metallbearbeitung.

**PRODUKTINFORMATIONEN:**
{{PRODUCT_DATA}}

**AUSGABE:**
Gib NUR die 5 Bulletpoints mit Semikolon getrennt zurück, KEINE weiteren Erklärungen!
Format: [BP1];[BP2];[BP3];[BP4];[BP5]`,
  createdAt: new Date(),
  updatedAt: new Date()
}

async function initPrompt() {
  let client
  try {
    console.log('Connecting to MongoDB...')
    client = new MongoClient(MONGO_URL)
    await client.connect()
    
    const db = client.db()
    const collection = db.collection('amazon_prompts')
    
    // Upsert: Update wenn existiert, Insert wenn nicht
    const result = await collection.updateOne(
      { _id: standardPrompt._id },
      { $set: standardPrompt },
      { upsert: true }
    )
    
    if (result.upsertedCount > 0) {
      console.log('✅ Standard-Prompt erfolgreich erstellt!')
    } else {
      console.log('✅ Standard-Prompt erfolgreich aktualisiert!')
    }
    
    console.log('\nPrompt-Details:')
    console.log('  ID:', standardPrompt._id)
    console.log('  Name:', standardPrompt.name)
    console.log('  Version:', standardPrompt.version)
    
  } catch (error) {
    console.error('❌ Fehler:', error)
    process.exit(1)
  } finally {
    if (client) {
      await client.close()
    }
  }
}

initPrompt()
