export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

/**
 * Postbank/Bank CSV Import
 * 
 * POST /api/fibu/bank-import
 * Upload CSV-Datei mit Banktransaktionen
 * 
 * Format: Postbank CSV
 * - Buchungstag, Wertstellung, Buchungstext, Auftraggeber, Verwendungszweck, Betrag, Währung
 * - oder alternative Bank-Formate
 */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'Keine Datei hochgeladen' },
        { status: 400 }
      )
    }
    
    // Dateiinhalt lesen
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const content = buffer.toString('utf-8')
    
    // CSV parsen
    let lines = content.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'CSV-Datei ist leer' },
        { status: 400 }
      )
    }
    
    // Erkenne CSV-Format und finde Header-Zeile
    let format = 'unknown'
    let delimiter = ';'
    let headerIndex = 0
    let header = ''
    
    // Suche nach der Header-Zeile (Postbank hat mehrere Kopfzeilen)
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i]
      
      // Postbank Format (neue Version mit "Buchungstag;Wert;Umsatzart...")
      if (line.includes('Buchungstag') && line.includes('Begünstigter') && line.includes('Verwendungszweck')) {
        format = 'postbank'
        delimiter = ';'
        headerIndex = i
        header = line
        break
      }
      // Alte Postbank Format
      else if (line.includes('Buchungstag') && line.includes('Verwendungszweck')) {
        format = 'postbank'
        delimiter = ';'
        headerIndex = i
        header = line
        break
      }
      // Commerzbank Format
      else if (line.includes('Buchungstag') && line.includes('Umsatzart')) {
        format = 'commerzbank'
        delimiter = ';'
        headerIndex = i
        header = line
        break
      }
    }
    
    if (!header) {
      header = lines[0]
      if (header.includes(',')) {
        delimiter = ','
        format = 'generic'
      }
    }
    
    const headerFields = header.split(delimiter).map(f => f.trim().replace(/"/g, ''))
    
    // Starte Parsing nach Header-Zeile
    lines = lines.slice(headerIndex + 1)
    
    // Transaktionen parsen
    const transaktionen = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const fields = parseCSVLine(line, delimiter)
      
      if (fields.length < headerFields.length - 1) continue // Skip invalide Zeilen
      
      const row: any = {}
      headerFields.forEach((header, index) => {
        row[header] = fields[index] || ''
      })
      
      // Parse basierend auf Format
      let transaktion: any = {}
      
      if (format === 'postbank') {
        const verwendungszweck = row['Verwendungszweck'] || ''
        const auftraggeber = row['Begünstigter / Auftraggeber'] || row['Auftraggeber'] || row['Empfänger'] || ''
        const umsatzart = row['Umsatzart'] || row['Buchungstext'] || ''
        const betrag = parseGermanAmount(row['Betrag'] || row['Soll'] || row['Haben'])
        
        transaktion = {
          datum: parseGermanDate(row['Buchungstag'] || row['Wert'] || row['Wertstellung']),
          verwendungszweck,
          auftraggeber,
          betrag,
          waehrung: row['Währung'] || 'EUR',
          buchungstext: umsatzart,
          iban: row['IBAN / Kontonummer'] || row['IBAN'] || '',
          bic: row['BIC'] || '',
          quelle: 'postbank',
          format: format,
          kategorie: categorizeTransaction(verwendungszweck, auftraggeber, umsatzart, betrag)
        }
      } else if (format === 'commerzbank') {
        transaktion = {
          datum: parseGermanDate(row['Buchungstag'] || row['Wertstellung']),
          verwendungszweck: row['Verwendungszweck'] || row['Vorgang/Verwendungszweck'] || '',
          auftraggeber: row['Auftraggeber/Zahlungsempfänger'] || '',
          betrag: parseGermanAmount(row['Betrag'] || row['Umsatz in EUR']),
          waehrung: 'EUR',
          buchungstext: row['Umsatzart'] || '',
          quelle: 'Commerzbank',
          format: format
        }
      } else {
        // Generischer Versuch
        transaktion = {
          datum: new Date(),
          verwendungszweck: fields.join(' '),
          auftraggeber: '',
          betrag: 0,
          waehrung: 'EUR',
          buchungstext: '',
          quelle: 'Unbekannt',
          format: format
        }
      }
      
      // Auto-Matching: Suche nach Rechnungsnummer im Verwendungszweck
      transaktion.matchedRechnungNr = extractRechnungsnummer(transaktion.verwendungszweck)
      transaktion.matchedBestellNr = extractBestellnummer(transaktion.verwendungszweck)
      
      transaktionen.push(transaktion)
    }
    
    // Speichere in MongoDB
    const db = await getDb()
    const collection = db.collection('fibu_bank_transaktionen')
    
    let imported = 0
    for (const transaktion of transaktionen) {
      const uniqueKey = `${transaktion.quelle}_${transaktion.datum.toISOString()}_${transaktion.betrag}_${transaktion.verwendungszweck.substring(0, 50)}`
      
      const result = await collection.updateOne(
        { uniqueKey },
        {
          $set: {
            ...transaktion,
            uniqueKey,
            updated_at: new Date()
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
      
      if (result.upsertedCount > 0) imported++
    }
    
    return NextResponse.json({
      ok: true,
      imported,
      total: transaktionen.length,
      format: format,
      transaktionen: transaktionen.slice(0, 10) // Zeige erste 10
    })
    
  } catch (error: any) {
    console.error('Fehler beim Bank-Import:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper: Parse CSV Zeile mit Delimiter
function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  fields.push(current.trim())
  return fields
}

// Helper: Parse deutsches Datum (dd.mm.yyyy)
function parseGermanDate(dateStr: string): Date {
  const parts = dateStr.split('.')
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    return new Date(year, month, day)
  }
  return new Date()
}

// Helper: Parse deutscher Betrag (1.234,56 → 1234.56)
function parseGermanAmount(amountStr: string): number {
  const cleaned = amountStr.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  return parseFloat(cleaned) || 0
}

// Helper: Extrahiere Rechnungsnummer (RE2025-XXXXX, XRE-XXXXX)
function extractRechnungsnummer(text: string): string | null {
  const patterns = [
    /RE\d{4}-\d+/g,
    /XRE-\d+/g,
    /GU\d{4}-\d+/g
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[0]
  }
  
  return null
}

// Helper: Extrahiere Bestellnummer (AU_XXXXX, AU-XXXXX)
function extractBestellnummer(text: string): string | null {
  const patterns = [
    /AU[_-]\d+/g,
    /AU\d{4}-\d+/g
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[0]
  }
  
  return null
}

// Helper: Kategorisiere Transaktion automatisch
function categorizeTransaction(verwendungszweck: string, auftraggeber: string, umsatzart: string, betrag: number): string {
  const text = `${verwendungszweck} ${auftraggeber} ${umsatzart}`.toLowerCase()
  
  // Gehälter (negative Beträge)
  if (betrag < 0) {
    // Mitarbeiter-Namen erkennen
    if (text.includes('waller') || text.includes('angelika') || text.includes('dorothee')) {
      return 'gehalt'
    }
    
    // Steuer & Abgaben
    if (text.includes('steuerverwaltung') || text.includes('lohnsteuer') || text.includes('umsatzsteuer')) {
      return 'steuern'
    }
    
    // Versand & Logistik
    if (text.includes('deutsche post') || text.includes('dhl') || text.includes('paket')) {
      return 'versand'
    }
    
    // Payment Provider Gebühren
    if (text.includes('paypal') && text.includes('gebühr')) {
      return 'gebühren_payment'
    }
    
    // Sonstige Dienstleistungen
    if (text.includes('trustami') || text.includes('rechnung')) {
      return 'dienstleistung'
    }
  }
  
  // Einnahmen (positive Beträge)
  if (betrag > 0) {
    if (text.includes('ebay')) {
      return 'einnahme_ebay'
    }
    if (text.includes('paypal') && !text.includes('gebühr')) {
      return 'einnahme_paypal'
    }
    if (text.includes('amazon')) {
      return 'einnahme_amazon'
    }
  }
  
  return betrag < 0 ? 'ausgabe_sonstige' : 'einnahme_sonstige'
}

// GET: Liste importierte Bank-Transaktionen
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    
    const db = await getDb()
    const collection = db.collection('fibu_bank_transaktionen')
    
    const transaktionen = await collection.find({
      datum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      }
    }).sort({ datum: -1 }).limit(limit).toArray()
    
    return NextResponse.json({
      ok: true,
      transaktionen,
      total: transaktionen.length
    })
    
  } catch (error: any) {
    console.error('Fehler beim Laden der Bank-Transaktionen:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
