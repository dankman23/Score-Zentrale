export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'

export async function POST(request: NextRequest) {
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
      },
      {
        kontonummer: '6600',
        bezeichnung: 'Kosten für Werbung',
        art: 'Aufwand',
        belegpflicht: true,
        steuerschluessel: '401',
        beschreibung: 'Amazon Werbekosten (ServiceFee, Cost of Advertising)'
      }
    ]
    
    let created = 0
    let updated = 0
    
    for (const konto of konten) {
      const existing = await kontenplan.findOne({ kontonummer: konto.kontonummer })
      
      if (existing) {
        await kontenplan.updateOne(
          { kontonummer: konto.kontonummer },
          { $set: konto }
        )
        console.log(`✓ Konto ${konto.kontonummer} aktualisiert: ${konto.bezeichnung}`)
        updated++
      } else {
        await kontenplan.insertOne({
          ...konto,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log(`✓ Konto ${konto.kontonummer} erstellt: ${konto.bezeichnung}`)
        created++
      }
    }
    
    return NextResponse.json({
      ok: true,
      message: 'Amazon-Kontenplan erfolgreich eingerichtet',
      created,
      updated
    })
    
  } catch (err: any) {
    console.error('[Amazon Kontenplan] Fehler:', err.message)
    return NextResponse.json({
      ok: false,
      error: err.message
    }, { status: 500 })
  }
}
