/**
 * Statische Konto-Mappings für bekannte Kategorien und Anbieter
 * Basiert auf SKR04 Kontenrahmen
 */

export interface KontoMapping {
  konto: string
  steuer: number
  bezeichnung: string
  beschreibung?: string
}

/**
 * Amazon-Kategorien Mapping
 * WICHTIG: Amazon nutzt oft verwendungszweck für die echte Kategorie!
 */
export const AMAZON_MAPPINGS: Record<string, KontoMapping> = {
  // Provisionen & Gebühren
  'Commission': {
    konto: '4970',
    steuer: 19,
    bezeichnung: 'Provisionen',
    beschreibung: 'Amazon Verkaufsprovisionen'
  },
  'AdvertisingFee': {
    konto: '4630',
    steuer: 19,
    bezeichnung: 'Werbekosten',
    beschreibung: 'Amazon Sponsored Products & Brands'
  },
  'FBAFee': {
    konto: '4950',
    steuer: 19,
    bezeichnung: 'FBA-Gebühren',
    beschreibung: 'Fulfillment by Amazon Gebühren'
  },
  'ItemFees': {
    konto: '4910',
    steuer: 19,
    bezeichnung: 'Verkaufsgebühren',
    beschreibung: 'Amazon Verkaufsgebühren'
  },
  'FBAInventoryFee': {
    konto: '4950',
    steuer: 19,
    bezeichnung: 'FBA-Lagergebühren',
    beschreibung: 'Amazon Lagergebühren'
  },
  
  // Erlöse
  'ItemPrice': {
    konto: '8400',
    steuer: 19,
    bezeichnung: 'Erlöse 19% USt',
    beschreibung: 'Amazon Artikelerlöse'
  },
  'Principal': {
    konto: '8400',
    steuer: 19,
    bezeichnung: 'Erlöse 19% USt',
    beschreibung: 'Amazon Haupterlöse'
  },
  'Shipping': {
    konto: '8400',
    steuer: 19,
    bezeichnung: 'Versanderlöse',
    beschreibung: 'Amazon Versanderlöse'
  },
  'ShippingHB': {
    konto: '8400',
    steuer: 19,
    bezeichnung: 'Versanderlöse',
    beschreibung: 'Amazon Versanderlöse'
  },
  'Tax': {
    konto: '3806',
    steuer: 0,
    bezeichnung: 'Umsatzsteuer 19%',
    beschreibung: 'Amazon ausgewiesene USt'
  },
  'ShippingTax': {
    konto: '3806',
    steuer: 0,
    bezeichnung: 'Umsatzsteuer 19%',
    beschreibung: 'Amazon Versand-USt'
  },
  
  // Rückerstattungen
  'Refund': {
    konto: '8200',
    steuer: 19,
    bezeichnung: 'Erlösschmälerungen',
    beschreibung: 'Amazon Rückerstattungen'
  },
  'RefundCommission': {
    konto: '4970',
    steuer: -19,  // Negativ weil Rückerstattung der Provision
    bezeichnung: 'Provisionserstattung',
    beschreibung: 'Rückerstattung von Provisionen bei Retouren'
  },
  
  // Sonstiges
  'Subscription': {
    konto: '4950',
    steuer: 19,
    bezeichnung: 'Amazon Subscription',
    beschreibung: 'Amazon Professional Subscription'
  },
  'ServiceFee': {
    konto: '4910',
    steuer: 19,
    bezeichnung: 'Servicegebühren',
    beschreibung: 'Amazon Servicegebühren'
  }
}

/**
 * PayPal/Mollie Gebühren
 */
