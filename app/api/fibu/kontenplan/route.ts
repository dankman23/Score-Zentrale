export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

/**
 * Vollständiger Kontenplan für die Buchhaltung
 * Basierend auf deutschem Standard (ähnlich SKR03/SKR04)
 */
const STANDARD_KONTENPLAN = {
  sachkonten: [
    // ERLÖSKONTEN (4xxx)
    { konto: '4100', bezeichnung: 'Erlöse ohne USt (steuerfrei)', typ: 'Erlöse', kategorie: 'Inland' },
    { konto: '4120', bezeichnung: 'Erlöse Drittland steuerfrei', typ: 'Erlöse', kategorie: 'Export' },
    { konto: '4125', bezeichnung: 'Erlöse EU steuerfrei (IGL mit UstID)', typ: 'Erlöse', kategorie: 'EU' },
    { konto: '4300', bezeichnung: 'Erlöse 7% USt', typ: 'Erlöse', kategorie: 'Inland' },
    { konto: '4310', bezeichnung: 'Erlöse 7% USt EU', typ: 'Erlöse', kategorie: 'EU' },
    { konto: '4315', bezeichnung: 'Erlöse 19% USt EU', typ: 'Erlöse', kategorie: 'EU' },
    { konto: '4320', bezeichnung: 'Erlöse 19% USt EU (Reverse Charge)', typ: 'Erlöse', kategorie: 'EU' },
    { konto: '4340', bezeichnung: 'Erlöse sonstige USt Inland', typ: 'Erlöse', kategorie: 'Inland' },
    { konto: '4400', bezeichnung: 'Erlöse 19% USt', typ: 'Erlöse', kategorie: 'Inland' },
    
    // WARENEINKAUF (5xxx)
    { konto: '5000', bezeichnung: 'Wareneinkauf 19% VSt', typ: 'Aufwand', kategorie: 'Wareneinkauf' },
    { konto: '5200', bezeichnung: 'Wareneinkauf Schleifwerkzeuge 19% VSt', typ: 'Aufwand', kategorie: 'Wareneinkauf' },
    { konto: '5400', bezeichnung: 'Wareneinkauf 7% VSt', typ: 'Aufwand', kategorie: 'Wareneinkauf' },
    
    // BETRIEBSKOSTEN (6xxx)
    { konto: '6000', bezeichnung: 'Löhne und Gehälter', typ: 'Aufwand', kategorie: 'Personal' },
    { konto: '6020', bezeichnung: 'Sozialabgaben', typ: 'Aufwand', kategorie: 'Personal' },
    { konto: '6100', bezeichnung: 'Mieten und Pachten', typ: 'Aufwand', kategorie: 'Raumkosten' },
    { konto: '6200', bezeichnung: 'Versicherungen', typ: 'Aufwand', kategorie: 'Versicherung' },
    { konto: '6300', bezeichnung: 'Versand-/Frachtkosten 19% VSt', typ: 'Aufwand', kategorie: 'Versand' },
    { konto: '6310', bezeichnung: 'Versand-/Frachtkosten 7% VSt', typ: 'Aufwand', kategorie: 'Versand' },
    { konto: '6320', bezeichnung: 'Verpackungsmaterial', typ: 'Aufwand', kategorie: 'Versand' },
    { konto: '6400', bezeichnung: 'Werbekosten', typ: 'Aufwand', kategorie: 'Marketing' },
    { konto: '6500', bezeichnung: 'Kfz-Kosten', typ: 'Aufwand', kategorie: 'Fahrzeug' },
    { konto: '6510', bezeichnung: 'Bürobedarf', typ: 'Aufwand', kategorie: 'Büro' },
    { konto: '6520', bezeichnung: 'Telefon/Internet', typ: 'Aufwand', kategorie: 'Büro' },
    { konto: '6530', bezeichnung: 'Porto', typ: 'Aufwand', kategorie: 'Büro' },
    { konto: '6540', bezeichnung: 'Raumausstattung', typ: 'Aufwand', kategorie: 'Büro' },
    { konto: '6600', bezeichnung: 'Marketing/Online-Werbung', typ: 'Aufwand', kategorie: 'Marketing' },
    { konto: '6610', bezeichnung: 'Reisekosten', typ: 'Aufwand', kategorie: 'Reise' },
    { konto: '6620', bezeichnung: 'Fortbildung', typ: 'Aufwand', kategorie: 'Personal' },
    { konto: '6640', bezeichnung: 'Software/Lizenzen', typ: 'Aufwand', kategorie: 'IT' },
    { konto: '6650', bezeichnung: 'Lagerkosten', typ: 'Aufwand', kategorie: 'Lager' },
    { konto: '6700', bezeichnung: 'Zinsen und ähnliche Aufwendungen', typ: 'Aufwand', kategorie: 'Finanzen' },
    { konto: '6800', bezeichnung: 'Sonstige betriebliche Aufwendungen', typ: 'Aufwand', kategorie: 'Sonstiges' },
    { konto: '6805', bezeichnung: 'Versicherungen', typ: 'Aufwand', kategorie: 'Versicherung' },
    { konto: '6815', bezeichnung: 'Rechts- und Beratungskosten', typ: 'Aufwand', kategorie: 'Beratung' },
    { konto: '6820', bezeichnung: 'Buchführung/Jahresabschluss', typ: 'Aufwand', kategorie: 'Beratung' },
    { konto: '6823', bezeichnung: 'Buchführungskosten', typ: 'Aufwand', kategorie: 'Beratung' },
    { konto: '6850', bezeichnung: 'Sonstige betriebliche Kosten', typ: 'Aufwand', kategorie: 'Sonstiges' },
  ],
  
  debitoren: [
    { bereich: '10000-19999', bezeichnung: 'Debitoren (Kunden)', beschreibung: 'Forderungen aus Lieferungen und Leistungen' },
    { konto: '10000', bezeichnung: 'Standard-Debitor', beispiel: 'Amazon Kunde' },
    { konto: '99012594', bezeichnung: 'Sammelkonto Marketplace Kunden', beispiel: 'Marketplace Sammelkonto' },
  ],
  
  kreditoren: [
    { bereich: '70000-79999', bezeichnung: 'Kreditoren (Lieferanten)', beschreibung: 'Verbindlichkeiten aus Lieferungen und Leistungen' },
    { konto: '70000', bezeichnung: 'Standard-Kreditor', beispiel: 'Diverse Lieferanten' },
  ],
  
  kasse_bank: [
    { konto: '1000', bezeichnung: 'Kasse', typ: 'Kasse' },
    { konto: '1200', bezeichnung: 'Bank', typ: 'Bank' },
    { konto: '1201', bezeichnung: 'Commerzbank', typ: 'Bank' },
    { konto: '1202', bezeichnung: 'Postbank', typ: 'Bank' },
    { konto: '1800', bezeichnung: 'PayPal', typ: 'Zahlungsdienstleister' },
    { konto: '1810', bezeichnung: 'Mollie', typ: 'Zahlungsdienstleister' },
    { konto: '1820', bezeichnung: 'Amazon Pay', typ: 'Zahlungsdienstleister' },
  ],
  
  steuer: [
    { konto: '1570', bezeichnung: 'Abziehbare Vorsteuer 7%', typ: 'VSt' },
    { konto: '1576', bezeichnung: 'Abziehbare Vorsteuer 19%', typ: 'VSt' },
    { konto: '1780', bezeichnung: 'Umsatzsteuer 7%', typ: 'USt' },
    { konto: '1776', bezeichnung: 'Umsatzsteuer 19%', typ: 'USt' },
  ]
}

/**
 * GET /api/fibu/kontenplan
 * Liefert den vollständigen Kontenplan
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    
    // Lade zusätzlich die echten Kreditoren aus der DB
    const kreditoren = await db.collection('kreditoren')
      .find({})
      .sort({ kreditorenNummer: 1 })
      .toArray()
    
    const kreditorenListe = kreditoren.map(k => ({
      konto: k.kreditorenNummer,
      bezeichnung: k.name,
      standardKonto: k.standardAufwandskonto,
      typ: 'Kreditor'
    }))
    
    return NextResponse.json({
      ok: true,
      kontenplan: {
        ...STANDARD_KONTENPLAN,
        kreditoren_aktiv: kreditorenListe
      },
      info: {
        sachkonten: STANDARD_KONTENPLAN.sachkonten.length,
        kreditoren: kreditorenListe.length,
        debitoren: STANDARD_KONTENPLAN.debitoren.length,
        kasse_bank: STANDARD_KONTENPLAN.kasse_bank.length
      }
    })
    
  } catch (error: any) {
    console.error('[Kontenplan API] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
