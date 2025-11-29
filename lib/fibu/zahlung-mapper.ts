/**
 * Mapped Roh-Zahlungsdokumente aus verschiedenen Collections
 * auf ein einheitliches Format
 */

export function mapZahlung(rawDoc: any, anbieter: string): any {
  // Amazon Settlements
  if (anbieter === 'Amazon') {
    // Amazon Format: amountType z.B. "Order/ItemPrice/Principal"
    const amountTypeKey = (rawDoc.amountType || '').split('/').pop() // "Principal"
    
    return {
      ...rawDoc,
      anbieter: 'Amazon',
      betrag: rawDoc.amount || rawDoc.betrag || 0,
      datum: rawDoc.postedDate || rawDoc.datum,
      datumDate: rawDoc.postedDate ? new Date(rawDoc.postedDate) : (rawDoc.datumDate || rawDoc.datum),
      verwendungszweck: amountTypeKey || rawDoc.verwendungszweck || '',  // z.B. "Principal", "Tax", "Shipping"
      kategorie: rawDoc.amountType?.includes('ItemPrice') ? 'ItemPrice' : 
                 (rawDoc.amountType?.includes('ItemFees') ? 'ItemFees' : amountTypeKey) || '',
      beschreibung: rawDoc.amountDescription || rawDoc.beschreibung,
      referenz: rawDoc.orderId || rawDoc.merchantOrderId || rawDoc.referenz,
      gegenpartei: null
    }
  }
  
  // PayPal
  if (anbieter === 'PayPal') {
    return {
      ...rawDoc,
      anbieter: 'PayPal',
      betrag: rawDoc.amount_value || rawDoc.betrag || 0,
      datum: rawDoc.transaction_info_transaction_initiation_date || rawDoc.datum,
      datumDate: rawDoc.transaction_info_transaction_initiation_date 
        ? new Date(rawDoc.transaction_info_transaction_initiation_date)
        : (rawDoc.datumDate || rawDoc.datum),
      verwendungszweck: rawDoc.transaction_info_transaction_subject || rawDoc.verwendungszweck || '',
      beschreibung: rawDoc.transaction_info_transaction_note || rawDoc.beschreibung,
      kategorie: rawDoc.transaction_info_transaction_event_code || rawDoc.kategorie,
      referenz: rawDoc.transaction_info_paypal_reference_id || rawDoc.referenz,
      gegenpartei: rawDoc.payer_info_payer_name_alternate_full_name || rawDoc.gegenpartei
    }
  }
  
  // Commerzbank
  if (anbieter === 'Commerzbank') {
    return {
      ...rawDoc,
      anbieter: 'Commerzbank',
      betrag: rawDoc.Betrag || rawDoc.betrag || 0,
      datum: rawDoc.Buchungstag || rawDoc.datum,
      datumDate: rawDoc.Buchungstag ? new Date(rawDoc.Buchungstag) : (rawDoc.datumDate || rawDoc.datum),
      verwendungszweck: rawDoc.Verwendungszweck || rawDoc.verwendungszweck || '',
      beschreibung: rawDoc.Buchungstext || rawDoc.beschreibung,
      kategorie: rawDoc.Buchungstext || rawDoc.kategorie,
      referenz: rawDoc.Umsatzreferenz || rawDoc.referenz,
      gegenpartei: rawDoc.Auftraggeber || rawDoc.Zahlungsempfaenger || rawDoc.gegenpartei
    }
  }
  
  // Postbank
  if (anbieter === 'Postbank') {
    return {
      ...rawDoc,
      anbieter: 'Postbank',
      betrag: rawDoc.Betrag || rawDoc.betrag || 0,
      datum: rawDoc.Buchungstag || rawDoc.datum,
      datumDate: rawDoc.Buchungstag ? new Date(rawDoc.Buchungstag) : (rawDoc.datumDate || rawDoc.datum),
      verwendungszweck: rawDoc.Verwendungszweck || rawDoc.verwendungszweck || '',
      beschreibung: rawDoc.Buchungstext || rawDoc.beschreibung,
      kategorie: rawDoc.Buchungstext || rawDoc.kategorie,
      referenz: null,
      gegenpartei: rawDoc.Auftraggeber || rawDoc.Empfaenger || rawDoc.gegenpartei
    }
  }
  
  // Mollie
  if (anbieter === 'Mollie') {
    return {
      ...rawDoc,
      anbieter: 'Mollie',
      betrag: parseFloat(rawDoc.amount?.value || rawDoc.betrag || 0),
      datum: rawDoc.createdAt || rawDoc.datum,
      datumDate: rawDoc.createdAt ? new Date(rawDoc.createdAt) : (rawDoc.datumDate || rawDoc.datum),
      verwendungszweck: rawDoc.description || rawDoc.verwendungszweck || '',
      beschreibung: rawDoc.description || rawDoc.beschreibung,
      kategorie: rawDoc.method || rawDoc.kategorie,
      referenz: rawDoc.id || rawDoc.referenz,
      gegenpartei: rawDoc.customerId || rawDoc.gegenpartei
    }
  }
  
  // Fallback: Rückgabe wie es ist
  return rawDoc
}
