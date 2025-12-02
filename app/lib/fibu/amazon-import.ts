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
  
  const processedRows: Array<{
    row: AmazonSettlementRaw
    datum: string
    gegenkonto: string
    steuerschluessel: string | undefined
    belegNr: string | null
    auNummer: string
    klassifizierung: string
    verwendungszweck: string
  }> = []
  
  // SCHRITT 1: Verarbeite jede Roh-Zeile und bestimme Konten, Belege, Klassifizierung
  for (const row of rawData) {
    const datum = new Date(row.PostedDateTime).toISOString().split('T')[0]
    const orderID = row.OrderID || ''
    const merchantOrderID = row.MerchantOrderID || ''
    const transactionType = row.TransactionType
    const amountType = row.AmountType
    const amountDescription = row.AmountDescription
    const betrag = row.Amount
    
    // Extrahiere AU-Nummer
    let auNummer = ''
    if (merchantOrderID) {
      const auMatch = merchantOrderID.match(/_E_(\d+)/)
      if (auMatch) {
        auNummer = `AU2025-${auMatch[1]}`
      }
    }
    if (!auNummer && orderID) {
      auNummer = orderID
    }
    
    // Finde zugeordnete Rechnung
    let rechnungsnummer: string | null = null
    const rechnung = rechnungenMap.get(auNummer) || rechnungenMap.get(orderID)
    if (rechnung) {
      rechnungsnummer = rechnung.cRechnungsNr
    }
    
    // Bestimme Gegenkonto und Steuerschlüssel basierend auf AmountType/AmountDescription
    let gegenkontoNr = '1815'  // Fallback
    let steuerschluessel: string | undefined
    let klassifizierung = `${transactionType}/${amountType}/${amountDescription}`
    
    // Konten-Mapping
    if (transactionType === 'Transfer') {
      gegenkontoNr = '1460'  // Geldtransit
      klassifizierung = 'Transfer'
    } else if (amountType === 'ItemPrice') {
      if (amountDescription === 'Principal') {
        gegenkontoNr = '69001'  // Sammeldebitor
      } else if (amountDescription === 'Tax') {
        gegenkontoNr = '1776'  // Umsatzsteuer
      } else if (amountDescription === 'Shipping') {
        gegenkontoNr = '4800'  // Versanderlöse
      } else if (amountDescription === 'ShippingTax') {
        gegenkontoNr = '1776'  // Umsatzsteuer
      } else if (amountDescription.includes('Principal')) {
        gegenkontoNr = '69001'
      }
    } else if (amountType === 'ItemFees') {
      if (amountDescription === 'Commission' || amountDescription === 'ShippingHB' || amountDescription.includes('Fee')) {
        gegenkontoNr = '6770'  // Amazon-Gebühren
        steuerschluessel = '401'  // 19% Vorsteuer
      }
    } else if (amountType === 'ItemWithheldTax') {
      gegenkontoNr = '1370'  // Abziehbare Vorsteuer
    }
    
    // Bestimme Belegnummer (XRE/XRK)
    let belegNr = rechnungsnummer
    if (transactionType === 'Refund') {
      if (belegNr && belegNr.startsWith('XRE-')) {
        belegNr = `XRK-${belegNr.replace('XRE-', '')}`
      } else if (auNummer) {
        belegNr = `XRK-${auNummer.replace('AU2025-', '').replace('AU', '')}`
      }
    } else {
      if (!belegNr && auNummer) {
        belegNr = `XRE-${auNummer.replace('AU2025-', '').replace('AU', '')}`
      }
    }
    
    // BG-Text / Verwendungszweck
    const kundenName = merchantOrderID ? merchantOrderID.split('_')[0] : orderID
    let verwendungszweck = `${kundenName} ${amountDescription}`
    if (belegNr) {
      verwendungszweck = `${belegNr} ${verwendungszweck}`
    }
    
    processedRows.push({
      row,
      datum,
      gegenkonto: gegenkontoNr,
      steuerschluessel,
      belegNr,
      auNummer,
      klassifizierung,
      verwendungszweck
    })
  }
  
  // SCHRITT 2: Aggregiere nach allen relevanten Feldern
  // Gruppierungsschlüssel: Datum + Konto + Gegenkonto + Steuerschlüssel + Beleg + AU + OrderID + Klassifizierung
  const aggregationMap = new Map<string, {
    rows: typeof processedRows
    betrag_summe: number
  }>()
  
  for (const processed of processedRows) {
    const key = [
      processed.datum,
      '1814',  // Bankkonto
      processed.gegenkonto,
      processed.steuerschluessel || '',
      processed.belegNr || '',
      processed.auNummer,
      processed.row.OrderID,
      processed.klassifizierung
    ].join('|')
    
    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        rows: [],
        betrag_summe: 0
      })
    }
    
    const group = aggregationMap.get(key)!
    group.rows.push(processed)
    group.betrag_summe += processed.row.Amount
  }
  
  // SCHRITT 3: Erstelle Buchungen aus aggregierten Daten
  for (const [key, group] of aggregationMap) {
    const first = group.rows[0]
    const betrag = group.betrag_summe
    
    // Überspringe Nullbeträge
    if (Math.abs(betrag) < 0.01) continue
    
    buchungen.push({
      datum: first.datum,
      betrag,
      waehrung: 'EUR',
      
      bank_konto_nr: '1814',
      gegenkonto_konto_nr: first.gegenkonto,
      
      order_id: first.row.OrderID,
      au_nummer: first.auNummer,
      rechnungsnummer: first.belegNr,
      transaktionsId: `${first.row.kMessageId}`,
      
      verwendungszweck: first.verwendungszweck,
      bemerkung: first.klassifizierung,
      
      anbieter: 'Amazon',
      quelle: 'jtl_amazon_settlement',
      transaction_type: first.row.TransactionType,
      amount_type: first.row.AmountType,
      amount_description: group.rows.map(r => r.row.AmountDescription).join(', '),
      
      steuerschluessel: first.steuerschluessel
    })
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
