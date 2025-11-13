export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import multer from 'multer'
import { Readable } from 'stream'

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

const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
})

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
    const lines = content.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'CSV-Datei ist leer' },
        { status: 400 }
      )
    }
    
    // Erkenne CSV-Format
    const header = lines[0]
    let format = 'unknown'
    let delimiter = ';'
    
    // Postbank Format erkennen
    if (header.includes('Buchungstag') && header.includes('Verwendungszweck')) {
      format = 'postbank'
      delimiter = ';'
    } 
    // Commerzbank Format
    else if (header.includes('Buchungstag') && header.includes('Umsatzart')) {
      format = 'commerzbank'
      delimiter = ';'
    }
    // Generisches CSV
    else if (header.includes(',')) {
      delimiter = ','
      format = 'generic'
    }
    
    const headerFields = header.split(delimiter).map(f => f.trim().replace(/"/g, ''))
    
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
        transaktion = {
          datum: parseGermanDate(row['Buchungstag'] || row['Wertstellung']),
          verwendungszweck: row['Verwendungszweck'] || '',
          auftraggeber: row['Auftraggeber'] || row['Empfänger'] || '',
          betrag: parseGermanAmount(row['Betrag']),
          waehrung: row['Währung'] || 'EUR',
          buchungstext: row['Buchungstext'] || '',
          quelle: 'Postbank',
          format: format
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
