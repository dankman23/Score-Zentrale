/**
 * Kontenplan-Utilities
 * Funktionen zum Parsen und Verarbeiten von Kontenplan-Excel-Dateien
 */

import * as XLSX from 'xlsx'

/**
 * Bestimmt die Kontenklasse basierend auf der ersten Ziffer der Kontonummer
 * @param kontoNummer Kontonummer als String
 * @returns Kontenklasse (0-9) oder null
 */
export function getKontenklasse(kontoNummer: string): number | null {
  if (!kontoNummer) return null
  
  // Extrahiere erste Ziffer (auch bei Formaten wie "404-1864434-1397940")
  const firstDigit = kontoNummer.toString().replace(/[^0-9]/g, '')[0]
  
  if (!firstDigit) return null
  
  return parseInt(firstDigit, 10)
}

/**
 * Gibt den Namen der Kontenklasse zurück
 * @param klasse Kontenklasse (0-9)
 * @returns Name der Kontenklasse
 */
export function getKontenklasseName(klasse: number | null): string {
  if (klasse === null) return 'Unbekannt'
  
  const namen: { [key: number]: string } = {
    0: 'Anlagevermögen',
    1: 'Umlaufvermögen',
    2: 'Eigenkapital / Verbindlichkeiten',
    3: 'Bestandskonten',
    4: 'Betriebliche Aufwendungen',
    5: 'Betriebliche Erträge',
    6: 'Weitere Aufwendungen',
    7: 'Weitere Erträge',
    8: 'Ergebnisrechnungen',
    9: 'Abschlusskonten'
  }
  
  return namen[klasse] || 'Sonstiges'
}

/**
 * Parst eine Excel-Datei und extrahiert den Kontenplan
 * @param buffer Excel-Datei als Buffer oder ArrayBuffer
 * @returns Array mit Kontoinformationen
 */
export function parseKontenplanExcel(buffer: ArrayBuffer): any[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
    
    const konten: any[] = []
    const seenKonten = new Set<string>()
    
    // Durchsuche alle Zeilen nach Kontonummern und Bezeichnungen
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any[]
      
      // Versuche Konto und Bezeichnung zu finden
      // Annahme: Erste Spalte könnte Kontonummer sein, zweite Bezeichnung
      if (row.length >= 2) {
        const potKonto = row[0]?.toString().trim()
        const potBez = row[1]?.toString().trim()
        
        // Prüfe ob es wie eine Kontonummer aussieht
        if (potKonto && potKonto.length > 0 && /[0-9]/.test(potKonto)) {
          if (potBez && potBez.length > 0 && !seenKonten.has(potKonto)) {
            seenKonten.add(potKonto)
            
            const klasse = getKontenklasse(potKonto)
            
            konten.push({
              konto: potKonto,
              bezeichnung: potBez,
              kontenklasse: klasse,
              kontenklasseName: getKontenklasseName(klasse),
              typ: getKontenklasseName(klasse)
            })
          }
        }
      }
      
      // Auch prüfen ob in einer Zeile "Kontobezeichnung" vorkommt
      // und nächste Spalte die Bezeichnung ist
      for (let col = 0; col < row.length - 1; col++) {
        const cell = row[col]?.toString().trim()
        if (cell && /^[0-9]/.test(cell) && cell.length <= 20) {
          const bez = row[col + 1]?.toString().trim()
          if (bez && bez.length > 3 && bez.length < 200) {
            if (!seenKonten.has(cell)) {
              seenKonten.add(cell)
              
              const klasse = getKontenklasse(cell)
              
              konten.push({
                konto: cell,
                bezeichnung: bez,
                kontenklasse: klasse,
                kontenklasseName: getKontenklasseName(klasse),
                typ: getKontenklasseName(klasse)
              })
            }
          }
        }
      }
    }
    
    // Deduplizierung basierend auf Kontonummer
    const uniqueKonten = Array.from(
      new Map(konten.map(k => [k.konto, k])).values()
    )
    
    return uniqueKonten
  } catch (error) {
    console.error('Fehler beim Parsen der Excel:', error)
    throw new Error('Excel-Datei konnte nicht gelesen werden')
  }
}

/**
 * Validiert ein Konto-Objekt
 * @param konto Konto-Objekt
 * @returns true wenn valide
 */
export function validateKonto(konto: any): boolean {
  if (!konto.konto || konto.konto.trim().length === 0) return false
  if (!konto.bezeichnung || konto.bezeichnung.trim().length === 0) return false
  return true
}
