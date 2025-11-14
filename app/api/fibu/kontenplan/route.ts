export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

/**
 * Kontenplan API - SKR04 (Abschlussgliederungsprinzip)
 * 
 * DATEV Struktur:
 * - 1. Ziffer: Kontenklasse (0-9)
 * - 1.-2. Ziffer: Kontengruppe
 * - 1.-3. Ziffer: Kontenuntergruppe
 * - 4-stellig: Einzelkonto
 */

// SKR04 Kontenklassen-Definition
const SKR04_KLASSEN = {
  0: { bezeichnung: 'Anlagevermögen', typ: 'aktiv' },
  1: { bezeichnung: 'Umlaufvermögen', typ: 'aktiv' },
  2: { bezeichnung: 'Eigenkapital', typ: 'passiv' },
  3: { bezeichnung: 'Fremdkapital', typ: 'passiv' },
  4: { bezeichnung: 'Betriebliche Erträge', typ: 'ertrag' },
  5: { bezeichnung: 'Betriebliche Aufwendungen', typ: 'aufwand' },
  6: { bezeichnung: 'Betriebliche Aufwendungen', typ: 'aufwand' },
  7: { bezeichnung: 'Weitere Erträge und Aufwendungen', typ: 'aufwand' },
  8: { bezeichnung: 'Zur freien Verfügung', typ: 'sonder' },
  9: { bezeichnung: 'Vortrags-, Kapital-, Korrektur- und statistische Konten', typ: 'sonder' }
}

function analyzeKontonummer(kontonummer: string) {
  const klasse = parseInt(kontonummer[0])
  const gruppe = kontonummer.substring(0, 2)
  const untergruppe = kontonummer.substring(0, 3)
  
  const klassenInfo = SKR04_KLASSEN[klasse as keyof typeof SKR04_KLASSEN] || {
    bezeichnung: 'Unbekannt',
    typ: 'sonder'
  }
  
  return {
    kontenklasse: klasse,
    kontengruppe: gruppe,
    kontenuntergruppe: untergruppe,
    kontenklasseBezeichnung: klassenInfo.bezeichnung,
    kontenklasseTyp: klassenInfo.typ
  }
}

// FALLBACK: Alter Standard-Kontenplan (wird nicht mehr verwendet)
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
    // IGL-Debitoren (Innergemeinschaftliche Lieferung mit USt-ID)
    { bereich: '10000-19999', bezeichnung: 'IGL-Debitoren (EU mit USt-ID)', beschreibung: 'EU-Kunden mit USt-ID - brauchen eigenen Debitor für USt-ID-Hinterlegung' },
    { konto: '10000', bezeichnung: 'IGL-Debitor Beispiel', beispiel: 'EU-Kunde mit USt-ID' },
    
    // Sammelkonten nach Zahlungsart (69xxx)
    { bereich: '69000-69999', bezeichnung: 'Sammelkonten nach Zahlungsart', beschreibung: 'Alle Standard-Kunden werden nach Zahlungsart zusammengefasst' },
    { konto: '69001', bezeichnung: 'Sammelkonto Amazon Payment', zahlungsart: 'Amazon Payment' },
    { konto: '69002', bezeichnung: 'Sammelkonto Bar', zahlungsart: 'Bar' },
    { konto: '69003', bezeichnung: 'Sammelkonto eBay Managed Payments', zahlungsart: 'eBay Managed Payments' },
    { konto: '69004', bezeichnung: 'Sammelkonto eBay Rechnungskauf', zahlungsart: 'eBay Rechnungskauf' },
    { konto: '69005', bezeichnung: 'Sammelkonto EPS', zahlungsart: 'EPS' },
    { konto: '69006', bezeichnung: 'Sammelkonto GiroPay', zahlungsart: 'GiroPay' },
    { konto: '69007', bezeichnung: 'Sammelkonto Kaufland.de', zahlungsart: 'Kaufland.de' },
    { konto: '69008', bezeichnung: 'Sammelkonto Kreditkarte', zahlungsart: 'Kreditkarte' },
    { konto: '69010', bezeichnung: 'Sammelkonto Nachnahme', zahlungsart: 'Nachnahme' },
    { konto: '69011', bezeichnung: 'Sammelkonto Otto.de', zahlungsart: 'Otto.de' },
    { konto: '69012', bezeichnung: 'Sammelkonto Paypal', zahlungsart: 'Paypal' },
    { konto: '69013', bezeichnung: 'Sammelkonto PayPal Express', zahlungsart: 'PayPal Express' },
    { konto: '69014', bezeichnung: 'Sammelkonto Ratepay', zahlungsart: 'Ratepay' },
    { konto: '69015', bezeichnung: 'Sammelkonto Rechnung', zahlungsart: 'Rechnung' },
    { konto: '69016', bezeichnung: 'Sammelkonto Rechnungskauf', zahlungsart: 'Rechnungskauf' },
    { konto: '69017', bezeichnung: 'Sammelkonto Scheck', zahlungsart: 'Scheck' },
    { konto: '69018', bezeichnung: 'Sammelkonto Überweisung / Vorkasse', zahlungsart: 'Überweisung / Vorkasse' },
    { konto: '69019', bezeichnung: 'Sammelkonto Überweisung mit 2% Skonto', zahlungsart: 'Überweisung / Vorkasse mit 2% Skc' },
    { konto: '69020', bezeichnung: 'Sammelkonto Mollie', zahlungsart: 'Mollie' },
    { konto: '69022', bezeichnung: 'Sammelkonto Apple Pay', zahlungsart: 'Apple Pay' },
    
    // Marketplace Sammelkonto
    { konto: '99012594', bezeichnung: 'Sammelkonto Marketplace Kunden', beispiel: 'Amazon, eBay, Otto Sammelkonto' },
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