export const PAYMENT_PROVIDER_MAPPINGS: Record<string, KontoMapping> = {
  'PayPal Fee': {
    konto: '4950',
    steuer: 19,
    bezeichnung: 'PayPal-Gebühren',
    beschreibung: 'PayPal Transaktionsgebühren'
  },
  'Mollie Fee': {
    konto: '4950',
    steuer: 19,
    bezeichnung: 'Mollie-Gebühren',
    beschreibung: 'Mollie Transaktionsgebühren'
  },
  'Stripe Fee': {
    konto: '4950',
    steuer: 19,
    bezeichnung: 'Stripe-Gebühren',
    beschreibung: 'Stripe Transaktionsgebühren'
  }
}

/**
 * Allgemeine Geschäftsvorfälle (Keyword-basiert)
 */
export const KEYWORD_MAPPINGS: Array<{
  keywords: string[]
  mapping: KontoMapping
}> = [
  {
    keywords: ['telekom', 'deutsche telekom', 'vodafone', 'telefon', 'handy', 'mobilfunk'],
    mapping: {
      konto: '6825',
      steuer: 19,
      bezeichnung: 'Telekommunikation',
      beschreibung: 'Telefon, Internet, Mobilfunk'
    }
  },
  {
    keywords: ['miete', 'rent', 'büromiete', 'gewerbemiete'],
    mapping: {
      konto: '6400',
      steuer: 0,
      bezeichnung: 'Mieten',
      beschreibung: 'Mieten für Räume und Gebäude'
    }
  },
  {
    keywords: ['versicherung', 'insurance', 'haftpflicht', 'betriebshaftpflicht'],
    mapping: {
      konto: '6300',
      steuer: 19,
      bezeichnung: 'Versicherungen',
      beschreibung: 'Betriebsversicherungen'
    }
  },
  {
    keywords: ['strom', 'energie', 'electricity', 'stadtwerke'],
    mapping: {
      konto: '6805',
      steuer: 19,
      bezeichnung: 'Strom, Heizung',
      beschreibung: 'Energiekosten'
    }
  },
  {
    keywords: ['büromaterial', 'office', 'bürobedarf', 'schreibwaren'],
    mapping: {
      konto: '6815',
      steuer: 19,
      bezeichnung: 'Büromaterial',
      beschreibung: 'Bürobedarf und Schreibwaren'
    }
  },
  {
    keywords: ['software', 'saas', 'lizenz', 'subscription', 'abo'],
    mapping: {
      konto: '6815',
      steuer: 19,
      bezeichnung: 'Software und Lizenzen',
      beschreibung: 'Software, SaaS, Lizenzen'
    }
  },
  {
    keywords: ['porto', 'dhl', 'deutsche post', 'versand', 'shipping'],
    mapping: {
      konto: '6805',
      steuer: 19,
      bezeichnung: 'Porto und Versand',
      beschreibung: 'Versandkosten, Porto'
    }
  },
  {
    keywords: ['steuerberater', 'buchhalter', 'wirtschaftsprüfer'],
    mapping: {
      konto: '6820',
      steuer: 19,
      bezeichnung: 'Buchführungskosten',
      beschreibung: 'Steuerberater, Buchhaltung'
    }
  },
  {
    keywords: ['werbung', 'marketing', 'google ads', 'facebook ads', 'meta'],
    mapping: {
      konto: '6630',
      steuer: 19,
      bezeichnung: 'Werbekosten',
      beschreibung: 'Online-Marketing, Werbung'
    }
  },
  {
    keywords: ['benzin', 'diesel', 'tankstelle', 'kraftstoff', 'shell', 'aral', 'esso'],
    mapping: {
      konto: '6520',
      steuer: 19,
      bezeichnung: 'KFZ-Kosten',
      beschreibung: 'Kraftstoff, Tankstelle'
    }
  }
]

/**
 * Erlöskonten nach Land und USt-Status
 */
