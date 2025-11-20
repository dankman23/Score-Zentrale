#!/usr/bin/env node

/**
 * Kontenplan-Import aus Excel
 * Importiert die aktiven Konten aus der bereitgestellten Excel-Datei
 * und speichert sie sauber in MongoDB
 */

const { MongoClient } = require('mongodb')
const fs = require('fs')

// Konten aus der Excel-Analyse (bereits extrahiert)
const KONTEN = [
  // Kontenklasse 0 - Anlagevermögen
  { kontonummer: '0000', bezeichnung: 'EDV-Software', klasse: 0 },
  { kontonummer: '0000', bezeichnung: 'PKW', klasse: 0 },
  { kontonummer: '0000', bezeichnung: 'Büroeinrichtung', klasse: 0 },
  { kontonummer: '0000', bezeichnung: 'Geringwertige Wirtschaftsgüter', klasse: 0 },
  { kontonummer: '0000', bezeichnung: 'Sonstige Betriebs- und Geschäftsausstattung', klasse: 0 },
  { kontonummer: '0100', bezeichnung: 'Waren (Bestand)', klasse: 0 },
  
  // Kontenklasse 1 - Umlaufvermögen / Forderungen
  { kontonummer: '1160', bezeichnung: 'Forderungen aus Lieferungen und Leistungen', klasse: 1 },
  { kontonummer: '1200', bezeichnung: 'Zweifelhafte Forderungen', klasse: 1 },
  { kontonummer: '1210', bezeichnung: 'Sonstige Vermögensgegenstände mit einer Restlaufzeit bis zu 1 Jahr', klasse: 1 },
  { kontonummer: '1240', bezeichnung: 'Sonstige Vermögensgegenstände mit einer Restlaufzeit bis zu 1 Jahr', klasse: 1 },
  { kontonummer: '1301', bezeichnung: 'Kautionen', klasse: 1 },
  { kontonummer: '1302', bezeichnung: 'Forderungen gegenüber Krankenkassen aus Aufwendungsausgleichsgesetz', klasse: 1 },
  { kontonummer: '1350', bezeichnung: 'Durchlaufende Posten', klasse: 1 },
  { kontonummer: '1369', bezeichnung: 'Abziehbare Vorsteuer 7 %', klasse: 1 },
  { kontonummer: '1370', bezeichnung: 'Abziehbare Vorsteuer aus innergemeinschaftlichem Erwerb 19 %', klasse: 1 },
  { kontonummer: '1401', bezeichnung: 'Abziehbare Vorsteuer 19 %', klasse: 1 },
  { kontonummer: '1404', bezeichnung: 'Abziehbare Vorsteuer nach § 13b UStG 19 %', klasse: 1 },
  { kontonummer: '1406', bezeichnung: 'Geldtransit', klasse: 1 },
  { kontonummer: '1407', bezeichnung: 'Postbank', klasse: 1 },
  { kontonummer: '1500', bezeichnung: 'Paypal', klasse: 1 },
  { kontonummer: '1701', bezeichnung: 'Kasse', klasse: 1 },
  { kontonummer: '1801', bezeichnung: 'SCORE', klasse: 1 },
  { kontonummer: '1802', bezeichnung: 'Commerzbank', klasse: 1 },
  { kontonummer: '1810', bezeichnung: 'eBay Payments Sammelkonto', klasse: 1 },
  { kontonummer: '1811', bezeichnung: 'amazon IT Sammelkonto', klasse: 1 },
  { kontonummer: '1813', bezeichnung: 'amazon FR Sammelkonto', klasse: 1 },
  { kontonummer: '1814', bezeichnung: 'amazon DE Sammelkonto', klasse: 1 },
  { kontonummer: '1815', bezeichnung: 'amazon NL Sammelkonto', klasse: 1 },
  { kontonummer: '1816', bezeichnung: 'amazon ES Sammelkonto', klasse: 1 },
  { kontonummer: '1817', bezeichnung: 'amazon BE Sammelkonto', klasse: 1 },
  { kontonummer: '1819', bezeichnung: 'Commerzbank Tagesgeld', klasse: 1 },
  { kontonummer: '1820', bezeichnung: 'Commerzbank Mastercard', klasse: 1 },
  { kontonummer: '1821', bezeichnung: 'Commerzbank Mastercard NEU', klasse: 1 },
  { kontonummer: '1840', bezeichnung: 'Bank', klasse: 1 },
  
  // Eigenkapital
  { kontonummer: '1900', bezeichnung: 'Gesellschafter-Darlehen', klasse: 1 },
  { kontonummer: '1910', bezeichnung: 'Vollhafter/Einzelunternehmer', klasse: 1 },
  { kontonummer: '1920', bezeichnung: 'Kommandit-Kapital', klasse: 1 },
  { kontonummer: '1930', bezeichnung: 'Teilhafter', klasse: 1 },
  { kontonummer: '1940', bezeichnung: 'Gesellschafter-Darlehen Teilhafter', klasse: 1 },
  { kontonummer: '1950', bezeichnung: 'Privatentnahmen allgemein Vollhafter/Einzelunternehmer', klasse: 1 },
  { kontonummer: '1960', bezeichnung: 'Unentgeltliche Wertabgaben Vollhafter/Einzelunternehmer', klasse: 1 },
  { kontonummer: '1970', bezeichnung: 'Privatentnahmen allgemein Teilhafter', klasse: 1 },
  
  // Kontenklasse 2 - Rückstellungen
  { kontonummer: '2020', bezeichnung: 'Gewerbesteuerrückstellung, § 4 Abs. 5b EStG', klasse: 2 },
  { kontonummer: '2050', bezeichnung: 'Sonstige Rückstellungen', klasse: 2 },
  { kontonummer: '2070', bezeichnung: 'Rückstellungen für Personalkosten', klasse: 2 },
  { kontonummer: '2100', bezeichnung: 'Urlaubsrückstellungen', klasse: 2 },
  { kontonummer: '2130', bezeichnung: 'Rückstellungen für Gewährleistungen (Gegenkonto 6790)', klasse: 2 },
  { kontonummer: '2500', bezeichnung: 'Rückstellungen für Abschluss- und Prüfungskosten', klasse: 2 },
  
  // Kontenklasse 3 - Verbindlichkeiten
  { kontonummer: '3035', bezeichnung: 'Rückstellungen zur Erfüllung der Aufbewahrungspflichten', klasse: 3 },
  { kontonummer: '3070', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten - Postbank', klasse: 3 },
  { kontonummer: '3074', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten - Commerzbank I', klasse: 3 },
  { kontonummer: '3079', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten - Commerzbank II', klasse: 3 },
  { kontonummer: '3090', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten mit einer Restlaufzeit von 1 bis 5 Jahre - Commerzbank III', klasse: 3 },
  { kontonummer: '3095', bezeichnung: 'Erhaltene, versteuerte Anzahlungen', klasse: 3 },
  { kontonummer: '3096', bezeichnung: '19 % Umsatzsteuer (Verbindlichkeiten)', klasse: 3 },
  { kontonummer: '3150', bezeichnung: 'Erhaltene Anzahlungen mit einer Restlaufzeit bis zu 1 Jahr', klasse: 3 },
  { kontonummer: '3160', bezeichnung: 'Verbindlichkeiten aus Lieferungen und Leistungen', klasse: 3 },
  { kontonummer: '3161', bezeichnung: 'Sonstige Verbindlichkeiten', klasse: 3 },
  { kontonummer: '3162', bezeichnung: 'Sonstige Verbindlichkeiten mit einer Restlaufzeit bis Jahr', klasse: 3 },
  { kontonummer: '3272', bezeichnung: 'Sonstige Verbindlichkeiten mit einer Restlaufzeit bis zu 1 Jahr - Kreditorische Debitoren', klasse: 3 },
  { kontonummer: '3280', bezeichnung: 'Darlehen D. Epping', klasse: 3 },
  { kontonummer: '3300', bezeichnung: 'Kreditkartenabrechnung', klasse: 3 },
  { kontonummer: '3500', bezeichnung: 'Verbindlichkeiten aus Lohn und Gehalt', klasse: 3 },
  { kontonummer: '3501', bezeichnung: 'Verbindlichkeiten aus Lohn- und Kirchensteuer', klasse: 3 },
  { kontonummer: '3502', bezeichnung: 'Verbindlichkeiten im Rahmen der sozialen Sicherheit', klasse: 3 },
  { kontonummer: '3560', bezeichnung: 'Lohn- und Gehaltsverrechnungskonto', klasse: 3 },
  { kontonummer: '3610', bezeichnung: 'Steuerzahlungen aus im anderen EU-Land steuerpflichtigen Leistungen', klasse: 3 },
  { kontonummer: '3720', bezeichnung: 'Umsatzsteuer aus innergemeinschaftlichem Erwerb 19 %', klasse: 3 },
  { kontonummer: '3730', bezeichnung: 'Umsatzsteuer 19 %', klasse: 3 },
  { kontonummer: '3740', bezeichnung: 'Umsatzsteuer aus im anderen EU-Land steuerpflichtigen Lieferungen', klasse: 3 },
  { kontonummer: '3790', bezeichnung: 'Umsatzsteuervorauszahlungen', klasse: 3 },
  { kontonummer: '3804', bezeichnung: 'Umsatzsteuer-Vorauszahlungen 1/11', klasse: 3 },
  { kontonummer: '3806', bezeichnung: 'Umsatzsteuer nach § 13b UStG 19 %', klasse: 3 },
  { kontonummer: '3817', bezeichnung: 'Umsatzsteuerverbindlichkeiten Vorjahr', klasse: 3 },
  { kontonummer: '3820', bezeichnung: 'Umsatzsteuerverbindlichkeiten frühere Jahre', klasse: 3 },
  
  // Kontenklasse 4 - Erlöskonten
  { kontonummer: '4000', bezeichnung: 'Umsatzerlöse', klasse: 4, typ: 'erloes' },
  { kontonummer: '4100', bezeichnung: 'Zwischenkonto', klasse: 4, typ: 'erloes' },
  { kontonummer: '4110', bezeichnung: 'Steuerfreie Umsätze § 4 Nr. 8 ff. UStG', klasse: 4, typ: 'erloes' },
  { kontonummer: '4120', bezeichnung: 'Sonstige steuerfreie Umsätze Inland', klasse: 4, typ: 'erloes' },
  { kontonummer: '4125', bezeichnung: 'Steuerfreie Umsätze § 4 Nr. 1a UStG', klasse: 4, typ: 'erloes' },
  { kontonummer: '4320', bezeichnung: 'Steuerfreie innergemeinschaftliche Lieferungen § 4 Nr. 1b UStG', klasse: 4, typ: 'erloes' },
  { kontonummer: '4400', bezeichnung: 'Erlöse aus im anderen EU-Land steuerpflichtigen Lieferungen, im Inland nicht steuerbar', klasse: 4, typ: 'erloes' },
  { kontonummer: '4639', bezeichnung: 'Erlöse 19 % USt', klasse: 4, typ: 'erloes' },
  { kontonummer: '4645', bezeichnung: 'Verwendung von Gegenständen für Zwecke außerhalb des Unternehmens ohne USt (Fahrzeug-Nutzung)', klasse: 4, typ: 'erloes' },
  { kontonummer: '4720', bezeichnung: 'Verwendung von Gegenständen für Zwecke außerhalb des Unternehmens 19 % USt (Fahrzeug-Nutzung)', klasse: 4, typ: 'erloes' },
  { kontonummer: '4727', bezeichnung: 'Erlösschmälerungen 19 % USt', klasse: 4, typ: 'erloes' },
  { kontonummer: '4736', bezeichnung: 'Erlösschmälerungen aus im anderen EU-Land steuerpflichtigen Lieferungen', klasse: 4, typ: 'erloes' },
  { kontonummer: '4743', bezeichnung: 'Gewährte Skonti 19 % USt', klasse: 4, typ: 'erloes' },
  { kontonummer: '4830', bezeichnung: 'Gewährte Skonti aus steuerfreien innergemeinschaftlichen Lieferungen § 4 Nr. 1b UStG', klasse: 4, typ: 'erloes' },
  { kontonummer: '4836', bezeichnung: 'Sonstige betriebliche Erträge', klasse: 4, typ: 'erloes' },
  { kontonummer: '4960', bezeichnung: 'Sonstige Erträge betrieblich und regelmäßig 19 % USt', klasse: 4, typ: 'erloes' },
  { kontonummer: '4972', bezeichnung: 'Periodenfremde Erträge', klasse: 4, typ: 'erloes' },
  
  // Kontenklasse 5 - Wareneinkauf / Aufwendungen
  { kontonummer: '5200', bezeichnung: 'Erstattungen Aufwendungsausgleichsgesetz', klasse: 5, typ: 'kosten' },
  { kontonummer: '5400', bezeichnung: 'Wareneingang', klasse: 5, typ: 'kosten' },
  { kontonummer: '5425', bezeichnung: 'Wareneingang 19 % Vorsteuer', klasse: 5, typ: 'kosten' },
  { kontonummer: '5700', bezeichnung: 'Innergemeinschaftlicher Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer', klasse: 5, typ: 'kosten' },
  { kontonummer: '5725', bezeichnung: 'Nachlässe', klasse: 5, typ: 'kosten' },
  { kontonummer: '5736', bezeichnung: 'Nachlässe aus innergemeinschaftlichem Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer', klasse: 5, typ: 'kosten' },
  { kontonummer: '5748', bezeichnung: 'Erhaltene Skonti 19 % Vorsteuer', klasse: 5, typ: 'kosten' },
  { kontonummer: '5881', bezeichnung: 'Erhaltene Skonti aus steuerpflichtigem innergemeinschaftlichem Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer', klasse: 5, typ: 'kosten' },
  { kontonummer: '5900', bezeichnung: 'Bestandsveränderungen Waren', klasse: 5, typ: 'kosten' },
  { kontonummer: '5923', bezeichnung: 'Fremdleistungen', klasse: 5, typ: 'kosten' },
  { kontonummer: '5925', bezeichnung: 'Sonstige Leistungen eines im anderen EU-Land ansässigen Unternehmers 19 % Vorsteuer und 19 % Umsatzsteuer', klasse: 5, typ: 'kosten' },
  
  // Kontenklasse 6 - Betriebliche Aufwendungen
  { kontonummer: '6020', bezeichnung: 'Leistungen eines im Ausland ansässigen Unternehmers 19 % Vorsteuer und 19 % Umsatzsteuer', klasse: 6, typ: 'kosten' },
  { kontonummer: '6035', bezeichnung: 'Gehälter', klasse: 6, typ: 'kosten' },
  { kontonummer: '6039', bezeichnung: 'Löhne für Minijobs', klasse: 6, typ: 'kosten' },
  { kontonummer: '6076', bezeichnung: 'Pauschale Steuern für Arbeitnehmer', klasse: 6, typ: 'kosten' },
  { kontonummer: '6110', bezeichnung: 'Aufwendungen aus der Veränderung von Urlaubsrückstellungen', klasse: 6, typ: 'kosten' },
  { kontonummer: '6116', bezeichnung: 'Gesetzliche soziale Aufwendungen', klasse: 6, typ: 'kosten' },
  { kontonummer: '6120', bezeichnung: 'Gesetzliche soziale Aufwendungen - Urlaubsrückstellungen', klasse: 6, typ: 'kosten' },
  { kontonummer: '6130', bezeichnung: 'Beiträge zur Berufsgenossenschaft', klasse: 6, typ: 'kosten' },
  { kontonummer: '6220', bezeichnung: 'Freiwillige soziale Aufwendungen, lohnsteuerfrei', klasse: 6, typ: 'kosten' },
  { kontonummer: '6222', bezeichnung: 'Abschreibungen auf Sachanlagen (ohne AfA auf Fahrzeuge und Gebäude)', klasse: 6, typ: 'kosten' },
  { kontonummer: '6310', bezeichnung: 'Abschreibungen auf Fahrzeuge', klasse: 6, typ: 'kosten' },
  { kontonummer: '6325', bezeichnung: 'Miete (unbewegliche Wirtschaftsgüter)', klasse: 6, typ: 'kosten' },
  { kontonummer: '6330', bezeichnung: 'Gas, Strom, Wasser', klasse: 6, typ: 'kosten' },
  { kontonummer: '6345', bezeichnung: 'Reinigung', klasse: 6, typ: 'kosten' },
  { kontonummer: '6420', bezeichnung: 'Sonstige Raumkosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6495', bezeichnung: 'Beiträge', klasse: 6, typ: 'kosten' },
  { kontonummer: '6530', bezeichnung: 'Wartungskosten für Hard- und Software', klasse: 6, typ: 'kosten' },
  { kontonummer: '6540', bezeichnung: 'Laufende Fahrzeug-Betriebskosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6570', bezeichnung: 'Fahrzeug-Reparaturen', klasse: 6, typ: 'kosten' },
  { kontonummer: '6595', bezeichnung: 'Sonstige Fahrzeugkosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6600', bezeichnung: 'Fremdfahrzeugkosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6640', bezeichnung: 'Werbekosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6643', bezeichnung: 'Bewirtungskosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6644', bezeichnung: 'Aufmerksamkeiten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6656', bezeichnung: 'Nicht abzugsfähige Bewirtungskosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6673', bezeichnung: 'Pauschale Steuern für Arbeitnehmer', klasse: 6, typ: 'kosten' },
  { kontonummer: '6675', bezeichnung: 'Reisekosten Unternehmer, Fahrtkosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6700', bezeichnung: 'Kilometergelderstattung Arbeitnehmer', klasse: 6, typ: 'kosten' },
  { kontonummer: '6710', bezeichnung: 'Kosten der Warenabgabe', klasse: 6, typ: 'kosten' },
  { kontonummer: '6770', bezeichnung: 'Verpackungsmaterial', klasse: 6, typ: 'kosten' },
  { kontonummer: '6800', bezeichnung: 'Verkaufsprovisionen', klasse: 6, typ: 'kosten' },
  { kontonummer: '6805', bezeichnung: 'Porto', klasse: 6, typ: 'kosten' },
  { kontonummer: '6810', bezeichnung: 'Telefon', klasse: 6, typ: 'kosten' },
  { kontonummer: '6815', bezeichnung: 'Internetkosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6825', bezeichnung: 'Bürobedarf', klasse: 6, typ: 'kosten' },
  { kontonummer: '6827', bezeichnung: 'Rechts- und Beratungskosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6830', bezeichnung: 'Abschluss- und Prüfungskosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6837', bezeichnung: 'Buchführungskosten', klasse: 6, typ: 'kosten' },
  { kontonummer: '6850', bezeichnung: 'Aufwendungen für die zeitlich befristete Überlassung von Rechten (Lizenzen, Konzessionen)', klasse: 6, typ: 'kosten' },
  { kontonummer: '6855', bezeichnung: 'Sonstiger Betriebsbedarf', klasse: 6, typ: 'kosten' },
  { kontonummer: '6859', bezeichnung: 'Nebenkosten des Geldverkehrs', klasse: 6, typ: 'kosten' },
  
  // Kontenklasse 7
  { kontonummer: '7000', bezeichnung: 'Aufwendungen für Abraum- und Abfallbeseitigung', klasse: 7, typ: 'kosten' },
  { kontonummer: '7200', bezeichnung: 'Zinsaufwendungen für langfristige Verbindlichkeiten', klasse: 7, typ: 'kosten' },
  { kontonummer: '7610', bezeichnung: 'Gewerbesteuer', klasse: 7, typ: 'kosten' },
  
  // Kontenklasse 9 - Abschlusskonten
  { kontonummer: '9000', bezeichnung: 'Saldenvorträge Sachkonten', klasse: 9 },
  { kontonummer: '9008', bezeichnung: 'Saldenvorträge Debitoren', klasse: 9 },
  { kontonummer: '9009', bezeichnung: 'Saldenvorträge Kreditoren', klasse: 9 },
  
  // Debitorenkonten (70xxx) - Sammelkonten für Kunden
  { kontonummer: '70003', bezeichnung: 'Debitor 70003', klasse: 7, typ: 'debitor' },
  { kontonummer: '70025', bezeichnung: 'Debitor 70025', klasse: 7, typ: 'debitor' },
  { kontonummer: '70040', bezeichnung: 'Debitor 70040', klasse: 7, typ: 'debitor' },
  { kontonummer: '70154', bezeichnung: 'Debitor 70154', klasse: 7, typ: 'debitor' },
  
  // Wichtige Kreditorenkonten
  { kontonummer: '69001', bezeichnung: 'Kreditor Amazon Payment', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69002', bezeichnung: 'Kreditor Bar', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69003', bezeichnung: 'Kreditor eBay Managed Payments', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69004', bezeichnung: 'Kreditor eBay Rechnungskauf', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69005', bezeichnung: 'Kreditor EPS', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69006', bezeichnung: 'Kreditor GiroPay', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69007', bezeichnung: 'Kreditor Kaufland.de', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69008', bezeichnung: 'Kreditor Kreditkarte', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69010', bezeichnung: 'Kreditor Nachnahme', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69011', bezeichnung: 'Kreditor Otto.de', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69012', bezeichnung: 'Kreditor PayPal', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69013', bezeichnung: 'Kreditor PayPal Express', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69014', bezeichnung: 'Kreditor Ratepay', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69015', bezeichnung: 'Kreditor Rechnung', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69017', bezeichnung: 'Kreditor Scheck', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69018', bezeichnung: 'Kreditor Überweisung/Vorkasse', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69019', bezeichnung: 'Kreditor Überweisung/Vorkasse mit 2% Skonto', klasse: 6, typ: 'kreditor' },
  { kontonummer: '69020', bezeichnung: 'Kreditor Mollie', klasse: 6, typ: 'kreditor' },
]

async function importKontenplan() {
  const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/fibu'
  
  console.log('🔄 Verbinde mit MongoDB...')
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db()
    const collection = db.collection('kontenplan')
    
    console.log('🗑️  Lösche alten Kontenplan...')
    await collection.deleteMany({})
    
    console.log('📊 Importiere Konten...')
    console.log(`   Gesamt: ${KONTEN.length} Konten`)
    
    // Deduplizierung: Entferne doppelte Kontonummern (nimm erste)
    const kontoMap = new Map()
    for (const konto of KONTEN) {
      const key = konto.kontonummer
      if (!kontoMap.has(key)) {
        kontoMap.set(key, konto)
      } else {
        console.log(`   ⚠️  Duplikat ignoriert: ${key} - ${konto.bezeichnung}`)
      }
    }
    
    const uniqueKonten = Array.from(kontoMap.values())
    console.log(`   Nach Deduplizierung: ${uniqueKonten.length} einzigartige Konten`)
    
    // Validierung
    let valid = 0
    let invalid = 0
    const toInsert = []
    
    for (const konto of uniqueKonten) {
      if (!konto.kontonummer || !konto.bezeichnung) {
        console.log(`   ❌ Ungültig: ${JSON.stringify(konto)}`)
        invalid++
        continue
      }
      
      // Erstelle sauberes Konto-Objekt
      const cleanKonto = {
        kontonummer: konto.kontonummer.toString().trim(),
        bezeichnung: konto.bezeichnung.trim(),
        klasse: konto.klasse || 0,
        typ: konto.typ || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      toInsert.push(cleanKonto)
      valid++
    }
    
    console.log(`   ✅ Gültig: ${valid}`)
    console.log(`   ❌ Ungültig: ${invalid}`)
    
    if (toInsert.length > 0) {
      const result = await collection.insertMany(toInsert)
      console.log(`   💾 ${result.insertedCount} Konten erfolgreich importiert!`)
    }
    
    // Statistik
    console.log('\n📈 Statistik:')
    const erloes = toInsert.filter(k => k.typ === 'erloes').length
    const kosten = toInsert.filter(k => k.typ === 'kosten').length
    const kreditor = toInsert.filter(k => k.typ === 'kreditor').length
    const debitor = toInsert.filter(k => k.typ === 'debitor').length
    const sonstige = toInsert.length - erloes - kosten - kreditor - debitor
    
    console.log(`   💰 Erlöskonten (4xxx): ${erloes}`)
    console.log(`   💸 Kostenkonten (5xxx/6xxx/7xxx): ${kosten}`)
    console.log(`   🏢 Kreditorenkonten: ${kreditor}`)
    console.log(`   👤 Debitorenkonten: ${debitor}`)
    console.log(`   📦 Sonstige: ${sonstige}`)
    
    console.log('\n✅ Kontenplan-Import erfolgreich abgeschlossen!')
    
  } catch (error) {
    console.error('❌ Fehler beim Import:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

// Führe Import aus
importKontenplan()
