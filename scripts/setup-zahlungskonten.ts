/**
 * Script zum Anlegen/Aktualisieren der Zahlungskonten
 * Führt folgendes aus:
 * 1. Legt die fixen Zahlungskonten im Kontenplan an
 * 2. Markiert sie als Zahlungskonten (Stand 12/2025)
 * 3. Setzt belegpflicht = false
 */

import { MongoClient } from 'mongodb'

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale'

async function connectToDatabase() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const dbName = process.env.MONGO_DB || process.env.DB_NAME || new URL(MONGO_URL).pathname.substring(1)
  const db = client.db(dbName)
  return { db, client }
}

const ZAHLUNGSKONTEN = [
  {
    kontonummer: '1701',
    bezeichnung: 'Postbank (Zahlungskonto, Stand 12/2025)',
    beschreibung: 'Postbank Girokonto - Automatisches Zahlungskonto für Postbank-Transaktionen',
    klasse: '1',
    belegpflicht: false,
    istAktiv: true
  },
  {
    kontonummer: '1801',
    bezeichnung: 'PayPal (Zahlungskonto, Stand 12/2025)',
    beschreibung: 'PayPal Geschäftskonto - Automatisches Zahlungskonto für PayPal-Transaktionen',
    klasse: '1',
    belegpflicht: false,
    istAktiv: true
  },
  {
    kontonummer: '1802',
    bezeichnung: 'Commerzbank (Zahlungskonto, Stand 12/2025)',
    beschreibung: 'Commerzbank Girokonto - Automatisches Zahlungskonto für Commerzbank-Transaktionen',
    klasse: '1',
    belegpflicht: false,
    istAktiv: true
  },
  {
    kontonummer: '1810',
    bezeichnung: 'eBay Managed Payments (Zahlungskonto, Stand 12/2025)',
    beschreibung: 'eBay Managed Payments - Automatisches Zahlungskonto für eBay-Transaktionen',
    klasse: '1',
    belegpflicht: false,
    istAktiv: true
  },
  {
    kontonummer: '1814',
    bezeichnung: 'Amazon Pay (Zahlungskonto, Stand 12/2025)',
    beschreibung: 'Amazon Pay / Amazon Payments - Automatisches Zahlungskonto für Amazon-Transaktionen',
    klasse: '1',
    belegpflicht: false,
    istAktiv: true
  },
  {
    kontonummer: '1820',
    bezeichnung: 'Otto Payment (Zahlungskonto, Stand 12/2025)',
    beschreibung: 'Otto Payment - Automatisches Zahlungskonto für Otto-Transaktionen',
    klasse: '1',
    belegpflicht: false,
    istAktiv: true
  },
  {
    kontonummer: '1840',
    bezeichnung: 'Mollie (Zahlungskonto, Stand 12/2025)',
    beschreibung: 'Mollie Payment Service - Automatisches Zahlungskonto für Mollie-Transaktionen',
    klasse: '1',
    belegpflicht: false,
    istAktiv: true
  }
]

async function setupZahlungskonten() {
  console.log('🚀 Setup Zahlungskonten gestartet...')
  
  const { db, client } = await connectToDatabase()
  const collection = db.collection('kontenplan')
  
  let created = 0
  let updated = 0
  let errors = 0
  
  for (const konto of ZAHLUNGSKONTEN) {
    try {
      const existing = await collection.findOne({ kontonummer: konto.kontonummer })
      
      if (existing) {
        // Aktualisiere bestehendes Konto
        await collection.updateOne(
          { kontonummer: konto.kontonummer },
          {
            $set: {
              bezeichnung: konto.bezeichnung,
              beschreibung: konto.beschreibung,
              belegpflicht: false,
              updated_at: new Date()
            }
          }
        )
        console.log(`✅ Aktualisiert: ${konto.kontonummer} - ${konto.bezeichnung}`)
        updated++
      } else {
        // Lege neues Konto an
        await collection.insertOne({
          ...konto,
          kontenklasse: parseInt(konto.klasse),
          kontengruppe: konto.kontonummer.substring(0, 2),
          kontenuntergruppe: konto.kontonummer.substring(0, 3),
          kontenklasseBezeichnung: 'Finanzanlagen und Flüssige Mittel',
          kontenklasseTyp: 'aktiva',
          steuerrelevant: false,
          steuersatz: 0,
          vorsteuer: false,
          istSystemkonto: false,
          created_at: new Date(),
          updated_at: new Date()
        })
        console.log(`✅ Erstellt: ${konto.kontonummer} - ${konto.bezeichnung}`)
        created++
      }
    } catch (error) {
      console.error(`❌ Fehler bei ${konto.kontonummer}:`, error)
      errors++
    }
  }
  
  console.log('\n📊 Zusammenfassung:')
  console.log(`  Erstellt: ${created}`)
  console.log(`  Aktualisiert: ${updated}`)
  console.log(`  Fehler: ${errors}`)
  console.log('\n✅ Setup Zahlungskonten abgeschlossen!')
}

setupZahlungskonten()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fehler:', error)
    process.exit(1)
  })