export const ERLOESKONTO_MAPPINGS = {
  inland: {
    standard: {
      konto: '8400',
      steuer: 19,
      bezeichnung: 'Erlöse 19% USt',
      steuerkonto: '3806'  // Umsatzsteuer 19%
    },
    ermaessigt: {
      konto: '8300',
      steuer: 7,
      bezeichnung: 'Erlöse 7% USt',
      steuerkonto: '3801'  // Umsatzsteuer 7%
    }
  },
  eu: {
    mitUstId: {
      konto: '8338',
      steuer: 0,
      bezeichnung: 'Steuerfreie innergemeinschaftliche Lieferungen',
      steuerkonto: ''  // Keine USt
    },
    ohneUstId: {
      konto: '8400',
      steuer: 19,
      bezeichnung: 'Erlöse 19% USt (EU ohne USt-ID)',
      steuerkonto: '3806'
    }
  },
  drittland: {
    konto: '8120',
    steuer: 0,
    bezeichnung: 'Erlöse Ausfuhrlieferungen',
    steuerkonto: ''
  }
}

/**
 * Hilfsfunktion: Ermittle Erlöskonto basierend auf Land und USt-ID
 */
export function getErlösKonto(land: string, ustId?: string): KontoMapping & { steuerkonto: string } {
  const landUpper = land.toUpperCase()
  
  // Deutschland
  if (landUpper === 'DE') {
    return ERLOESKONTO_MAPPINGS.inland.standard
  }
  
  // EU-Länder
  const euLaender = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']
  
  if (euLaender.includes(landUpper)) {
    // Mit USt-ID → steuerfrei (§13b UStG)
    if (ustId && ustId.trim().length > 0) {
      return ERLOESKONTO_MAPPINGS.eu.mitUstId
    }
    // Ohne USt-ID → wie Inland
    return ERLOESKONTO_MAPPINGS.eu.ohneUstId
  }
  
  // Drittland (CH, GB, US, etc.)
  return ERLOESKONTO_MAPPINGS.drittland
}

/**
 * Hilfsfunktion: Ermittle Bank-Konto für Zahlungsanbieter
 */
export function getBankKonto(anbieter: string): string {
  const mapping: Record<string, string> = {
    'paypal': '1820',           // PayPal-Konto
    'mollie': '1830',           // Mollie-Konto  
    'stripe': '1840',           // Stripe-Konto
    'amazon': '1825',           // Amazon-Konto
    'ebay': '1835',             // eBay-Konto
    'commerzbank': '1800',      // Commerzbank Girokonto
    'postbank': '1810',         // Postbank Girokonto
    'bank': '1800'              // Standard Bank
  }
  
  return mapping[anbieter.toLowerCase()] || '1800'  // Fallback: Girokonto
}

/**
 * Hilfsfunktion: Ermittle Steuerkonto
 */
export function getSteuerkonto(art: 'ust' | 'vst', steuersatz: number): string {
  if (steuersatz === 0) return ''
  
  if (art === 'ust') {
    // Umsatzsteuer (Ausgangsrechnungen)
    if (steuersatz === 19) return '3806'
    if (steuersatz === 7) return '3801'
  } else {
    // Vorsteuer (Eingangsrechnungen)
    if (steuersatz === 19) return '1406'
    if (steuersatz === 7) return '1401'
  }
  
  return ''
}

/**
 * Hilfsfunktion: Suche Mapping anhand von Text
 */
export function findMappingByText(text: string): KontoMapping | null {
  const textLower = text.toLowerCase()
  
  // 1. Prüfe Amazon-Kategorien
  for (const [kategorie, mapping] of Object.entries(AMAZON_MAPPINGS)) {
    if (textLower.includes(kategorie.toLowerCase())) {
      return mapping
    }
  }
  
  // 2. Prüfe Payment-Provider
  for (const [provider, mapping] of Object.entries(PAYMENT_PROVIDER_MAPPINGS)) {
    if (textLower.includes(provider.toLowerCase())) {
      return mapping
    }
  }
  
  // 3. Prüfe Keywords
  for (const item of KEYWORD_MAPPINGS) {
    if (item.keywords.some(kw => textLower.includes(kw))) {
      return item.mapping
    }
  }
  
  return null
}
