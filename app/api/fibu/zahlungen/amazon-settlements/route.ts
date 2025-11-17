import { NextRequest, NextResponse } from 'next/server'
import { getJTLConnection } from '../../../../lib/db/mssql'

/**
 * GET /api/fibu/zahlungen/amazon-settlements
 * Lädt Amazon Settlement Report Positionen für einen Zeitraum
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'
    const limit = parseInt(searchParams.get('limit') || '5000')
    
    const pool = await getJTLConnection()
    
    // Lade alle Settlement-Positionen im Zeitraum
    // Gruppiert nach OrderID und TransactionType für bessere Übersicht
    const query = `
      SELECT TOP ${limit}
        sp.SettlementID,
        sp.TransactionType,
        sp.OrderID,
        sp.MerchantOrderID,
        sp.AmountType,
        sp.AmountDescription,
        sp.Amount,
        sp.PostedDateTime as zahlungsdatum,
        sp.SKU,
        sp.QuantityPurchased,
        s.DepositDate,
        s.SettlementStartDate,
        s.SettlementEndDate,
        sp.MarketplaceName,
        sp.FulfillmentID
      FROM dbo.pf_amazon_settlementpos sp
      JOIN dbo.pf_amazon_settlement s ON sp.SettlementID = s.SettlementID
      WHERE sp.PostedDateTime >= @from
        AND sp.PostedDateTime < DATEADD(day, 1, @to)
        AND sp.Amount <> 0  -- Nur Positionen mit Betrag
      ORDER BY sp.PostedDateTime DESC, sp.OrderID, sp.kMessageId
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    // Gruppiere und transformiere für Zahlungsmodul
    const positionen = result.recordset.map((pos: any) => ({
      // ID
      settlementId: pos.SettlementID?.toString(),
      orderId: pos.OrderID,
      merchantOrderId: pos.MerchantOrderID,
      
      // Datum
      zahlungsdatum: pos.zahlungsdatum,
      depositDate: pos.DepositDate,
      settlementStart: pos.SettlementStartDate,
      settlementEnd: pos.SettlementEndDate,
      
      // Beträge
      betrag: parseFloat(pos.Amount || 0),
      
      // Typ
      transactionType: pos.TransactionType, // Order, Refund, Transfer, etc.
      amountType: pos.AmountType, // ItemPrice, ItemFees, Shipping
      amountDescription: pos.AmountDescription, // Principal, Tax, Commission
      
      // Meta
      sku: pos.SKU,
      quantity: pos.QuantityPurchased,
      marketplace: pos.MarketplaceName,
      fulfillment: pos.FulfillmentID,
      
      // Für Zahlungsmodul
      zahlungsanbieter: 'Amazon Payment',
      quelle: 'amazon_settlement',
      hinweis: `${pos.TransactionType}/${pos.AmountType}/${pos.AmountDescription}`,
      
      // Kategorisierung für Buchung
      kategorie: kategorisierePosition(pos)
    }))
    
    return NextResponse.json({
      ok: true,
      positionen,
      anzahl: positionen.length,
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('[Amazon Settlements] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Kategorisiert eine Settlement-Position für die Buchung
 */
function kategorisierePosition(pos: any): string {
  const { TransactionType, AmountType, AmountDescription } = pos
  
  // Erlöse
  if (TransactionType === 'Order' && AmountType === 'ItemPrice' && AmountDescription === 'Principal') {
    return 'erloes_artikel'
  }
  if (TransactionType === 'Order' && AmountType === 'ItemPrice' && AmountDescription === 'Tax') {
    return 'erloes_steuer'
  }
  if (TransactionType === 'Order' && AmountType === 'ItemPrice' && AmountDescription === 'Shipping') {
    return 'erloes_versand'
  }
  
  // Gebühren
  if (AmountType === 'ItemFees' && AmountDescription === 'Commission') {
    return 'gebuehr_provision'
  }
  if (AmountType === 'ItemFees' && AmountDescription === 'FBAFee') {
    return 'gebuehr_fba'
  }
  if (AmountType === 'ItemFees' && AmountDescription === 'ShippingChargeback') {
    return 'gebuehr_versand'
  }
  if (AmountType === 'Promotion') {
    return 'gebuehr_werbung'
  }
  
  // Rückerstattungen
  if (TransactionType === 'Refund' && AmountType === 'ItemPrice') {
    return 'rueckerstattung'
  }
  
  // Transfers
  if (TransactionType === 'Transfer') {
    return 'transfer'
  }
  
  // Sonstige
  if (TransactionType === 'ServiceFee') {
    return 'gebuehr_service'
  }
  if (TransactionType === 'Adjustment') {
    return 'korrektur'
  }
  
  return 'sonstiges'
}
