/**
 * Import aller Konten aus der Summen- und Saldenliste
 * SKR04 Struktur (Abschlussgliederungsprinzip)
 */

const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'

// SKR04 Kontenklassen
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

// ALLE 135 Konten aus der Excel
const KONTEN = [
  // Kontenklasse 0 - Anlagevermögen
  { konto: '0650', bezeichnung: 'EDV-Software' },
  { konto: '0670', bezeichnung: 'PKW' },
  { konto: '0690', bezeichnung: 'Büroeinrichtung' },
  
  // Kontenklasse 1 - Umlaufvermögen
  { konto: '1140', bezeichnung: 'Geringwertige Wirtschaftsgüter' },
  { konto: '1200', bezeichnung: 'Waren (Bestand)' },
  { konto: '1240', bezeichnung: 'Sonstige Betriebs- und Geschäftsausstattung' },
  { konto: '1301', bezeichnung: 'Forderungen aus Lieferungen und Leistungen' },
  { konto: '1302', bezeichnung: 'Zweifelhafte Forderungen' },
  { konto: '1350', bezeichnung: 'Sonstige Vermögensgegenstände mit einer Restlaufzeit bis zu 1 Jahr' },
  { konto: '1369', bezeichnung: 'Sonstige Vermögensgegenstände mit einer Restlaufzeit bis zu 1 Jahr' },
  { konto: '1370', bezeichnung: 'Kautionen' },
  { konto: '1401', bezeichnung: 'Forderungen gegenüber Krankenkassen aus Aufwendungsausgleichsgesetz' },
  { konto: '1404', bezeichnung: 'Durchlaufende Posten' },
  { konto: '1406', bezeichnung: 'Abziehbare Vorsteuer 7 %' },
  { konto: '1407', bezeichnung: 'Abziehbare Vorsteuer aus innergemeinschaftlichem Erwerb 19 %' },
  { konto: '1460', bezeichnung: 'Abziehbare Vorsteuer 19 %' },
  { konto: '1701', bezeichnung: 'Abziehbare Vorsteuer nach § 13b UStG 19 %' },
  { konto: '1801', bezeichnung: 'Geldtransit' },
  { konto: '1802', bezeichnung: 'Postbank' },
  { konto: '1810', bezeichnung: 'Paypal' },
  { konto: '1811', bezeichnung: 'SCORE' },
  { konto: '1813', bezeichnung: 'Commerzbank' },
  { konto: '1814', bezeichnung: 'eBay PaymentsSammelkonto' },
  { konto: '1815', bezeichnung: 'amazon IT Sammelkonto' },
  { konto: '1816', bezeichnung: 'amazon FR Sammelkonto' },
  { konto: '1817', bezeichnung: 'amazon DE Sammelkonto' },
  { konto: '1819', bezeichnung: 'amazon NL Sammelkonto' },
  { konto: '1820', bezeichnung: 'amazon ES Sammelkonto' },
  { konto: '1821', bezeichnung: 'Commerzbank Mastercard' },
  { konto: '1840', bezeichnung: 'Commerzbank Tagesgeld' },
  
  // Kontenklasse 2 - Eigenkapital (hier teilweise als 3xxx!)
  { konto: '3035', bezeichnung: 'Gesellschafter-Darlehen Vollhafter/Einzelunternehmer' },
  { konto: '3070', bezeichnung: 'Kommandit-Kapital Teilhafter' },
  { konto: '3074', bezeichnung: 'Gesellschafter-Darlehen Teilhafter' },
  { konto: '3079', bezeichnung: 'Privatentnahmen allgemein Vollhafter/Einzelunternehmer' },
  { konto: '3090', bezeichnung: 'Unentgeltliche Wertabgaben Vollhafter/Einzelunternehmer' },
  { konto: '3095', bezeichnung: 'Privatentnahmen allgemein Teilhafter' },
  
  // Kontenklasse 3 - Fremdkapital (Rückstellungen + Verbindlichkeiten)
  { konto: '3096', bezeichnung: 'Gewerbesteuerrückstellung, § 4 Abs. 5b EStG' },
  { konto: '3150', bezeichnung: 'Sonstige Rückstellungen' },
  { konto: '3160', bezeichnung: 'Rückstellungen für Personalkosten' },
  { konto: '3161', bezeichnung: 'Urlaubsrückstellungen' },
  { konto: '3162', bezeichnung: 'Rückstellungen für Gewährleistungen (Gegenkonto 6790)' },
  { konto: '3272', bezeichnung: 'Rückstellungen für Abschluss- und Prüfungskosten' },
  { konto: '3280', bezeichnung: 'Rückstellungen zur Erfüllung der Aufbewahrungspflichten' },
  { konto: '3300', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten - Postbank' },
  { konto: '3500', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten - Commerzbank I' },
  { konto: '3501', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten - Commerzbank II' },
  { konto: '3502', bezeichnung: 'Verbindlichkeiten gegenüber Kreditinstituten mit einer Restlaufzeit von 1 bis 5 Jahre - Commerzbank III' },
  { konto: '3560', bezeichnung: 'Erhaltene, versteuerte Anzahlungen 19 % Umsatzsteuer (Verbindlichkeiten)' },
  { konto: '3610', bezeichnung: 'Erhaltene Anzahlungen mit einer Restlaufzeit bis zu 1 Jahr' },
  { konto: '3720', bezeichnung: 'Verbindlichkeiten aus Lieferungen und Leistungen' },
  { konto: '3730', bezeichnung: 'Sonstige Verbindlichkeiten' },
  { konto: '3740', bezeichnung: 'Sonstige Verbindlichkeiten mit einer Restlaufzeit bis Jahr' },
  { konto: '3790', bezeichnung: 'Sonstige Verbindlichkeiten mit einer Restlaufzeit bis zu 1 Jahr - Kreditorische Debitoren' },
  { konto: '3799', bezeichnung: 'Darlehen D. Epping' },
  { konto: '3804', bezeichnung: 'Kreditkartenabrechnung' },
  { konto: '3806', bezeichnung: 'Verbindlichkeiten aus Lohn und Gehalt' },
  { konto: '3817', bezeichnung: 'Verbindlichkeiten aus Lohn- und Kirchensteuer' },
  { konto: '3820', bezeichnung: 'Verbindlichkeiten im Rahmen der sozialen Sicherheit' },
  { konto: '3830', bezeichnung: 'Lohn- und Gehaltsverrechnungskonto' },
  { konto: '3837', bezeichnung: 'Steuerzahlungen aus im anderen EU-Land steuerpflichtigen Leistungen' },
  { konto: '3841', bezeichnung: 'Umsatzsteuer aus innergemeinschaftlichem Erwerb 19 %' },
  { konto: '3845', bezeichnung: 'Umsatzsteuer 19 %' },
  
  // Kontenklasse 4 - Betriebliche Erträge
  { konto: '4000', bezeichnung: 'Umsatzsteuer aus im anderen EU-Land steuerpflichtigen Lieferungen' },
  { konto: '4100', bezeichnung: 'Umsatzsteuervorauszahlungen' },
  { konto: '4110', bezeichnung: 'Umsatzsteuer-Vorauszahlungen 1/11' },
  { konto: '4120', bezeichnung: 'Umsatzsteuer nach § 13b UStG 19 %' },
  { konto: '4125', bezeichnung: 'Umsatzsteuerverbindlichkeiten Vorjahr' },
  { konto: '4320', bezeichnung: 'Umsatzsteuerverbindlichkeiten frühere Jahre' },
  { konto: '4400', bezeichnung: 'Umsatzerlöse' },
  { konto: '4639', bezeichnung: 'Zwischenkonto' },
  { konto: '4645', bezeichnung: 'Steuerfreie Umsätze § 4 Nr. 8 ff. UStG' },
  { konto: '4720', bezeichnung: 'Sonstige steuerfreie Umsätze Inland' },
  { konto: '4727', bezeichnung: 'Steuerfreie Umsätze § 4 Nr. 1a UStG' },
  { konto: '4736', bezeichnung: 'Steuerfreie innergemeinschaftliche Lieferungen § 4 Nr. 1b UStG' },
  { konto: '4743', bezeichnung: 'Erlöse aus im anderen EU-Land steuerpflichtigen Lieferungen, im Inland nicht steuerbar' },
  { konto: '4830', bezeichnung: 'Erlöse 19 % USt' },
  { konto: '4836', bezeichnung: 'Verwendung von Gegenständen für Zwecke außerhalb des Unternehmens ohne USt (Fahrzeug-Nutzung)' },
  { konto: '4960', bezeichnung: 'Verwendung von Gegenständen für Zwecke außerhalb des Unternehmens 19 % USt (Fahrzeug-Nutzung)' },
  { konto: '4972', bezeichnung: 'Erlösschmälerungen 19 % USt' },
  
  // Kontenklasse 5 - Betriebliche Aufwendungen (Waren + Personal)
  { konto: '5200', bezeichnung: 'Erlösschmälerungen aus im anderen EU-Land steuerpflichtigen Lieferungen' },
  { konto: '5400', bezeichnung: 'Gewährte Skonti 19 % USt' },
  { konto: '5425', bezeichnung: 'Gewährte Skonti aus steuerfreien innergemeinschaftlichen Lieferungen § 4 Nr. 1b UStG' },
  { konto: '5700', bezeichnung: 'Sonstige betriebliche Erträge' },
  { konto: '5725', bezeichnung: 'Sonstige Erträge betrieblich und regelmäßig 19 % USt' },
  { konto: '5736', bezeichnung: 'Periodenfremde Erträge' },
  { konto: '5748', bezeichnung: 'Erstattungen Aufwendungsausgleichsgesetz' },
  { konto: '5881', bezeichnung: 'Wareneingang' },
  { konto: '5900', bezeichnung: 'Wareneingang 19 % Vorsteuer' },
  { konto: '5923', bezeichnung: 'Innergemeinschaftlicher Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer' },
  { konto: '5925', bezeichnung: 'Nachlässe' },
  
  // Kontenklasse 6 - Betriebliche Aufwendungen (Betrieb)
  { konto: '6020', bezeichnung: 'Nachlässe aus innergemeinschaftlichem Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer' },
  { konto: '6035', bezeichnung: 'Erhaltene Skonti 19 % Vorsteuer' },
  { konto: '6039', bezeichnung: 'Erhaltene Skonti aus steuerpflichtigem innergemeinschaftlichem Erwerb 19 % Vorsteuer und 19 % Umsatzsteuer' },
  { konto: '6076', bezeichnung: 'Bestandsveränderungen Waren' },
  { konto: '6110', bezeichnung: 'Fremdleistungen' },
  { konto: '6116', bezeichnung: 'Sonstige Leistungen eines im anderen EU-Land ansässigen Unternehmers 19 % Vorsteuer und 19 % Umsatzsteuer' },
  { konto: '6120', bezeichnung: 'Leistungen eines im Ausland ansässigen Unternehmers 19 % Vorsteuer und 19 % Umsatzsteuer' },
  { konto: '6130', bezeichnung: 'Gehälter' },
  { konto: '6220', bezeichnung: 'Löhne für Minijobs' },
  { konto: '6222', bezeichnung: 'Pauschale Steuern für Arbeitnehmer' },
  { konto: '6310', bezeichnung: 'Aufwendungen aus der Veränderung von Urlaubsrückstellungen' },
  { konto: '6325', bezeichnung: 'Gesetzliche soziale Aufwendungen' },
  { konto: '6330', bezeichnung: 'Gesetzliche soziale Aufwendungen - Urlaubsrückstellungen' },
  { konto: '6345', bezeichnung: 'Beiträge zur Berufsgenossenschaft' },
  { konto: '6420', bezeichnung: 'Freiwillige soziale Aufwendungen, lohnsteuerfrei' },
  { konto: '6495', bezeichnung: 'Abschreibungen auf Sachanlagen (ohne AfA auf Fahrzeuge und Gebäude)' },
  { konto: '6530', bezeichnung: 'Abschreibungen auf Fahrzeuge' },
  { konto: '6540', bezeichnung: 'Miete (unbewegliche Wirtschaftsgüter)' },
  { konto: '6570', bezeichnung: 'Gas, Strom, Wasser' },
  { konto: '6595', bezeichnung: 'Reinigung' },
  { konto: '6600', bezeichnung: 'Sonstige Raumkosten' },
  { konto: '6640', bezeichnung: 'Beiträge' },
  { konto: '6643', bezeichnung: 'Wartungskosten für Hard- und Software' },
  { konto: '6644', bezeichnung: 'Laufende Fahrzeug-Betriebskosten' },
  { konto: '6656', bezeichnung: 'Fahrzeug-Reparaturen' },
  { konto: '6673', bezeichnung: 'Sonstige Fahrzeugkosten' },
  { konto: '6675', bezeichnung: 'Fremdfahrzeugkosten' },
  { konto: '6700', bezeichnung: 'Werbekosten' },
  { konto: '6710', bezeichnung: 'Bewirtungskosten' },
  { konto: '6770', bezeichnung: 'Aufmerksamkeiten' },
  { konto: '6800', bezeichnung: 'Nicht abzugsfähige Bewirtungskosten' },
  { konto: '6805', bezeichnung: 'Pauschale Steuern für Arbeitnehmer' },
  { konto: '6810', bezeichnung: 'Reisekosten Unternehmer, Fahrtkosten' },
  { konto: '6815', bezeichnung: 'Kilometergelderstattung Arbeitnehmer' },
  { konto: '6825', bezeichnung: 'Kosten der Warenabgabe' },
  { konto: '6827', bezeichnung: 'Verpackungsmaterial' },
  { konto: '6830', bezeichnung: 'Verkaufsprovisionen' },
  { konto: '6837', bezeichnung: 'Porto' },
  { konto: '6850', bezeichnung: 'Telefon' },
  { konto: '6855', bezeichnung: 'Internetkosten' },
  { konto: '6859', bezeichnung: 'Bürobedarf' },
  
  // Kontenklasse 7 - Weitere Erträge/Aufwendungen
  { konto: '7000', bezeichnung: 'Rechts- und Beratungskosten' },
  { konto: '7320', bezeichnung: 'Abschluss- und Prüfungskosten' },
  { konto: '7610', bezeichnung: 'Buchführungskosten' },
  
  // Kontenklasse 9 - Saldo/Statistik
  { konto: '9000', bezeichnung: 'Saldenvorträge Sachkonten' },
  { konto: '9008', bezeichnung: 'Saldenvorträge Debitoren' },
  { konto: '9009', bezeichnung: 'Saldenvorträge Kreditoren' }
]

function analyzeKonto(kontonummer) {
  const klasse = parseInt(kontonummer[0])
  const gruppe = kontonummer.substring(0, 2)
  const untergruppe = kontonummer.substring(0, 3)
  
  const klassenInfo = SKR04_KLASSEN[klasse] || {
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

async function importKontenplan() {
  console.log('🔄 Starte Import von', KONTEN.length, 'Konten (SKR04)...\n')
  
  const client = await MongoClient.connect(MONGO_URL)
  const db = client.db('fibu')
  const collection = db.collection('fibu_kontenplan')
  
  let imported = 0
  let updated = 0
  let errors = 0
  
  for (const kontoData of KONTEN) {
    try {
      const analysis = analyzeKonto(kontoData.konto)
      
      const konto = {
        kontonummer: kontoData.konto,
        bezeichnung: kontoData.bezeichnung,
        ...analysis,
        steuerrelevant: kontoData.bezeichnung.includes('USt') || kontoData.bezeichnung.includes('VSt') || kontoData.bezeichnung.includes('Umsatzsteuer') || kontoData.bezeichnung.includes('Vorsteuer'),
        istAktiv: true,
        istSystemkonto: true, // Alle importierten Konten sind Systemkonten
        updated_at: new Date()
      }
      
      const existing = await collection.findOne({ kontonummer: konto.kontonummer })
      
      if (existing) {
        await collection.updateOne(
          { kontonummer: konto.kontonummer },
          { $set: konto }
        )
        updated++
      } else {
        konto.created_at = new Date()
        await collection.insertOne(konto)
        imported++
      }
      
      console.log(`✅ ${konto.kontonummer} - ${konto.bezeichnung} (${konto.kontenklasseBezeichnung})`)
      
    } catch (error) {
      console.error(`❌ Fehler bei ${kontoData.konto}:`, error.message)
      errors++
    }
  }
  
  await client.close()
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ Import abgeschlossen!')
  console.log(`   Neu angelegt: ${imported}`)
  console.log(`   Aktualisiert: ${updated}`)
  console.log(`   Fehler: ${errors}`)
  console.log(`   Gesamt: ${imported + updated} Konten in DB`)
}

importKontenplan().catch(console.error)
