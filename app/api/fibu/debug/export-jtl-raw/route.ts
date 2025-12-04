import { NextRequest, NextResponse } from 'next/server'
import { fetchAmazonSettlementsFromJTL } from '@/lib/fibu/amazon-import-v2'

export const runtime = 'nodejs'
export const maxDuration = 180

/**
 * Debug-Endpunkt: Exportiert JTL-Rohdaten zur Analyse
 * Format: ?format=csv für CSV-Export, sonst JSON
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const format = searchParams.get('format') || 'json'
    const limit = parseInt(searchParams.get('limit') || '0')
    
    console.log(`[JTL Raw Export] Hole Daten von ${from} bis ${to}, Format: ${format}`)
    
    // Hole Rohdaten
    const rawData = await fetchAmazonSettlementsFromJTL(from, to)
    const dataToExport = limit > 0 ? rawData.slice(0, limit) : rawData
    
    console.log(`[JTL Raw Export] ${rawData.length} Zeilen geladen, exportiere ${dataToExport.length}`)
    
    // CSV-Export
    if (format === 'csv') {
      const csvRows: string[] = []
      
      // Header
      csvRows.push([
        'kMessageId',
        'PostedDateTime',
        'TransactionType',
        'OrderID',
        'MerchantOrderID',
        'AmountType',
        'AmountDescription',
        'Amount',
        'QuantityPurchased',
        'SellerSKU',
        'MarketplaceName',
        'SettlementID'
      ].join(';'))
      
      // Daten
      dataToExport.forEach(row => {
        csvRows.push([
          row.kMessageId || '',
          row.PostedDateTime || '',
          row.TransactionType || '',
          row.OrderID || '',
          row.MerchantOrderID || '',
          row.AmountType || '',
          row.AmountDescription || '',
          row.Amount || 0,
          row.QuantityPurchased || '',
          row.SellerSKU || '',
          row.MarketplaceName || '',
          row.SettlementID || ''
        ].join(';'))
      })
      
      const csvContent = csvRows.join('\n')
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="jtl-amazon-raw-${from}_${to}.csv"`
        }
      })
    }
    
    // JSON-Export (Default)
    // Gruppiere nach TransactionType
    const grouped = new Map<string, any[]>()
    
    dataToExport.forEach(row => {
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
      sample_size: dataToExport.length,
      einzigartige_kombinationen: Array.from(uniqueCombos).sort(),
      gruppiert_nach_type: summary,
      rohdaten_sample: rawData.slice(0, 50).map(r => ({
        kMessageId: r.kMessageId,
        PostedDateTime: r.PostedDateTime,
        TransactionType: r.TransactionType || 'NULL',
        AmountType: r.AmountType || 'NULL',
        AmountDescription: r.AmountDescription || 'NULL',
        OrderID: r.OrderID || 'NULL',
        MerchantOrderID: r.MerchantOrderID || 'NULL',
        Amount: r.Amount,
        SettlementID: r.SettlementID || 'NULL'
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
