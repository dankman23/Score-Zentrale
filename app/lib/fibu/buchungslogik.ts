/**
 * Buchungslogik für FIBU-Modul
 * Automatische Berechnung von Soll/Haben-Konten und MwSt
 */

export interface BuchungsInfo {
  sollKonto: string
  habenKonto: string
  nettoBetrag: number
  mwstSatz: number
  mwstBetrag: number
  bruttoBetrag: number
  buchungstext: string
  gegenkontoTyp: 'erloes' | 'gebuehr' | 'vorsteuer' | 'transfer' | 'einkauf' | 'storno'
}

export interface DoppelBuchung {
  hauptbuchung: BuchungsInfo
  gebuehrBuchung?: BuchungsInfo
}

/**
 * Amazon Konten-Mapping
 * Basis: SKR04
 */
export const AMAZON_KONTEN_MAPPING: Record<string, {
  sollKonto: string
  habenKonto: string
  mwstSatz: number
  typ: BuchungsInfo['gegenkontoTyp']
}> = {
  // Erlöse
  'ItemPrice': {
    sollKonto: '1815',      // Amazon Settlement-Konto
    habenKonto: '69001',    // Umsatzerlöse Amazon
    mwstSatz: 19,
    typ: 'erloes'
  },
  'Principal': {
    sollKonto: '1815',
    habenKonto: '69001',
    mwstSatz: 19,
    typ: 'erloes'
  },
  
  // Versand
  'Shipping': {
    sollKonto: '1815',
    habenKonto: '4800',     // Erlöse Versandkosten
    mwstSatz: 19,
    typ: 'erloes'
  },
  'ShippingHB': {
    sollKonto: '1815',
    habenKonto: '4800',
    mwstSatz: 19,
    typ: 'erloes'
  },
  
  // Marketplace Facilitator VAT (Amazon führt MwSt ab)
  'MarketplaceFacilitatorVAT-Shipping': {
    sollKonto: '1815',
    habenKonto: '1370',     // Abziehbare Vorsteuer
    mwstSatz: 0,            // Keine weitere MwSt, ist bereits abgeführt
    typ: 'vorsteuer'
  },
  'MarketplaceFacilitatorVAT-Principal': {
    sollKonto: '1815',
    habenKonto: '1370',
    mwstSatz: 0,
    typ: 'vorsteuer'
  },
  
  // Gebühren
  'Commission': {
    sollKonto: '6770',      // Amazon Kommissionen
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'ItemFees': {
    sollKonto: '6770',
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'FBAPerUnitFulfillmentFee': {
    sollKonto: '4950',      // FBA Gebühren
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'FBAWeightBasedFee': {
    sollKonto: '4950',
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'StorageFee': {
    sollKonto: '4950',
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'ServiceFee': {
    sollKonto: '4910',      // Sonstige Verkaufsgebühren
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'AdvertisingFee': {
    sollKonto: '4630',      // Werbekosten
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'Goodwill': {
    sollKonto: '4960',      // Kulanzaufwendungen
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  
  // Rückerstattungen
  'RefundCommission': {
    sollKonto: '6770',
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'storno'
  },
  
  // Transfer
  'Transfer': {
    sollKonto: '1200',      // Bank
    habenKonto: '1815',
    mwstSatz: 0,
    typ: 'transfer'
  }
}

/**
 * Berechnet Buchungsinformationen für Amazon Settlement
 */
export function berechneAmazonBuchung(
  betrag: number,
  amountType: string,
  orderId?: string,
  transactionType?: string
): BuchungsInfo | null {
  // Bestimme Mapping
  let mapping = AMAZON_KONTEN_MAPPING[amountType]
  
  // Fallback für Refund-Typen
  if (!mapping && transactionType?.toLowerCase().includes('refund')) {
    // Bei Refund: Storno der ursprünglichen Buchung
    if (amountType?.toLowerCase().includes('principal') || amountType?.toLowerCase().includes('itemprice')) {
      mapping = {
        sollKonto: '69001',   // Erlöse (Storno)
        habenKonto: '1815',
        mwstSatz: 19,
        typ: 'storno'
      }
    } else if (amountType?.toLowerCase().includes('shipping')) {
      mapping = {
        sollKonto: '4800',
        habenKonto: '1815',
        mwstSatz: 19,
        typ: 'storno'
      }
    } else if (amountType?.toLowerCase().includes('commission')) {
      mapping = {
        sollKonto: '1815',
        habenKonto: '6770',   // Gebühren-Erstattung
        mwstSatz: 19,
        typ: 'storno'
      }
    }
  }
  
  if (!mapping) {
    console.warn(`[Buchungslogik] Kein Mapping für Amazon amountType: ${amountType}`)
    return null
  }
  
  const bruttoBetrag = Math.abs(betrag)
  let nettoBetrag: number
  let mwstBetrag: number
  
  if (mapping.mwstSatz === 0) {
    // Keine MwSt (z.B. Vorsteuer oder Transfer)
    nettoBetrag = bruttoBetrag
    mwstBetrag = 0
  } else {
    // MwSt enthalten (Brutto → Netto)
    nettoBetrag = bruttoBetrag / (1 + mapping.mwstSatz / 100)
    mwstBetrag = bruttoBetrag - nettoBetrag
  }
  
  return {
    sollKonto: mapping.sollKonto,
    habenKonto: mapping.habenKonto,
    nettoBetrag: parseFloat(nettoBetrag.toFixed(2)),
    mwstSatz: mapping.mwstSatz,
    mwstBetrag: parseFloat(mwstBetrag.toFixed(2)),
    bruttoBetrag: bruttoBetrag,
    buchungstext: `Amazon ${amountType}${orderId ? ' ' + orderId : ''}`,
    gegenkontoTyp: mapping.typ
  }
}

/**
 * Berechnet Buchungsinformationen für PayPal Transaktion
 */
export function berechnePayPalBuchung(
  betrag: number,
  gebuehr: number | null,
  rechnungsNr?: string,
  typ?: string
): DoppelBuchung | null {
  const bruttoBetrag = Math.abs(betrag)
  
  // Bestimme Erlös-Konto basierend auf Typ oder Default
  let erloeseKonto = '69012'  // Standard: 19% MwSt
  let mwstSatz = 19
  
  // Transfer zu Bank?
  if (typ === 'transfer' || rechnungsNr?.toLowerCase().includes('bank')) {
    return {
      hauptbuchung: {
        sollKonto: '1200',      // Bank
        habenKonto: '1801',     // PayPal
        nettoBetrag: bruttoBetrag,
        mwstSatz: 0,
        mwstBetrag: 0,
        bruttoBetrag: bruttoBetrag,
        buchungstext: 'PayPal an Bank',
        gegenkontoTyp: 'transfer'
      }
    }
  }
  
  // Einkauf?
  if (typ === 'purchase' || betrag < 0) {
    const nettoBetrag = bruttoBetrag / 1.19
    const mwstBetrag = bruttoBetrag - nettoBetrag
    
    return {
      hauptbuchung: {
        sollKonto: '79000',     // Einkauf Dienstleistungen
        habenKonto: '1801',
        nettoBetrag: parseFloat(nettoBetrag.toFixed(2)),
        mwstSatz: 19,
        mwstBetrag: parseFloat(mwstBetrag.toFixed(2)),
        bruttoBetrag: bruttoBetrag,
        buchungstext: `PayPal Einkauf${rechnungsNr ? ' ' + rechnungsNr : ''}`,
        gegenkontoTyp: 'einkauf'
      }
    }
  }
  
  // Standard: Shop-Zahlung mit Gebühr
  const nettoBetrag = bruttoBetrag / (1 + mwstSatz / 100)
  const mwstBetrag = bruttoBetrag - nettoBetrag
  
  const result: DoppelBuchung = {
    hauptbuchung: {
      sollKonto: '1801',      // PayPal-Konto
      habenKonto: erloeseKonto,
      nettoBetrag: parseFloat(nettoBetrag.toFixed(2)),
      mwstSatz: mwstSatz,
      mwstBetrag: parseFloat(mwstBetrag.toFixed(2)),
      bruttoBetrag: bruttoBetrag,
      buchungstext: `PayPal${rechnungsNr ? ' ' + rechnungsNr : ''}`,
      gegenkontoTyp: 'erloes'
    }
  }
  
  // Gebühr separat buchen
  if (gebuehr && gebuehr > 0) {
    const gebuehrBrutto = Math.abs(gebuehr)
    const gebuehrNetto = gebuehrBrutto / 1.19
    const gebuehrMwst = gebuehrBrutto - gebuehrNetto
    
    result.gebuehrBuchung = {
      sollKonto: '6855',      // PayPal Gebühren
      habenKonto: '1801',
      nettoBetrag: parseFloat(gebuehrNetto.toFixed(2)),
      mwstSatz: 19,
      mwstBetrag: parseFloat(gebuehrMwst.toFixed(2)),
      bruttoBetrag: gebuehrBrutto,
      buchungstext: `PayPal Gebühr${rechnungsNr ? ' ' + rechnungsNr : ''}`,
      gegenkontoTyp: 'gebuehr'
    }
  }
  
  return result
}

/**
 * Hilfsfunktion: Extrahiert MwSt-Satz aus Beschreibung
 */
export function ermittleMwstSatz(beschreibung?: string): number {
  if (!beschreibung) return 19  // Default
  
  const lower = beschreibung.toLowerCase()
  if (lower.includes('7%') || lower.includes('ermäßigt')) return 7
  if (lower.includes('0%') || lower.includes('steuerfrei')) return 0
  
  return 19  // Default
}

/**
 * Formatiert Buchungssatz für Export (DATEV)
 */
export function formatiereBuchungssatz(buchung: BuchungsInfo, datum: string, belegnr: string): string {
  // Format: Konto;Gegenkonto;Betrag;Währung;Datum;Belegnummer;Buchungstext;Steuerschlüssel
  const steuerschluessel = buchung.mwstSatz === 19 ? 'VSt19' : buchung.mwstSatz === 7 ? 'VSt7' : ''
  
  return [
    buchung.sollKonto,
    buchung.habenKonto,
    buchung.nettoBetrag.toFixed(2),
    'EUR',
    datum,
    belegnr,
    buchung.buchungstext,
    steuerschluessel
  ].join(';')
}
