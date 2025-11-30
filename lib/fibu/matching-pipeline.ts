/**
 * Matching-Pipeline für Zahlungen
 * 
 * Implementiert die 4-stufige Zuordnungslogik:
 * 1. Import-Matches aus JTL übernehmen
 * 2. Auto-Matching für VK-Belege
 * 3. Konto-Vorschläge basierend auf Regeln
 * 4. Manuelle Zuordnungen (via UI)
 */

import { Db } from 'mongodb'

export interface MatchResult {
  vk_beleg_id?: string
  vk_rechnung_nr?: string
  konto_id?: string
  konto_vorschlag_id?: string
  match_source: 'import_vk' | 'auto_vk' | 'auto_konto' | 'manuell' | null
  match_confidence?: number  // 0-100
  match_details?: string
}

/**
 * 1. IMPORT-MATCH: Übernehme JTL-Matches
 * Prüft ob Zahlung bereits eine Rechnung zugeordnet hat
 */
export async function getImportMatch(
  zahlung: any,
  db: Db
): Promise<MatchResult | null> {
  // Wenn bereits zugeordneteRechnung vorhanden -> Import-Match
  if (zahlung.zugeordneteRechnung) {
    const rechnung = await db.collection('fibu_vk_rechnungen').findOne({
      cRechnungsNr: zahlung.zugeordneteRechnung
    })
    
    if (rechnung) {
      return {
        vk_beleg_id: rechnung._id.toString(),
        vk_rechnung_nr: rechnung.cRechnungsNr,
        konto_id: rechnung.sachkonto || rechnung.debitorKonto,
        match_source: 'import_vk',
        match_confidence: 100,
        match_details: 'JTL-Import-Match'
      }
    }
  }
  
  return null
}

/**
 * 2. AUTO-MATCH: Automatisches Matching für VK-Belege
 * Sucht nach Übereinstimmungen anhand von Referenz, Betrag, Datum
 */
export async function getAutoVkMatch(
  zahlung: any,
  db: Db
): Promise<MatchResult | null> {
  // Nur wenn noch kein Match vorhanden
  if (zahlung.zugeordneteRechnung || zahlung.istZugeordnet) {
    return null
  }
  
  const vkRechnungen = db.collection('fibu_vk_rechnungen')
  
  // Match-Strategie 1: Exakte AU-Nummer
  if (zahlung.referenz && zahlung.referenz.match(/^AU_\d+_SW\d+$/)) {
    const rechnung = await vkRechnungen.findOne({
      cBestellNr: zahlung.referenz
    })
    
    if (rechnung) {
      // Prüfe Betrag (mit 2% Toleranz für Gebühren/Rundung)
      const betragsDiff = Math.abs(rechnung.brutto - Math.abs(zahlung.betrag))
      const toleranz = rechnung.brutto * 0.02
      
      if (betragsDiff <= toleranz) {
        return {
          vk_beleg_id: rechnung._id.toString(),
          vk_rechnung_nr: rechnung.cRechnungsNr,
          konto_id: rechnung.sachkonto || rechnung.debitorKonto,
          match_source: 'auto_vk',
          match_confidence: 95,
          match_details: `AU-Nummer-Match: ${zahlung.referenz}`
        }
      }
    }
  }
  
  // Match-Strategie 2: Amazon Order-ID
  if (zahlung.anbieter === 'Amazon' && zahlung.referenz) {
    // Suche in externen Belegen (Amazon VCS-Lite)
    const externeRechnung = await db.collection('fibu_rechnungen_alle').findOne({
      quelle: 'EXTERN',
      cBestellNr: zahlung.referenz
    })
    
    if (externeRechnung) {
      return {
        vk_beleg_id: externeRechnung.belegId,
        vk_rechnung_nr: externeRechnung.belegnummer,
        konto_id: externeRechnung.sachkonto,
        match_source: 'auto_vk',
        match_confidence: 90,
        match_details: `Amazon Order-ID-Match: ${zahlung.referenz}`
      }
    }
  }
  
  // Match-Strategie 3: Rechnungsnummer direkt
  if (zahlung.verwendungszweck) {
    const reMatch = zahlung.verwendungszweck.match(/RE\d{4}-\d+/)
    if (reMatch) {
      const rechnung = await vkRechnungen.findOne({
        cRechnungsNr: reMatch[0]
      })
      
      if (rechnung) {
        return {
          vk_beleg_id: rechnung._id.toString(),
          vk_rechnung_nr: rechnung.cRechnungsNr,
          konto_id: rechnung.sachkonto || rechnung.debitorKonto,
          match_source: 'auto_vk',
          match_confidence: 98,
          match_details: `Rechnungsnummer-Match: ${reMatch[0]}`
        }
      }
    }
  }
  
  return null
}

/**
 * 3. KONTO-VORSCHLAG: Basierend auf Quelle, Typ, Vorzeichen
 */
