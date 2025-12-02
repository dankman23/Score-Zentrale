/**
 * Amazon Settlement Import & Aggregation
 * 
 * Importiert Amazon-Zahlungen aus JTL-SQL (pf_amazon_settlementpos)
 * und aggregiert sie nach der Jera/ADDISON-Logik
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
  
  // Konten (gemäß Anforderung)
  bank_konto_nr: string  // Fix: 1814
  gegenkonto_konto_nr: string  // 69001, 6770, 1460, etc.
  
  // IDs & Referenzen
  order_id: string
  au_nummer: string
  rechnungsnummer: string | null  // XRE-xxx oder XRK-xxx
  transaktionsId: string
  
  // Beschreibungen
  verwendungszweck: string  // BG-Text
  bemerkung: string  // ursprüngliche Amazon Buchung (AmountType/AmountDescription)
  
  // Klassifizierung
  anbieter: string  // 'Amazon'
  quelle: string
  transaction_type: string  // Order, Refund, etc.
  amount_type: string  // ItemPrice, ItemFees, etc.
  amount_description: string  // Principal, Commission, etc.
  
  // Status
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
  
  // Query für Oktober 2025 (Beispiel)
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
 * Aggregiert Amazon-Settlement-Daten nach Jera-Logik
 * 
 * EXAKTE Aggregationsregeln (wie in Excel "Amazon Oktober"):
 * Aggregation erfolgt nach ALLEN relevanten Feldern:
 * - Datum
 * - Konto (1814)
 * - Gegenkonto (69001, 6770, 1460, etc.)
 * - Steuerschlüssel (401, etc.)
 * - Belegfeld 1 (XRE/XRK)
 * - Belegfeld 2 (AU-Nummer)
 * - Order ID
 * - Klassifizierung (Order/ItemPrice/Principal, Order/ItemFees/Commission, etc.)
 * 
 * D.h. pro eindeutiger Kombination dieser Felder wird EINE Buchungszeile erstellt.
 */
