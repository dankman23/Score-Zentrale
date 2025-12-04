/**
 * Amazon Settlement Import & Aggregation V2
 * 
 * EXAKTE Aggregationslogik nach User-Vorgabe:
 * 
 * 1. Pro Order-ID (TransactionType = 'Order'):
 *    - EINE positive Buchung: Summe aller ItemPrice (Principal + Tax + Shipping + ShippingTax) → Konto 69001
 *    - EINE negative Buchung: Summe aller ItemFees (Commission + ShippingHB) → Konto 6770
 *    - Separate Buchungen für: Werbekosten (ServiceFee) → 6600, Vorsteuer → 1370
 * 
 * 2. Refunds (TransactionType = 'Refund'): 
 *    - Separat behandeln, niemals mit Order aggregieren
 *    - Belegnummer: XRK statt XRE
 * 
 * 3. Geldtransit: NICHT nach OrderID aggregieren (jede Settlement-Zeile einzeln)
 * 
 * 4. Gegenkonten (EXAKT wie in Excel):
 *    - 1370 – Vorsteuer
 *    - 1460 – Geldtransit
 *    - 6600 – Kosten für Werbung
 *    - 6770 – Amazon-Gebühren
 *    - 69001 – Amazon Sammeldebitor
 */

import { getJTLConnection } from '../db/mssql'
import { Db } from 'mongodb'

export interface AmazonSettlementRaw {
  kMessageId: number
  SettlementID: string
  TransactionType: string
  OrderID: string
  MerchantOrderID: string
  AmountType: string
  AmountDescription: string
  Amount: number
  PostedDateTime: Date
  SKU: string
  MarketplaceName: string
}

export interface AmazonBuchung {
  datum: string
  betrag: number
  waehrung: string
  bank_konto_nr: string
  gegenkonto_konto_nr: string
  order_id: string
  au_nummer: string
  rechnungsnummer: string | null
  transaktionsId: string
  verwendungszweck: string
  bemerkung: string
  anbieter: string
  quelle: string
  transaction_type: string
  amount_type: string
  amount_description: string
  zuordnungs_status?: 'offen' | 'beleg_fehlt' | 'zugeordnet'
  steuerschluessel?: string
}

/**
 * Holt Amazon-Settlement-Daten aus JTL-SQL für einen Zeitraum
 */
export async function fetchAmazonSettlementsFromJTL(
  startDate: string,
  endDate: string
): Promise<AmazonSettlementRaw[]> {
  const pool = await getJTLConnection()
  
  const result = await pool.request().query(`
    SELECT 
      kMessageId,
      SettlementID,
      TransactionType,
      OrderID,
      MerchantOrderID,
      AmountType,
      AmountDescription,
      Amount,
      PostedDateTime,
      SKU,
      MarketplaceName
    FROM dbo.pf_amazon_settlementpos
    WHERE PostedDateTime >= '${startDate}' 
      AND PostedDateTime < '${endDate}'
    ORDER BY PostedDateTime, OrderID
  `)
  
  return result.recordset
}

/**
 * Aggregiert Amazon-Settlement-Daten nach EXAKTER User-Vorgabe
 */
