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
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-01-31'
    
    const startDate = new Date(from)
    const endDate = new Date(to)
    
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
    const vkRechnungenCol = db.collection('fibu_vk_rechnungen')
    const vkRechnungen = await vkRechnungenCol.find({
      rechnungsdatum: {
        $gte: startDate,
        $lt: endDate
      }
    }).toArray()
    
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
        belegnummer: rechnung.kBestellung || rechnung.cRechnungsNr || String(rechnung.kRechnung),
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
    // 3. EK-RECHNUNGEN (Lieferantenrechnungen)
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
