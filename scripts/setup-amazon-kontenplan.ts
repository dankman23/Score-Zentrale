import { getDb } from '../app/lib/db/mongodb'

/**
 * Setup-Script: Amazon-Kontenplan vorbereiten
 * 
 * Erstellt/aktualisiert alle notwendigen Konten für Amazon-Buchungen:
 * - 1814: Amazon (Zahlungskonto)
 * - 6770: Amazon-Gebühren (Kommission, mit Belegpflicht)
 * - 1460: Geldtransit (ohne Belegpflicht)
 * - 69001: Sammeldebitor Amazon
 * - 30000+: IGL-Debitorenkonten (für innergemeinschaftliche Lieferungen)
 */

async function setupAmazonKontenplan() {
  try {
    console.log('[Amazon Kontenplan] Starte Setup...')
    const db = await getDb()
    const kontenplan = db.collection('kontenplan')
    
    const konten = [
      {
        kontonummer: '1814',
        bezeichnung: 'Amazon (Zahlungskonto)',
        art: 'Bank',
        belegpflicht: false,
        beschreibung: 'Amazon Payment Account - wird automatisch bei Amazon-Zahlungen gesetzt'
      },
      {
        kontonummer: '6770',
        bezeichnung: 'Amazon-Gebühren (Kommission)',
        art: 'Aufwand',
        belegpflicht: true,
        steuerschluessel: '401',
        beschreibung: 'Amazon-Kommission, Versandgebühren, Digital Service Fees (19% Vorsteuer)'
      },
      {
        kontonummer: '1460',
        bezeichnung: 'Geldtransit',
        art: 'Bank',
        belegpflicht: false,
        beschreibung: 'Amazon Geldtransit - keine Belegpflicht'
      },
      {
        kontonummer: '69001',
        bezeichnung: 'Sammeldebitor Amazon',
        art: 'Debitor',
        belegpflicht: true,
        beschreibung: 'Sammeldebitor für Amazon-Verkäufe (Standard)'
      },
      {
        kontonummer: '1370',
        bezeichnung: 'Abziehbare Vorsteuer',
        art: 'Steuer',
        belegpflicht: false,
        beschreibung: 'Amazon Marketplace Facilitator VAT (von Amazon abgeführt)'
      },
      {
        kontonummer: '4800',
        bezeichnung: 'Versanderlöse',
        art: 'Erlös',
        belegpflicht: true,
        beschreibung: 'Amazon Versanderlöse'
      },
      {
        kontonummer: '1776',
        bezeichnung: 'Umsatzsteuer',
        art: 'Steuer',
        belegpflicht: false,
        beschreibung: 'Amazon Umsatzsteuer'
      }
    ]
    
    let created = 0
    let updated = 0
    
    for (const konto of konten) {
      const existing = await kontenplan.findOne({ kontonummer: konto.kontonummer })
      
      if (existing) {
        // Update falls schon vorhanden
        await kontenplan.updateOne(
          { kontonummer: konto.kontonummer },
          { $set: konto }
        )
        console.log(`✓ Konto ${konto.kontonummer} aktualisiert: ${konto.bezeichnung}`)
        updated++
      } else {
        // Neu erstellen
        await kontenplan.insertOne({
          ...konto,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log(`✓ Konto ${konto.kontonummer} erstellt: ${konto.bezeichnung}`)
        created++
      }
    }
    
    console.log(`\n[Amazon Kontenplan] Fertig!`)
    console.log(`  Erstellt: ${created}`)
    console.log(`  Aktualisiert: ${updated}`)
    
    process.exit(0)
    
  } catch (err: any) {
    console.error('[Amazon Kontenplan] Fehler:', err.message)
    process.exit(1)
  }
}

setupAmazonKontenplan()
