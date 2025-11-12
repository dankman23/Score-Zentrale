/**
 * Export-Utilities für 10it
 * Formatierungs- und Konvertierungsfunktionen für den CSV-Export
 */

export interface Booking10it {
  konto: string
  kontobezeichnung: string
  datum: Date
  belegnummer: string
  text: string
  gegenkonto: string
  soll: number
  haben: number
  steuer: number
  steuerkonto: string
}

/**
 * Formatiert ein Datum im deutschen Format DD.MM.YYYY
 */
export function formatDateGerman(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Formatiert einen Betrag im deutschen Format (Komma als Dezimaltrenner)
 */
export function formatAmountGerman(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}

/**
 * Escapet einen String für CSV (Anführungszeichen verdoppeln)
 */
function escapeCSV(str: string): string {
  if (str === null || str === undefined) return ''
  return String(str).replace(/"/g, '""')
}

/**
 * Generiert CSV-Zeile im 10it-Format
 */
function generateCSVRow(booking: Booking10it): string {
  const fields = [
    booking.konto,
    booking.kontobezeichnung,
    formatDateGerman(booking.datum),
    booking.belegnummer,
    booking.text,
    booking.gegenkonto,
    formatAmountGerman(booking.soll),
    formatAmountGerman(booking.haben),
    formatAmountGerman(booking.steuer),
    booking.steuerkonto || ''
  ]
  
  // Alle Felder in Anführungszeichen setzen
  return fields.map(f => `"${escapeCSV(String(f))}"`).join(';')
}

/**
 * Generiert vollständige CSV-Datei im 10it-Format
 */
export function generate10itCSV(bookings: Booking10it[]): string {
  // UTF-8 BOM für korrekte Anzeige in Excel
  let csv = '\ufeff'
  
  // Header-Zeile
  const header = [
    'Konto',
    'Kontobezeichnung',
    'Datum',
    'Belegnummer',
    'Text',
    'Gegenkonto',
    'Soll',
    'Haben',
    'Steuer',
    'Steuerkonto'
  ]
  csv += header.map(h => `"${h}"`).join(';') + '\n'
  
  // Datenzeilen
  bookings.forEach(booking => {
    csv += generateCSVRow(booking) + '\n'
  })
  
  return csv
}

/**
 * Bestimmt Steuersatz aus MwSt-Satz
 */
export function getSteuersatz(mwstSatz: number): number {
  // Runde auf bekannte Steuersätze
  if (mwstSatz < 3) return 0
  if (mwstSatz >= 6 && mwstSatz <= 8) return 7
  if (mwstSatz >= 18 && mwstSatz <= 20) return 19
  return Math.round(mwstSatz)
}

/**
 * Bestimmt Steuerkonto basierend auf Steuersatz
 */
export function getSteuerkonto(steuersatz: number, istVorsteuer: boolean = false): string {
  if (steuersatz === 0) return ''
  
  if (istVorsteuer) {
    // Vorsteuer (Einkauf)
    if (steuersatz === 19) return '1406'
    if (steuersatz === 7) return '1401'
    return ''
  } else {
    // Umsatzsteuer (Verkauf)
    if (steuersatz === 19) return '3806'
    if (steuersatz === 7) return '3801'
    return ''
  }
}

/**
 * Holt Kontobezeichnung aus Kontenplan
 */
export async function getKontobezeichnung(
  kontonummer: string,
  kontenplan: any[]
): Promise<string> {
  const konto = kontenplan.find(k => k.kontonummer === kontonummer)
  return konto ? konto.bezeichnung : `Konto ${kontonummer}`
}
