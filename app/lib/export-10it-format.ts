/**
 * 10it Export Format
 * Basiert auf der Analyse der tatsächlichen 10it Excel-Datei
 * 
 * Genutzte Spalten (11 von 124):
 * 1. Umsatz (ohne Soll/Haben-Kz)
 * 2. Soll/Haben-Kennzeichen
 * 3. Konto
 * 4. Gegenkonto (ohne BU-Schlüssel)
 * 5. BU-Schlüssel
 * 6. Belegdatum
 * 7. Belegfeld 2
 * 8. Buchungstext
 * 9. Beteiligtennummer
 * 10. Festschreibung
 * 11. Generalumkehr
 */

export interface Booking10itFormat {
  umsatz: string  // Format: "1234,56" (deutsche Zahlenformatierung)
  sollHaben: string // "S" oder "H"
  konto: string  // z.B. "5425", "6837"
  gegenkonto: string  // z.B. "70040", "70003"
  buSchluessel: string  // z.B. "9"
  belegdatum: string  // Format: "MMDD" z.B. "0101" für 01.01.
  belegfeld2: string  // Belegnummer/Referenz
  buchungstext: string  // Beschreibung
  beteiligtennummer: string  // Meist "2"
  festschreibung: string  // Meist "1"
  generalumkehr: string  // Meist "0"
}

/**
 * Formatiert einen Betrag für 10it (deutsches Format mit Komma)
 */
export function formatBetrag(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',')
}

/**
 * Formatiert ein Datum für 10it (MMDD)
 */
export function formatDatum10it(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return month + day
}

/**
 * Ermittelt BU-Schlüssel basierend auf Steuersatz
 * 9 = Keine Steuer / Steuerfreie Umsätze
 * 3 = 19% Umsatzsteuer
 * Weitere werden bei Bedarf ergänzt
 */
export function getBUSchluessel(steuersatz: number): string {
  if (steuersatz === 0) return '9'
  if (steuersatz === 19) return '3'
  if (steuersatz === 7) return '2'
  return '9'
}

/**
 * Erstellt eine 10it-Buchung aus einer EK-Rechnung
 */
export function createEKBuchung(rechnung: any, kontenplan: Map<string, string>): Booking10itFormat[] {
  const buchungen: Booking10itFormat[] = []
  
  const brutto = rechnung.gesamtBetrag || 0
  const netto = rechnung.nettoBetrag || 0
  const steuer = rechnung.steuerBetrag || 0
  const steuersatz = rechnung.steuersatz || 19
  
  // Aufwandskonto (z.B. 5425, 6855)
  const aufwandskonto = rechnung.aufwandskonto || '5425'
  
  // Kreditorenkonto (z.B. 70040, 69012)
  const kreditorKonto = rechnung.kreditorKonto || '70040'
  
  // Belegdatum
  const belegdatum = formatDatum10it(new Date(rechnung.rechnungsdatum))
  
  // Buchungstext
  const buchungstext = rechnung.buchungstext || 
                       `${rechnung.lieferantName} - ${rechnung.rechnungsNummer}`.substring(0, 60)
  
  // Hauptbuchung: Aufwand an Verbindlichkeit
  buchungen.push({
    umsatz: formatBetrag(brutto),
    sollHaben: 'S',  // SOLL: Aufwand steigt
    konto: aufwandskonto,
    gegenkonto: kreditorKonto,
    buSchluessel: getBUSchluessel(steuersatz),
    belegdatum: belegdatum,
    belegfeld2: rechnung.rechnungsNummer || '',
    buchungstext: buchungstext,
    beteiligtennummer: '2',
    festschreibung: '1',
    generalumkehr: '0'
  })
  
  return buchungen
}

/**
 * Erstellt eine 10it-Buchung aus einer VK-Rechnung
 */
export function createVKBuchung(rechnung: any, kontenplan: Map<string, string>): Booking10itFormat[] {
  const buchungen: Booking10itFormat[] = []
  
  const brutto = rechnung.betrag || rechnung.brutto || 0
  const netto = rechnung.netto || 0
  const steuer = rechnung.mwst || 0
  const steuersatz = rechnung.mwstSatz || 19
  
  // Erlöskonto (z.B. 4400, 4639)
  const erlöskonto = rechnung.sachkonto || '4400'
  
  // Debitorenkonto (z.B. 70003, 69018)
  const debitorKonto = rechnung.debitor || '70003'
  
  // Belegdatum
  const belegdatum = formatDatum10it(new Date(rechnung.datum || rechnung.rechnungsdatum))
  
  // Buchungstext
  const buchungstext = `${rechnung.rechnungsNr || rechnung.cRechnungsNr} - ${rechnung.kunde || 'Kunde'}`.substring(0, 60)
  
  // Hauptbuchung: Forderung an Erlös
  buchungen.push({
    umsatz: formatBetrag(brutto),
    sollHaben: 'H',  // HABEN: Erlös steigt (aber wir buchen die Forderung auf SOLL)
    konto: debitorKonto,
    gegenkonto: erlöskonto,
    buSchluessel: getBUSchluessel(steuersatz),
    belegdatum: belegdatum,
    belegfeld2: rechnung.rechnungsNr || rechnung.cRechnungsNr || '',
    buchungstext: buchungstext,
    beteiligtennummer: '2',
    festschreibung: '1',
    generalumkehr: '0'
  })
  
  return buchungen
}

