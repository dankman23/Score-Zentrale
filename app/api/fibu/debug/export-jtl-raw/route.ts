import { NextRequest, NextResponse } from 'next/server'
import { fetchAmazonSettlementsFromJTL } from '@/lib/fibu/amazon-import-v2'

export const runtime = 'nodejs'
export const maxDuration = 180

/**
 * Debug-Endpunkt: Exportiert JTL-Rohdaten zur Analyse
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const limit = parseInt(searchParams.get('limit') || '100')
    
    console.log(`[JTL Raw Export] Hole Daten von ${from} bis ${to}, max ${limit} Zeilen`)
    
    // Hole Rohdaten
    const rawData = await fetchAmazonSettlementsFromJTL(from, to)
    
    // Gruppiere nach TransactionType
    const grouped = new Map<string, any[]>()
    
    rawData.slice(0, limit).forEach(row => {
      const key = `${row.TransactionType || '(leer)'}_${row.AmountType || '(leer)'}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push({
        TransactionType: row.TransactionType || '(leer)',
        AmountType: row.AmountType || '(leer)',
        AmountDescription: row.AmountDescription || '(leer)',
        OrderID: row.OrderID || '(leer)',
        Amount: row.Amount,
        PostedDateTime: row.PostedDateTime,
        MerchantOrderID: row.MerchantOrderID || '(leer)'
      })
    })
    
    // Erstelle Zusammenfassung
    const summary = Array.from(grouped.entries()).map(([key, rows]) => ({
      kombination: key,
      anzahl_in_sample: rows.length,
      beispiele: rows.slice(0, 3)
    }))
    
    // Finde alle einzigartigen Kombinationen
    const uniqueCombos = new Set<string>()
    rawData.forEach(row => {
      uniqueCombos.add(`${row.TransactionType || 'NULL'}|${row.AmountType || 'NULL'}|${row.AmountDescription || 'NULL'}`)
    })
    
    return NextResponse.json({
      ok: true,
      zeitraum: { from, to },
      gesamt_zeilen: rawData.length,
      sample_size: Math.min(limit, rawData.length),
      einzigartige_kombinationen: Array.from(uniqueCombos).sort(),
      gruppiert_nach_type: summary,
      rohdaten_sample: rawData.slice(0, 20).map(r => ({
        TransactionType: r.TransactionType || 'NULL',
        AmountType: r.AmountType || 'NULL',
        AmountDescription: r.AmountDescription || 'NULL',
        OrderID: r.OrderID || 'NULL',
        MerchantOrderID: r.MerchantOrderID || 'NULL',
        Amount: r.Amount,
        PostedDateTime: r.PostedDateTime
      }))
    })
    
  } catch (error: any) {
    console.error('[JTL Raw Export] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
