export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { 
  Booking10it, 
  generate10itCSV, 
  getSteuersatz, 
  getSteuerkonto,
  formatDateGerman
} from '../../../../lib/export-utils'

/**
 * GET /api/fibu/export/10it
 * Exportiert Buchungsdaten im 10it-Format
 * 
 * Query-Parameter:
 * - from: Startdatum (YYYY-MM-DD)
 * - to: Enddatum (YYYY-MM-DD)
 * - type: Export-Typ ('alle', 'vk', 'ek') - optional
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-01-31'
    const type = searchParams.get('type') || 'alle'  // 'alle', 'vk', 'ek'
    
    const startDate = new Date(from)
    const endDate = new Date(to + 'T23:59:59.999Z')
    
    // Hole Kontenplan aus MongoDB für Bezeichnungen
    const db = await getDb()
    const kontenplanCollection = db.collection('kontenplan')
    const kontenplan = await kontenplanCollection.find({}).toArray()
    
    // Erstelle Map für schnellen Zugriff
    const kontoMap = new Map<string, string>()
    kontenplan.forEach((k: any) => {
      kontoMap.set(k.kontonummer, k.bezeichnung || '')
    })
    
    // Funktion zum Holen der Kontobezeichnung
    const getBezeichnung = (kontonummer: string): string => {
      return kontoMap.get(kontonummer) || `Konto ${kontonummer}`
    }
    
    const bookings: Booking10it[] = []
    
    // ========================================
    // 1. VK-RECHNUNGEN (Verkaufsrechnungen)
    // ========================================
    let vkRechnungen: any[] = []
    if (type === 'alle' || type === 'vk') {
      const vkRechnungenCol = db.collection('fibu_vk_rechnungen')
      vkRechnungen = await vkRechnungenCol.find({
        rechnungsdatum: {
          $gte: startDate,
          $lt: endDate
        }
      }).toArray()
    }
    
    for (const rechnung of vkRechnungen) {
      const brutto = rechnung.brutto || 0
      const netto = rechnung.netto || 0
      const mwst = rechnung.mwst || 0
      const mwstSatz = rechnung.mwstSatz || 19
      const steuersatz = getSteuersatz(mwstSatz)
      
      // Debitorenkonto (z.B. 69018, 69002, etc.)
      const debitorKonto = rechnung.debitorKonto || '69015'
      
      // Sachkonto (Erlöskonto, z.B. 4400)
      const sachkonto = rechnung.sachkonto || '4400'
      
      // Buchung: Debitor an Erlöskonto
      // SOLL: Debitorenkonto (Forderung steigt)
      // HABEN: Erlöskonto (Umsatz)
      bookings.push({
        konto: '1200',  // Forderungen aus Lieferungen und Leistungen
        kontobezeichnung: 'Forderungen aus Lieferungen und Leistungen',
        datum: new Date(rechnung.rechnungsdatum),
        belegnummer: rechnung.cBestellNr || rechnung.cRechnungsNr || String(rechnung.kRechnung),
        text: `${rechnung.cRechnungsNr} - ${rechnung.kundenLand || 'DE'}`,
        gegenkonto: sachkonto,
        soll: brutto,
        haben: 0,
        steuer: steuersatz,
        steuerkonto: getSteuerkonto(steuersatz, false)
      })
    }
    
    // ========================================
    // 2. VK-ZAHLUNGEN (Zahlungseingänge)
    // ========================================
    const zahlungenCol = db.collection('fibu_zahlungen')
    const zahlungen = await zahlungenCol.find({
      zahlungsdatum: {
        $gte: startDate,
        $lt: endDate
      }
    }).toArray()
    
    for (const zahlung of zahlungen) {
      const betrag = zahlung.betrag || 0
      const rechnungsNr = zahlung.rechnungsNr || 'unbekannt'
      
      // Finde zugehörige Rechnung für Debitorenkonto
      const rechnung = vkRechnungen.find((r: any) => r.kRechnung === zahlung.kRechnung)
      const debitorKonto = rechnung?.debitorKonto || '69015'
      
      // Belegnummer im Format AU-XXXXX-S generieren
      const belegnummer = `AU-${zahlung.kZahlung}-S`
      
      // Buchung: Bank an Debitor
      // SOLL: (leer, wird in HABEN gebucht)
      // HABEN: Forderung sinkt
      bookings.push({
        konto: '1200',  // Forderungen
        kontobezeichnung: 'Forderungen aus Lieferungen und Leistungen',
        datum: new Date(zahlung.zahlungsdatum),
        belegnummer: belegnummer,
        text: `Zahlungseing.: ${rechnungsNr} - DE`,
        gegenkonto: debitorKonto,
        soll: 0,
        haben: betrag,
        steuer: 0,
        steuerkonto: ''
      })
    }
    
    // ========================================
    // 3. EXTERNE RECHNUNGEN (Amazon VCS-Lite etc.)
    // ========================================
    const externeRechnungenCol = db.collection('fibu_externe_rechnungen')
    const externeRechnungen = await externeRechnungenCol.find({
      belegdatum: {
        $gte: startDate,
        $lt: endDate
      }
    }).toArray()
    
    for (const rechnung of externeRechnungen) {
      const brutto = rechnung.brutto || 0
      const netto = rechnung.netto || 0
      const steuer = rechnung.steuer || 0
      const mwstSatz = rechnung.mwstSatz || 19
      const steuersatz = getSteuersatz(mwstSatz)
      
      // Externe Rechnungen = Amazon → Debitorenkonto 69002 (Amazon)
      const debitorKonto = '69002'
      const sachkonto = '4400'  // Erlöse Waren
      
      // Buchung: Forderung an Erlös
      bookings.push({
        konto: '1200',
        kontobezeichnung: 'Forderungen aus Lieferungen und Leistungen',
        datum: new Date(rechnung.belegdatum),
        belegnummer: rechnung.belegnummer || `EXT-${rechnung.kExternerBeleg}`,
        text: `${rechnung.belegnummer} (${rechnung.herkunft}) - ${rechnung.kundenLand || 'DE'}`,
        gegenkonto: sachkonto,
        soll: brutto,
        haben: 0,
        steuer: steuersatz,
        steuerkonto: getSteuerkonto(steuersatz, false)
      })
    }
    
    // ========================================
    // 4. GUTSCHRIFTEN (negative Rechnungen)
    // ========================================
    const gutschriftenCol = db.collection('fibu_gutschriften')
    const gutschriften = await gutschriftenCol.find({
      belegdatum: {
        $gte: startDate,
        $lt: endDate
      }
    }).toArray()
    
    for (const gutschrift of gutschriften) {
      // Beträge sind bereits negativ
      const brutto = gutschrift.brutto || 0  // z.B. -100
      const netto = gutschrift.netto || 0
      const mwst = gutschrift.mwst || 0
      const mwstSatz = gutschrift.mwstSatz || 19
      const steuersatz = getSteuersatz(mwstSatz)
      
      const debitorKonto = '69015'  // Standard-Debitor
      const sachkonto = '4400'
      
      // Gutschrift = STORNO der Rechnung
      // HABEN: Forderung sinkt (negative Buchung)
      // SOLL: Erlös sinkt
      bookings.push({
        konto: '1200',
        kontobezeichnung: 'Forderungen aus Lieferungen und Leistungen',
        datum: new Date(gutschrift.belegdatum),
        belegnummer: gutschrift.belegnummer || `GU-${gutschrift.kGutschrift}`,
        text: `Gutschrift ${gutschrift.originalRechnungNr || ''} - DE`,
        gegenkonto: sachkonto,
        soll: 0,
        haben: Math.abs(brutto),  // Positiver Wert im HABEN
        steuer: steuersatz,
        steuerkonto: getSteuerkonto(steuersatz, false)
      })
    }
    
    // ========================================
    // 5. EK-RECHNUNGEN (Lieferantenrechnungen)
    // ========================================
    const ekRechnungenCol = db.collection('fibu_ek_rechnungen')
    const ekRechnungen = await ekRechnungenCol.find({
      rechnungsdatum: {
        $gte: startDate,
        $lt: endDate
      }
    }).toArray()
    
    for (const rechnung of ekRechnungen) {
      // Nur wenn Kreditorenkonto vorhanden
      if (!rechnung.kreditorKonto) continue
      
      const brutto = rechnung.gesamtBetrag || rechnung.betrag || 0
      const netto = rechnung.nettoBetrag || (brutto / 1.19)
      const mwst = brutto - netto
      const steuersatz = rechnung.steuersatz || 19
      
      const kreditorKonto = rechnung.kreditorKonto
      const aufwandskonto = rechnung.aufwandskonto || '5200'
      const lieferantName = rechnung.lieferantName || 'Lieferant'
      
      // Buchung: Aufwand an Kreditor
      // SOLL: (leer)
      // HABEN: Verbindlichkeit steigt
      bookings.push({
        konto: kreditorKonto,
        kontobezeichnung: lieferantName,
        datum: new Date(rechnung.rechnungsdatum),
        belegnummer: rechnung.rechnungsNummer || String(rechnung._id),
        text: `${lieferantName} ${rechnung.beschreibung || 'Wareneinkauf'}`,
        gegenkonto: aufwandskonto,
        soll: 0,
        haben: brutto,
        steuer: steuersatz,
        steuerkonto: getSteuerkonto(steuersatz, true)
      })
    }
    
    // Sortiere nach Datum
    bookings.sort((a, b) => a.datum.getTime() - b.datum.getTime())
    
    // Generiere CSV
    const csv = generate10itCSV(bookings)
    
    // Dateiname
    const filename = `Export_Konten_von_${from}_bis_${to}.csv`
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error: any) {
    console.error('[10it Export] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