/**
 * Generiert CSV im 10it-Format
 * 
 * WICHTIG: Die CSV hat 124 Spalten, aber nur 11 werden mit Daten gefüllt.
 * Die restlichen 113 Spalten sind leer.
 */
export function generate10itCSV(buchungen: Booking10itFormat[]): string {
  const rows: string[] = []
  
  // Zeile 1: DATEV-Header (Metadaten)
  const metaRow = [
    'EXTF',  // Spalte 1: Kennung
    '510',   // Spalte 2: Versionsnummer
    '21',    // Spalte 3: Formatkennung
    'Buchungsstapel',  // Spalte 4: Formatname
    '9',     // Spalte 5: Formatversion
    new Date().toISOString().split('T')[0],  // Spalte 6: Erstellungsdatum
    '',      // Spalte 7: Importiert
    'Score',  // Spalte 8: Name
    '',      // Spalte 9: Berater
    '',      // Spalte 10: Mandant
    '2025',  // Spalte 11: Wirtschaftsjahr
    '1',     // Spalte 12: WJ-Beginn
    '12',    // Spalte 13: WJ-Ende
    '',      // Spalte 14-124: Leer
    ...Array(111).fill('')
  ]
  rows.push(metaRow.join(';'))
  
  // Zeile 2: Spalten-Header
  const headerRow = [
    'Umsatz (ohne Soll/Haben-Kz)',  // Spalte 1
    'Soll/Haben-Kennzeichen',        // Spalte 2
    'WKZ Umsatz',                    // Spalte 3
    'Kurs',                          // Spalte 4
    'Basis-Umsatz',                  // Spalte 5
    'WKZ Basis-Umsatz',              // Spalte 6
    'Konto',                         // Spalte 7
    'Gegenkonto (ohne BU-Schlüssel)', // Spalte 8
    'BU-Schlüssel',                  // Spalte 9
    'Belegdatum',                    // Spalte 10
    'Belegfeld 1',                   // Spalte 11
    'Belegfeld 2',                   // Spalte 12
    'Skonto',                        // Spalte 13
    'Buchungstext',                  // Spalte 14
    ...Array(110).fill('')  // Restliche Spalten (leer)
  ]
  rows.push(headerRow.join(';'))
  
  // Datenzeilen
  for (const buchung of buchungen) {
    const dataRow = [
      buchung.umsatz,           // Spalte 1
      buchung.sollHaben,        // Spalte 2
      '',                       // Spalte 3: WKZ Umsatz (leer)
      '',                       // Spalte 4: Kurs (leer)
      '',                       // Spalte 5: Basis-Umsatz (leer)
      '',                       // Spalte 6: WKZ Basis-Umsatz (leer)
      buchung.konto,            // Spalte 7
      buchung.gegenkonto,       // Spalte 8
      buchung.buSchluessel,     // Spalte 9
      buchung.belegdatum,       // Spalte 10
      '',                       // Spalte 11: Belegfeld 1 (leer)
      buchung.belegfeld2,       // Spalte 12
      '',                       // Spalte 13: Skonto (leer)
      buchung.buchungstext,     // Spalte 14
      ...Array(110).fill('')  // Restliche Spalten (leer)
    ]
    rows.push(dataRow.join(';'))
  }
  
  return rows.join('\n')
}

/**
 * Validiert ob eine Rechnung ein Kosten- oder Erlöskonto hat
 */
export function validateKontoZuordnung(rechnung: any, typ: 'ek' | 'vk'): { valid: boolean, errors: string[] } {
  const errors: string[] = []
  
  if (typ === 'ek') {
    // EK-Rechnung muss Aufwandskonto (5xxx/6xxx/7xxx) haben
    if (!rechnung.aufwandskonto) {
      errors.push(`EK-Rechnung ${rechnung.rechnungsNummer}: Fehlendes Aufwandskonto`)
    } else {
      const firstDigit = rechnung.aufwandskonto.toString()[0]
      if (!['5', '6', '7'].includes(firstDigit)) {
        errors.push(`EK-Rechnung ${rechnung.rechnungsNummer}: Aufwandskonto ${rechnung.aufwandskonto} ist ungültig (muss mit 5, 6 oder 7 beginnen)`)
      }
    }
  }
  
  if (typ === 'vk') {
    // VK-Rechnung muss Erlöskonto (4xxx) haben
    if (!rechnung.sachkonto) {
      errors.push(`VK-Rechnung ${rechnung.rechnungsNr || rechnung.cRechnungsNr}: Fehlendes Erlöskonto`)
    } else {
      const firstDigit = rechnung.sachkonto.toString()[0]
      if (firstDigit !== '4') {
        errors.push(`VK-Rechnung ${rechnung.rechnungsNr || rechnung.cRechnungsNr}: Erlöskonto ${rechnung.sachkonto} ist ungültig (muss mit 4 beginnen)`)
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}
