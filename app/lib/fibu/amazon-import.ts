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
 * Aggregationsregeln:
 * 1. Pro Order-ID + AmountType werden alle AmountDescriptions zu EINER Zeile aggregiert
 * 2. Positive Beträge (Principal, Tax, Shipping, ShippingTax) werden summiert → 1 Zeile
 * 3. Negative Beträge (Commission, ShippingHB) werden summiert → 1 Zeile
 * 4. Refunds werden separat behandelt (eigene XRK-Nummern)
 */
export function aggregateAmazonSettlements(
  rawData: AmazonSettlementRaw[],
  rechnungenMap: Map<string, any>
): AmazonBuchung[] {
  const buchungen: AmazonBuchung[] = []
  
  // Gruppiere nach OrderID + TransactionType
  const grouped = new Map<string, AmazonSettlementRaw[]>()
  
  for (const row of rawData) {
    const key = `${row.OrderID}_${row.TransactionType}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(row)
  }
  
  // Verarbeite jede Gruppe
  for (const [key, rows] of grouped) {
    const orderID = rows[0].OrderID
    const transactionType = rows[0].TransactionType
    const merchantOrderID = rows[0].MerchantOrderID
    const datum = new Date(rows[0].PostedDateTime).toISOString().split('T')[0]
    
    // Extrahiere AU-Nummer aus MerchantOrderID (Format: "171-5939943-7771564_E_149")
    let auNummer = merchantOrderID || orderID
    const auMatch = auNummer.match(/_E_(\d+)/)
    if (auMatch) {
      auNummer = `AU2025-${auMatch[1]}`
    }
    
    // Finde zugeordnete Rechnung (über AU-Nummer oder Order-ID)
    let rechnungsnummer: string | null = null
    const rechnung = rechnungenMap.get(auNummer) || rechnungenMap.get(orderID)
    if (rechnung) {
      rechnungsnummer = rechnung.cRechnungsNr
    }
    
    // Gruppiere nach AmountType (ItemPrice, ItemFees, etc.)
    const byAmountType = new Map<string, AmazonSettlementRaw[]>()
    for (const row of rows) {
      const amountType = row.AmountType
      if (!byAmountType.has(amountType)) {
        byAmountType.set(amountType, [])
      }
      byAmountType.get(amountType)!.push(row)
    }
    
    // Erstelle Buchungen pro AmountType
    for (const [amountType, typeRows] of byAmountType) {
      const betrag = typeRows.reduce((sum, r) => sum + r.Amount, 0)
      
      // Überspringe wenn Betrag = 0
      if (Math.abs(betrag) < 0.01) continue
      
      // Bestimme Gegenkonto basierend auf AmountType und AmountDescription
      let gegenkontoNr = '1815'  // Fallback: Amazon Settlement
      let steuerschluessel: string | undefined
      let bemerkung = ''
      
      // Sammle alle AmountDescriptions für Bemerkung
      const descriptions = typeRows.map(r => r.AmountDescription).join(', ')
      bemerkung = `${transactionType}/${amountType}/${descriptions}`
      
      // Konten-Mapping nach Jera-Logik
      if (amountType === 'ItemPrice') {
        if (transactionType === 'Refund') {
          gegenkontoNr = '69001'  // Refund → Sammeldebitor
          rechnungsnummer = rechnungsnummer ? `XRK-${rechnungsnummer.replace('XRE-', '')}` : null
        } else if (descriptions.includes('Principal')) {
          gegenkontoNr = '69001'  // Umsatzerlöse
          rechnungsnummer = rechnungsnummer || `XRE-${auNummer.replace('AU2025-', '')}`
        } else if (descriptions.includes('Tax')) {
          gegenkontoNr = '1776'  // Umsatzsteuer
        } else if (descriptions.includes('Shipping')) {
          gegenkontoNr = '4800'  // Versanderlöse
        }
      } else if (amountType === 'ItemFees') {
        if (descriptions.includes('Commission') || descriptions.includes('ShippingHB')) {
          gegenkontoNr = '6770'  // Amazon-Gebühren
          steuerschluessel = '401'  // 19% Vorsteuer
        }
      } else if (amountType === 'ItemWithheldTax') {
        gegenkontoNr = '1370'  // Abziehbare Vorsteuer (Marketplace Facilitator VAT)
      } else if (transactionType === 'Transfer') {
        gegenkontoNr = '1460'  // Geldtransit
      }
      
      // BG-Text erstellen (Verwendungszweck)
      const kundenName = merchantOrderID ? merchantOrderID.split('_')[0] : orderID
      let verwendungszweck = `${kundenName} ${descriptions}`
      if (rechnungsnummer) {
        verwendungszweck = `${rechnungsnummer} ${verwendungszweck}`
      }
      
      buchungen.push({
        datum,
        betrag,
        waehrung: 'EUR',
        
        bank_konto_nr: '1814',
        gegenkonto_konto_nr: gegenkontoNr,
        
        order_id: orderID,
        au_nummer: auNummer,
        rechnungsnummer,
        transaktionsId: `${rows[0].kMessageId}`,
        
        verwendungszweck,
        bemerkung,
        
        anbieter: 'Amazon',
        quelle: 'jtl_amazon_settlement',
        transaction_type: transactionType,
        amount_type: amountType,
        amount_description: descriptions,
        
        steuerschluessel
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