export function aggregateAmazonSettlements(
  rawData: AmazonSettlementRaw[],
  rechnungenMap: Map<string, any>
): AmazonBuchung[] {
  const buchungen: AmazonBuchung[] = []
  
  // Gruppiere nach OrderID + TransactionType
  const grouped = new Map<string, AmazonSettlementRaw[]>()
  
  for (const row of rawData) {
    // Geldtransit: NICHT aggregieren, jede Zeile einzeln
    if (row.TransactionType === 'Transfer') {
      buchungen.push(createGeldtransitBuchung(row, rechnungenMap))
      continue
    }
    
    // ServiceFee (Werbekosten): NICHT aggregieren, jede Zeile einzeln
    if (row.TransactionType === 'ServiceFee') {
      buchungen.push(createServiceFeeBuchung(row, rechnungenMap))
      continue
    }
    
    // other-transaction (z.B. Shipping label purchase): NICHT aggregieren
    if (row.TransactionType === 'other-transaction') {
      buchungen.push(createOtherTransactionBuchung(row, rechnungenMap))
      continue
    }
    
    const key = `${row.OrderID}_${row.TransactionType}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(row)
  }
  
  // Verarbeite jede Gruppe (Order oder Refund)
  for (const [key, rows] of grouped) {
    const orderID = rows[0].OrderID
    const transactionType = rows[0].TransactionType
    const merchantOrderID = rows[0].MerchantOrderID
    const datum = new Date(rows[0].PostedDateTime).toISOString().split('T')[0]
    
    // Extrahiere AU-Nummer
    let auNummer = extractAuNummer(merchantOrderID, orderID)
    
    // Finde zugeordnete Rechnung
    let rechnungsnummer: string | null = null
    const rechnung = rechnungenMap.get(auNummer) || rechnungenMap.get(orderID)
    if (rechnung) {
      rechnungsnummer = rechnung.cRechnungsNr
    }
    
    // Bestimme Belegnummer (XRE oder XRK)
    let belegNr = rechnungsnummer
    if (transactionType === 'Refund') {
      belegNr = createXRKBeleg(rechnungsnummer, auNummer)
    } else {
      belegNr = createXREBeleg(rechnungsnummer, auNummer)
    }
    
    // 1. POSITIVER UMSATZ-BLOCK (Principal + Tax + Shipping + ShippingTax)
    const itemPriceRows = rows.filter(r => 
      r.AmountType === 'ItemPrice' && 
      ['Principal', 'Tax', 'Shipping', 'ShippingTax'].includes(r.AmountDescription)
    )
    
    if (itemPriceRows.length > 0) {
      const betrag = itemPriceRows.reduce((sum, r) => sum + r.Amount, 0)
      
      if (Math.abs(betrag) >= 0.01) {
        const kundenName = merchantOrderID ? merchantOrderID.split('_')[0] : orderID
        const beschreibungen = itemPriceRows.map(r => r.AmountDescription).join(', ')
        
        buchungen.push({
          datum,
          betrag,
          waehrung: 'EUR',
          bank_konto_nr: '1814',
          gegenkonto_konto_nr: '69001',  // Sammeldebitor
          order_id: orderID,
          au_nummer: auNummer,
          rechnungsnummer: belegNr,
          transaktionsId: `${rows[0].kMessageId}`,
          verwendungszweck: `${belegNr} ${kundenName} ${beschreibungen}`,
          bemerkung: `${transactionType}/ItemPrice/Principal`,
          anbieter: 'Amazon',
          quelle: 'jtl_amazon_settlement',
          transaction_type: transactionType,
          amount_type: 'ItemPrice',
          amount_description: beschreibungen
        })
      }
    }
    
    // 2. GEBÜHREN-BLOCK (Commission + ShippingHB)
    const itemFeesRows = rows.filter(r => 
      r.AmountType === 'ItemFees' && 
      ['Commission', 'ShippingHB'].includes(r.AmountDescription)
    )
    
    if (itemFeesRows.length > 0) {
      const betrag = itemFeesRows.reduce((sum, r) => sum + r.Amount, 0)
      
      if (Math.abs(betrag) >= 0.01) {
        const kundenName = merchantOrderID ? merchantOrderID.split('_')[0] : orderID
        const beschreibungen = itemFeesRows.map(r => r.AmountDescription).join(', ')
        
        buchungen.push({
          datum,
          betrag,
          waehrung: 'EUR',
          bank_konto_nr: '1814',
          gegenkonto_konto_nr: '6770',  // Amazon-Gebühren
          order_id: orderID,
          au_nummer: auNummer,
          rechnungsnummer: belegNr,
          transaktionsId: `${rows[0].kMessageId}_fees`,
          verwendungszweck: `${kundenName} Amazon ${beschreibungen}`,
          bemerkung: `${transactionType}/ItemFees/Commission`,
          anbieter: 'Amazon',
          quelle: 'jtl_amazon_settlement',
          transaction_type: transactionType,
          amount_type: 'ItemFees',
          amount_description: beschreibungen,
          steuerschluessel: '401'  // 19% Vorsteuer
        })
      }
    }
    
    // 3. WERBEKOSTEN (ServiceFee, Cost of Advertising)
    const werbungRows = rows.filter(r => 
      r.AmountType === 'ItemFees' && 
      (r.AmountDescription.includes('ServiceFee') || r.AmountDescription.includes('Cost of Advertising'))
    )
    
    if (werbungRows.length > 0) {
      const betrag = werbungRows.reduce((sum, r) => sum + r.Amount, 0)
      
      if (Math.abs(betrag) >= 0.01) {
        const beschreibungen = werbungRows.map(r => r.AmountDescription).join(', ')
        
        buchungen.push({
          datum,
          betrag,
          waehrung: 'EUR',
          bank_konto_nr: '1814',
          gegenkonto_konto_nr: '6600',  // Kosten für Werbung
          order_id: orderID,
          au_nummer: auNummer,
          rechnungsnummer: belegNr,
          transaktionsId: `${rows[0].kMessageId}_werbung`,
          verwendungszweck: `Amazon Werbekosten ${beschreibungen}`,
          bemerkung: `${transactionType}/ItemFees/${beschreibungen}`,
          anbieter: 'Amazon',
          quelle: 'jtl_amazon_settlement',
          transaction_type: transactionType,
          amount_type: 'ItemFees',
          amount_description: beschreibungen,
          steuerschluessel: '401'
        })
      }
    }
    
    // 4. VORSTEUER (ItemWithheldTax / Marketplace Facilitator VAT)
    const vorsteuerRows = rows.filter(r => r.AmountType === 'ItemWithheldTax')
    
    if (vorsteuerRows.length > 0) {
      const betrag = vorsteuerRows.reduce((sum, r) => sum + r.Amount, 0)
      
      if (Math.abs(betrag) >= 0.01) {
        const beschreibungen = vorsteuerRows.map(r => r.AmountDescription).join(', ')
        
        buchungen.push({
          datum,
          betrag,
          waehrung: 'EUR',
          bank_konto_nr: '1814',
          gegenkonto_konto_nr: '1370',  // Abziehbare Vorsteuer
          order_id: orderID,
          au_nummer: auNummer,
          rechnungsnummer: belegNr,
          transaktionsId: `${rows[0].kMessageId}_vorsteuer`,
          verwendungszweck: `Amazon Marketplace Facilitator VAT ${beschreibungen}`,
          bemerkung: `${transactionType}/ItemWithheldTax/MarketplaceFacilitatorVAT`,
          anbieter: 'Amazon',
          quelle: 'jtl_amazon_settlement',
          transaction_type: transactionType,
          amount_type: 'ItemWithheldTax',
          amount_description: beschreibungen
        })
      }
    }
  }
  
  return buchungen
}

// === HILFSFUNKTIONEN ===

function extractAuNummer(merchantOrderID: string, orderID: string): string {
  if (merchantOrderID) {
    const auMatch = merchantOrderID.match(/_E_(\d+)/)
    if (auMatch) {
      return `AU2025-${auMatch[1]}`
    }
  }
  return orderID || ''
}

function createXREBeleg(rechnungsnummer: string | null, auNummer: string): string {
  if (rechnungsnummer && rechnungsnummer.startsWith('XRE-')) {
    return rechnungsnummer
  }
  if (rechnungsnummer) {
    return `XRE-${rechnungsnummer}`
  }
  if (auNummer) {
    return `XRE-${auNummer.replace('AU2025-', '').replace('AU', '')}`
  }
  return ''
}

function createXRKBeleg(rechnungsnummer: string | null, auNummer: string): string {
  if (rechnungsnummer && rechnungsnummer.startsWith('XRE-')) {
    return `XRK-${rechnungsnummer.replace('XRE-', '')}`
  }
  if (rechnungsnummer && rechnungsnummer.startsWith('XRK-')) {
    return rechnungsnummer
  }
  if (auNummer) {
    return `XRK-${auNummer.replace('AU2025-', '').replace('AU', '')}`
  }
  return ''
}

function createGeldtransitBuchung(
  row: AmazonSettlementRaw,
  rechnungenMap: Map<string, any>
): AmazonBuchung {
  const datum = new Date(row.PostedDateTime).toISOString().split('T')[0]
  
  return {
    datum,
    betrag: row.Amount,
    waehrung: 'EUR',
    bank_konto_nr: '1814',
    gegenkonto_konto_nr: '1460',  // Geldtransit
    order_id: row.OrderID || '',
    au_nummer: '',
    rechnungsnummer: null,
    transaktionsId: `${row.kMessageId}_transfer`,
    verwendungszweck: 'Amazon Geldtransit',
    bemerkung: 'Transfer',
    anbieter: 'Amazon',
    quelle: 'jtl_amazon_settlement',
    transaction_type: 'Transfer',
    amount_type: 'Transfer',
    amount_description: 'Transfer'
  }
}

function createServiceFeeBuchung(
  row: AmazonSettlementRaw,
  rechnungenMap: Map<string, any>
): AmazonBuchung {
  const datum = new Date(row.PostedDateTime).toISOString().split('T')[0]
  
  return {
    datum,
    betrag: row.Amount,
    waehrung: 'EUR',
    bank_konto_nr: '1813',  // ServiceFee läuft über 1813 (aus Excel)
    gegenkonto_konto_nr: '6600',  // Kosten für Werbung
    order_id: row.OrderID || '',
    au_nummer: '',
    rechnungsnummer: null,
    transaktionsId: `${row.kMessageId}_servicefee`,
    verwendungszweck: `Kosten für Werbung`,
    bemerkung: `ServiceFee/${row.AmountType}/${row.AmountDescription}`,
    anbieter: 'Amazon',
    quelle: 'jtl_amazon_settlement',
    transaction_type: 'ServiceFee',
    amount_type: row.AmountType,
    amount_description: row.AmountDescription,
    steuerschluessel: '401'  // 19% Vorsteuer
  }
}

function createOtherTransactionBuchung(
  row: AmazonSettlementRaw,
  rechnungenMap: Map<string, any>
): AmazonBuchung {
  const datum = new Date(row.PostedDateTime).toISOString().split('T')[0]
  
  // other-transaction kann verschiedene Konten haben - hier nehmen wir 6770 für Gebühren
  return {
    datum,
    betrag: row.Amount,
    waehrung: 'EUR',
    bank_konto_nr: '1814',
    gegenkonto_konto_nr: '6770',  // Sonstige Gebühren
    order_id: row.OrderID || '',
    au_nummer: '',
    rechnungsnummer: null,
    transaktionsId: `${row.kMessageId}_other`,
    verwendungszweck: row.AmountDescription || 'Sonstige Transaktion',
    bemerkung: `other-transaction/${row.AmountType}/${row.AmountDescription}`,
    anbieter: 'Amazon',
    quelle: 'jtl_amazon_settlement',
    transaction_type: 'other-transaction',
    amount_type: row.AmountType,
    amount_description: row.AmountDescription,
    steuerschluessel: '401'
  }
}

/**
 * Berechnet den Zuordnungsstatus basierend auf Gegenkonto + Belegpflicht
 */
export async function berechneZuordnungsStatus(
  buchung: AmazonBuchung,
  db: Db
): Promise<'offen' | 'beleg_fehlt' | 'zugeordnet'> {
  const kontoNr = buchung.gegenkonto_konto_nr
  
  if (!kontoNr) return 'offen'
  
  const konto = await db.collection('kontenplan').findOne({ kontonummer: kontoNr })
  
  if (!konto || konto.belegpflicht === false) {
    return 'zugeordnet'
  }
  
  const hatBeleg = !!buchung.rechnungsnummer
  
  return hatBeleg ? 'zugeordnet' : 'beleg_fehlt'
}