export function getKontoVorschlag(zahlung: any): MatchResult {
  let konto_vorschlag_id: string | undefined
  let match_details = ''
  
  // Amazon-spezifische Regeln
  if (zahlung.anbieter === 'Amazon') {
    const amountTypeKey = (zahlung.kategorie || '').split('/').pop()
    
    if (amountTypeKey === 'Principal' || zahlung.kategorie?.includes('ItemPrice')) {
      konto_vorschlag_id = '4340'  // Erlöse 19% USt
      match_details = 'Amazon Principal → Erlöskonto'
    } else if (amountTypeKey === 'Commission' || zahlung.kategorie?.includes('Commission')) {
      konto_vorschlag_id = '6770'  // Amazon Gebühren
      match_details = 'Amazon Commission → Gebührenkonto'
    } else if (amountTypeKey === 'Shipping' || zahlung.kategorie?.includes('Shipping')) {
      konto_vorschlag_id = '4800'  // Versanderlöse
      match_details = 'Amazon Shipping → Versandkonto'
    } else if (zahlung.kategorie?.includes('Tax')) {
      konto_vorschlag_id = '1776'  // Umsatzsteuer 19%
      match_details = 'Amazon Tax → Steuerkonto'
    } else if (zahlung.kategorie?.includes('FBA')) {
      konto_vorschlag_id = '4950'  // FBA Gebühren
      match_details = 'Amazon FBA → FBA-Gebührenkonto'
    } else {
      konto_vorschlag_id = '1815'  // Amazon Settlement (neutral)
      match_details = 'Amazon sonstige → Settlement-Konto'
    }
  }
  
  // PayPal-Regeln
  else if (zahlung.anbieter === 'PayPal') {
    if (zahlung.betrag > 0) {
      konto_vorschlag_id = '69012'  // PayPal Sammelkonto (Erlöse)
      match_details = 'PayPal Eingang → Sammelkonto'
    } else {
      konto_vorschlag_id = '6855'  // Sonstige Aufwendungen
      match_details = 'PayPal Gebühr → Aufwandskonto'
    }
  }
  
  // Bank-Regeln
  else if (zahlung.anbieter === 'Commerzbank' || zahlung.anbieter === 'Postbank') {
    if (zahlung.betrag > 0) {
      konto_vorschlag_id = '69018'  // Überweisung/Vorkasse Sammelkonto
      match_details = 'Bank Eingang → Sammelkonto Überweisung'
    } else {
      konto_vorschlag_id = '70000'  // Kreditoren (Lieferanten)
      match_details = 'Bank Ausgang → Kreditorenkonto'
    }
  }
  
  // eBay-Regeln
  else if (zahlung.anbieter === 'eBay') {
    konto_vorschlag_id = '69003'  // eBay Sammelkonto
    match_details = 'eBay → Sammelkonto'
  }
  
  // Mollie-Regeln
  else if (zahlung.anbieter === 'Mollie') {
    konto_vorschlag_id = '69020'  // Mollie Sammelkonto
    match_details = 'Mollie → Sammelkonto'
  }
  
  return {
    konto_vorschlag_id,
    match_source: 'auto_konto',
    match_confidence: 70,
    match_details
  }
}

/**
 * HAUPT-PIPELINE: Durchläuft alle Match-Stufen
 */
export async function processZahlungMatching(
  zahlung: any,
  db: Db
): Promise<MatchResult> {
  // 1. Import-Match prüfen
  const importMatch = await getImportMatch(zahlung, db)
  if (importMatch) {
    return importMatch
  }
  
  // 2. Auto-VK-Match versuchen
  const autoVkMatch = await getAutoVkMatch(zahlung, db)
  if (autoVkMatch) {
    return autoVkMatch
  }
  
  // 3. Konto-Vorschlag generieren
  const kontoVorschlag = getKontoVorschlag(zahlung)
  
  // 4. Wenn bereits manuell zugeordnet, respektieren
  if (zahlung.istZugeordnet && zahlung.zugeordnetesKonto) {
    return {
      konto_id: zahlung.zugeordnetesKonto,
      match_source: 'manuell',
      match_confidence: 100,
      match_details: 'Manuelle Zuordnung'
    }
  }
  
  return kontoVorschlag
}

/**
 * STATUS-BERECHNUNG: Basierend auf Konto + Belegpflicht
 */
export async function berechneZuordnungsStatus(
  zahlung: any,
  matchResult: MatchResult,
  db: Db
): Promise<'offen' | 'beleg_fehlt' | 'zugeordnet'> {
  const kontoNr = matchResult.konto_id || zahlung.zugeordnetesKonto
  
  // Kein Konto zugeordnet
  if (!kontoNr) {
    return 'offen'
  }
  
  // Lade Konto-Info aus RICHTIGER Collection
  const konto = await db.collection('kontenplan').findOne({
    kontonummer: kontoNr
  })
  
  // Konto hat keine Belegpflicht oder existiert nicht
  if (!konto || konto.belegpflicht === false) {
    return 'zugeordnet'
  }
  
  // Konto hat Belegpflicht = true
  const hatBeleg = matchResult.vk_beleg_id || zahlung.zugeordneteRechnung || zahlung.belegId
  
  return hatBeleg ? 'zugeordnet' : 'beleg_fehlt'
}
