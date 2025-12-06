/**
 * Customer Intelligence Library
 * B2B-Erkennung, Kanal-Zuordnung, Statistiken
 */

export interface CustomerData {
  kKunde: number
  company_name: string
  website?: string
  email?: string
  
  // B2B-Klassifizierung
  is_b2b: boolean
  b2b_confidence: number // 0-100%
  b2b_indicators: string[] // ['has_company', 'has_ustid', 'flagged_b2b']
  
  // Kanal-Zuordnung
  primary_channel: 'shop' | 'direktvertrieb' | 'amazon' | 'ebay' | 'otto' | 'unknown'
  channels: Array<{
    name: string
    count: number // Anzahl Bestellungen über diesen Kanal
    revenue: number // Umsatz über diesen Kanal
  }>
  
  // Statistiken
  stats: {
    total_orders: number
    total_revenue: number
    avg_order_value: number
    first_order: Date
    last_order: Date
    order_frequency: number // Bestellungen pro Jahr
    
    // Produktgruppen
    product_groups: Array<{
      name: string
      category: string
      count: number
      revenue: number
      percentage: number
    }>
    
    // Top-Produkte
    top_products: Array<{
      name: string
      sku: string
      count: number
      revenue: number
    }>
  }
}

/**
 * Erkennt ob Kunde B2B ist
 */
export function detectB2B(kunde: any): { is_b2b: boolean; confidence: number; indicators: string[] } {
  const indicators: string[] = []
  let confidence = 0
  
  // 1. Firmenname vorhanden (nicht leer)
  const hasCompany = kunde.cFirma && kunde.cFirma.trim() !== ''
  if (hasCompany) {
    indicators.push('has_company')
    confidence += 40
  }
  
  // 2. UStID vorhanden
  const hasUstID = kunde.cUSTID && kunde.cUSTID.trim() !== ''
  if (hasUstID) {
    indicators.push('has_ustid')
    confidence += 40
  }
  
  // 3. B2B-Flag in JTL (falls vorhanden)
  if (kunde.nIstFirma === 1 || kunde.cKundenTyp === 'B2B') {
    indicators.push('flagged_b2b')
    confidence += 20
  }
  
  // 4. Firmenname-Analyse (GmbH, AG, KG, etc.)
  if (hasCompany) {
    const rechtsformen = /\b(GmbH|AG|KG|OHG|GbR|e\.K\.|UG|mbH|SE|Co\.|Ltd|Limited|Inc|Corp)\b/i
    if (rechtsformen.test(kunde.cFirma)) {
      indicators.push('legal_entity')
      confidence += 10
    }
  }
  
  // 5. Anrede "Firma" oder leer
  if (!kunde.cAnrede || kunde.cAnrede === '' || kunde.cAnrede.toLowerCase().includes('firma')) {
    indicators.push('no_personal_salutation')
    confidence += 5
  }
  
  const is_b2b = confidence >= 40 // Mindestens Firma ODER UStID
  
  return {
    is_b2b,
    confidence: Math.min(confidence, 100),
    indicators
  }
}

/**
 * Bestimmt den Primär-Kanal basierend auf Bestellungen
 */
export function determinePrimaryChannel(bestellungen: any[]): {
  primary: string
  channels: Array<{ name: string; count: number; revenue: number }>
} {
  
  const channelMap: Record<string, { count: number; revenue: number }> = {}
  
  for (const order of bestellungen) {
    // Kanal aus JTL bestimmen
    let channel = 'unknown'
    
    // Amazon
    if (order.cBestellNr?.startsWith('302-') || 
        order.cBestellNr?.startsWith('303-') ||
        order.cVersandart?.toLowerCase().includes('amazon') ||
        order.cZahlungsart?.toLowerCase().includes('amazon')) {
      channel = 'amazon'
    }
    // eBay
    else if (order.cBestellNr?.includes('-eBay-') ||
             order.cVersandart?.toLowerCase().includes('ebay') ||
             order.cZahlungsart?.toLowerCase().includes('ebay')) {
      channel = 'ebay'
    }
    // Otto
    else if (order.cVersandart?.toLowerCase().includes('otto') ||
             order.cZahlungsart?.toLowerCase().includes('otto')) {
      channel = 'otto'
    }
    // Direktvertrieb (per Rechnung, Vorkasse, eigener Kanal)
    else if (order.cZahlungsart?.toLowerCase().includes('rechnung') ||
             order.cZahlungsart?.toLowerCase().includes('vorkasse') ||
             order.cZahlungsart?.toLowerCase().includes('lastschrift')) {
      channel = 'direktvertrieb'
    }
    // Shop (xml-Import, Online-Shop)
    else if (order.kKampagne || 
             order.cZahlungsart?.toLowerCase().includes('paypal') ||
             order.cZahlungsart?.toLowerCase().includes('sofort') ||
             order.cZahlungsart?.toLowerCase().includes('kreditkarte')) {
      channel = 'shop'
    }
    
    // Zähle
    if (!channelMap[channel]) {
      channelMap[channel] = { count: 0, revenue: 0 }
    }
    channelMap[channel].count++
    channelMap[channel].revenue += order.fGesamtsumme || 0
  }
  
  // Bestimme Primär-Kanal (meiste Bestellungen)
  let primary = 'unknown'
  let maxCount = 0
  
  const channels = Object.entries(channelMap).map(([name, data]) => {
    if (data.count > maxCount) {
      maxCount = data.count
      primary = name
    }
    return { name, count: data.count, revenue: data.revenue }
  })
  
  return { primary, channels }
}

/**
 * Analysiert Produktgruppen aus Bestellungen
 */
export function analyzeProductGroups(bestellungen: any[]): Array<{
  name: string
  category: string
  count: number
  revenue: number
  percentage: number
}> {
  
  const groupMap: Record<string, { count: number; revenue: number }> = {}
  let totalRevenue = 0
  
  for (const order of bestellungen) {
    // Hier müssten wir die Bestellpositionen laden
    // Für jetzt: Placeholder mit Kategorie aus Artikel
    const category = order.cKategorie || 'Sonstige'
    
    if (!groupMap[category]) {
      groupMap[category] = { count: 0, revenue: 0 }
    }
    
    groupMap[category].count++
    groupMap[category].revenue += order.fGesamtsumme || 0
    totalRevenue += order.fGesamtsumme || 0
  }
  
  // Konvertiere zu Array und berechne Prozente
  return Object.entries(groupMap).map(([name, data]) => ({
    name,
    category: name,
    count: data.count,
    revenue: data.revenue,
    percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
  })).sort((a, b) => b.revenue - a.revenue)
}

/**
 * Berechnet Bestell-Frequenz (Bestellungen pro Jahr)
 */
export function calculateOrderFrequency(firstOrder: Date, lastOrder: Date, totalOrders: number): number {
  const daysDiff = (lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24)
  const yearsDiff = daysDiff / 365
  
  if (yearsDiff < 0.1) return totalOrders // Weniger als 1 Monat
  
  return totalOrders / yearsDiff
}

/**
 * Kanal-Namen für UI
 */
export const CHANNEL_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  shop: { name: 'Online-Shop', icon: '🛒', color: 'primary' },
  direktvertrieb: { name: 'Direktvertrieb', icon: '📞', color: 'success' },
  amazon: { name: 'Amazon', icon: '📦', color: 'warning' },
  ebay: { name: 'eBay', icon: '🏷️', color: 'info' },
  otto: { name: 'Otto', icon: '🏢', color: 'secondary' },
  unknown: { name: 'Unbekannt', icon: '❓', color: 'secondary' }
}