export function aggregateAmazonSettlements(
  rawData: AmazonSettlementRaw[],
  rechnungenMap: Map<string, any>
): AmazonBuchung[] {
  const buchungen: AmazonBuchung[] = []
  
  // Verarbeite jede Roh-Zeile einzeln und ordne sie zu
  const processedRows: Array<{
    row: AmazonSettlementRaw
    datum: string
    gegenkonto: string
    steuerschluessel: string | undefined
    belegNr: string | null
    auNummer: string
    klassifizierung: string
    kundenName: string
  }> = []
  
  for (const row of rawData) {
    const orderID = rows[0].OrderID
    const transactionType = rows[0].TransactionType
    const merchantOrderID = rows[0].MerchantOrderID
    const datum = new Date(rows[0].PostedDateTime).toISOString().split('T')[0]
    const sku = rows[0].SKU
    
    // Extrahiere AU-Nummer aus MerchantOrderID (Format: "171-5939943-7771564_E_149")
    let auNummer = ''
    if (merchantOrderID) {
      const auMatch = merchantOrderID.match(/_E_(\d+)/)
      if (auMatch) {
        auNummer = `AU2025-${auMatch[1]}`
      }
    }
    if (!auNummer && orderID) {
      auNummer = orderID  // Fallback: OrderID als AU-Nummer
    }
    
    // Finde zugeordnete Rechnung (über AU-Nummer oder Order-ID)
    let rechnungsnummer: string | null = null
    const rechnung = rechnungenMap.get(auNummer) || rechnungenMap.get(orderID)
    if (rechnung) {
      rechnungsnummer = rechnung.cRechnungsNr
    }
    
    // === AGGREGATION: POSITIVE BETRÄGE (ItemPrice) ===
    const itemPriceRows = rows.filter(r => r.AmountType === 'ItemPrice')
    if (itemPriceRows.length > 0) {
      const betragPositiv = itemPriceRows.reduce((sum, r) => sum + r.Amount, 0)
      
      // Erstelle BG-Text aus allen AmountDescriptions
      const kundenName = merchantOrderID ? merchantOrderID.split('_')[0] : ''
      const beschreibungen = itemPriceRows.map(r => `${kundenName} ${r.AmountDescription} bezahlt`).join(' ')
      
      // Bestimme Gegenkonto
      let gegenkontoNr = '69001'  // Standard: Sammeldebitor Amazon
      let steuerschluessel: string | undefined
      let belegNr = rechnungsnummer
      
      // Refunds → XRK statt XRE
      if (transactionType === 'Refund') {
        if (belegNr && belegNr.startsWith('XRE-')) {
          belegNr = `XRK-${belegNr.replace('XRE-', '')}`
        } else if (auNummer) {
          belegNr = `XRK-${auNummer.replace('AU2025-', '')}`
        }
      } else {
        // Normale Orders → XRE
        if (!belegNr && auNummer) {
          belegNr = `XRE-${auNummer.replace('AU2025-', '')}`
        }
      }
      
      // Klassifizierung für Bemerkung (ursprüngliche Amazon Buchung)
      const klassifizierung = `Order/ItemPrice/Principal`
      
      buchungen.push({
        datum,
        betrag: betragPositiv,
        waehrung: 'EUR',
        
        bank_konto_nr: '1814',
        gegenkonto_konto_nr: gegenkontoNr,
        
        order_id: orderID,
        au_nummer: auNummer,
        rechnungsnummer: belegNr,
        transaktionsId: `${rows[0].kMessageId}`,
        
        verwendungszweck: `${belegNr || ''} ${beschreibungen}`.trim(),
        bemerkung: klassifizierung,
        
        anbieter: 'Amazon',
        quelle: 'jtl_amazon_settlement',
        transaction_type: transactionType,
        amount_type: 'ItemPrice',
        amount_description: itemPriceRows.map(r => r.AmountDescription).join(', '),
        
        steuerschluessel
      })
    }
    
    // === AGGREGATION: NEGATIVE BETRÄGE (ItemFees) ===
    const itemFeesRows = rows.filter(r => r.AmountType === 'ItemFees')
    if (itemFeesRows.length > 0) {
      const betragNegativ = itemFeesRows.reduce((sum, r) => sum + r.Amount, 0)
      
      // Erstelle BG-Text
      const kundenName = merchantOrderID ? merchantOrderID.split('_')[0] : ''
      const beschreibungen = itemFeesRows.map(r => `${kundenName} Amazon ${r.AmountDescription}`).join(' ')
      
      // Gegenkonto für Gebühren
      let gegenkontoNr = '6770'  // Amazon-Gebühren
      let steuerschluessel = '401'  // 19% Vorsteuer
      let belegNr = rechnungsnummer
      
      // Refunds
      if (transactionType === 'Refund') {
        if (belegNr && belegNr.startsWith('XRE-')) {
          belegNr = `XRK-${belegNr.replace('XRE-', '')}`
        } else if (auNummer) {
          belegNr = `XRK-${auNummer.replace('AU2025-', '')}`
        }
      } else {
        if (!belegNr && auNummer) {
          belegNr = `XRE-${auNummer.replace('AU2025-', '')}`
        }
      }
      
      // Klassifizierung
      const klassifizierung = `Order/ItemFees/Commission`
      
      buchungen.push({
        datum,
        betrag: betragNegativ,
        waehrung: 'EUR',
        
        bank_konto_nr: '1814',
        gegenkonto_konto_nr: gegenkontoNr,
        
        order_id: orderID,
        au_nummer: auNummer,
        rechnungsnummer: belegNr,
        transaktionsId: `${rows[0].kMessageId}_fees`,
        
        verwendungszweck: beschreibungen,
        bemerkung: klassifizierung,
        
        anbieter: 'Amazon',
        quelle: 'jtl_amazon_settlement',
        transaction_type: transactionType,
        amount_type: 'ItemFees',
        amount_description: itemFeesRows.map(r => r.AmountDescription).join(', '),
        
        steuerschluessel
      })
    }
    
    // === GELDTRANSIT (Transfer-Transaktionen) ===
    if (transactionType === 'Transfer') {
      const transferRows = rows.filter(r => r.TransactionType === 'Transfer')
      if (transferRows.length > 0) {
        const betragTransfer = transferRows.reduce((sum, r) => sum + r.Amount, 0)
        
        buchungen.push({
          datum,
          betrag: betragTransfer,
          waehrung: 'EUR',
          
          bank_konto_nr: '1814',
          gegenkonto_konto_nr: '1460',  // Geldtransit
          
          order_id: orderID,
          au_nummer: '',
          rechnungsnummer: null,
          transaktionsId: `${rows[0].kMessageId}_transfer`,
          
          verwendungszweck: 'Amazon Geldtransit',
          bemerkung: '',
          
          anbieter: 'Amazon',
          quelle: 'jtl_amazon_settlement',
          transaction_type: 'Transfer',
          amount_type: 'Transfer',
          amount_description: 'Transfer',
        })
      }
    }
    
    // === MARKETPLACE FACILITATOR VAT (ItemWithheldTax) ===
    const withheldTaxRows = rows.filter(r => r.AmountType === 'ItemWithheldTax')
    if (withheldTaxRows.length > 0) {
      const betragTax = withheldTaxRows.reduce((sum, r) => sum + r.Amount, 0)
      
      const kundenName = merchantOrderID ? merchantOrderID.split('_')[0] : ''
      const beschreibungen = withheldTaxRows.map(r => `${kundenName} ${r.AmountDescription}`).join(' ')
      
      let belegNr = rechnungsnummer || (auNummer ? `XRE-${auNummer.replace('AU2025-', '')}` : null)
      
      buchungen.push({
        datum,
        betrag: betragTax,
        waehrung: 'EUR',
        
        bank_konto_nr: '1814',
        gegenkonto_konto_nr: '1370',  // Abziehbare Vorsteuer
        
        order_id: orderID,
        au_nummer: auNummer,
        rechnungsnummer: belegNr,
        transaktionsId: `${rows[0].kMessageId}_tax`,
        
        verwendungszweck: beschreibungen,
        bemerkung: `Order/ItemWithheldTax/MarketplaceFacilitatorVAT`,
        
        anbieter: 'Amazon',
        quelle: 'jtl_amazon_settlement',
        transaction_type: transactionType,
        amount_type: 'ItemWithheldTax',
        amount_description: withheldTaxRows.map(r => r.AmountDescription).join(', '),
      })
    }
  }
  
  return buchungen
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
  
  // Lade Konto-Info aus DB
  const konto = await db.collection('kontenplan').findOne({ kontonummer: kontoNr })
  
  // Wenn kein Konto gefunden oder keine Belegpflicht → zugeordnet
  if (!konto || konto.belegpflicht === false) {
    return 'zugeordnet'
  }
  
  // Wenn Belegpflicht: Prüfe ob Beleg vorhanden
  const hatBeleg = !!buchung.rechnungsnummer
  
  return hatBeleg ? 'zugeordnet' : 'beleg_fehlt'
}
