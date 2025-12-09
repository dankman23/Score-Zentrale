/**
 * PayPal Transaction Search API Client
 * Dokumentation: https://developer.paypal.com/docs/api/transaction-search/v1/
 */

interface PayPalAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

interface PayPalTransactionInfo {
  transaction_id: string
  transaction_event_code: string
  transaction_initiation_date: string
  transaction_updated_date: string
  transaction_amount: {
    currency_code: string
    value: string
  }
  fee_amount?: {
    currency_code: string
    value: string
  }
  transaction_status: string
  transaction_subject?: string
  transaction_note?: string
  invoice_id?: string
  custom_field?: string
  protection_eligibility?: string
}

interface PayPalPayerInfo {
  account_id?: string
  email_address?: string
  address_status?: string
  payer_status?: string
  payer_name?: {
    given_name?: string
    surname?: string
    alternate_full_name?: string
  }
  country_code?: string
}

interface PayPalShippingInfo {
  name?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    country_code?: string
    postal_code?: string
  }
}

interface PayPalCartInfo {
  item_details?: Array<{
    item_code?: string
    item_name?: string
    item_description?: string
    item_quantity?: string
    item_unit_price?: {
      currency_code: string
      value: string
    }
    item_amount?: {
      currency_code: string
      value: string
    }
    total_item_amount?: {
      currency_code: string
      value: string
    }
  }>
}

interface PayPalTransaction {
  transaction_info: PayPalTransactionInfo
  payer_info?: PayPalPayerInfo
  shipping_info?: PayPalShippingInfo
  cart_info?: PayPalCartInfo
}

interface PayPalTransactionSearchResponse {
  transaction_details: PayPalTransaction[]
  account_number?: string
  start_date?: string
  end_date?: string
  last_refreshed_datetime?: string
  page?: number
  total_items?: number
  total_pages?: number
  links?: Array<{
    href: string
    rel: string
    method: string
  }>
}

export class PayPalClient {
  private clientId: string
  private clientSecret: string
  private baseUrl: string
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || ''
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || ''
    
    // Bestimme die API URL basierend auf dem Modus (configurable via env vars)
    const mode = process.env.PAYPAL_MODE || 'live'
    const defaultUrl = mode === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com'
    this.baseUrl = process.env.PAYPAL_API_URL || defaultUrl

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal credentials not configured in environment variables')
    }
  }

  /**
   * Holt ein OAuth Access Token
   */
  private async getAccessToken(): Promise<string> {
    // Prüfe ob Token noch gültig ist (mit 5min Puffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.accessToken
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`PayPal OAuth failed: ${response.status} ${errorText}`)
      }

      const data: PayPalAuthResponse = await response.json()
      
      this.accessToken = data.access_token
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000)
      
      return this.accessToken
    } catch (error) {
      console.error('PayPal OAuth error:', error)
      throw new Error(`Failed to get PayPal access token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sucht Transaktionen für einen Zeitraum
   * @param startDate Format: YYYY-MM-DDTHH:MM:SS-0000 oder YYYY-MM-DD
   * @param endDate Format: YYYY-MM-DDTHH:MM:SS-0000 oder YYYY-MM-DD
   * @param page Seitenzahl (1-basiert)
   * @param pageSize Anzahl Transaktionen pro Seite (max 500)
   */
  async searchTransactions(
    startDate: string,
    endDate: string,
    page: number = 1,
    pageSize: number = 500
  ): Promise<PayPalTransactionSearchResponse> {
    const token = await this.getAccessToken()

    // Formatiere Datum zu ISO 8601 mit Timezone
    const formatDate = (date: string): string => {
      // Wenn bereits vollständig formatiert (mit Zeit und Timezone)
      if (date.includes('T') && (date.includes('+') || date.includes('Z'))) {
        return date
      }
      // Wenn nur Datum (YYYY-MM-DD), füge Start/End Zeit hinzu
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return `${date}T00:00:00-0000`
      }
      // Wenn Datum mit Zeit aber ohne Timezone
      if (date.includes('T') && !date.includes('+') && !date.endsWith('Z')) {
        return `${date}-0000`
      }
      return date
    }

    const params = new URLSearchParams({
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      fields: 'all', // Vollständige Details inkl. Gebühren
      page_size: pageSize.toString(),
      page: page.toString(),
    })

    try {
      const response = await fetch(
        `${this.baseUrl}/v1/reporting/transactions?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`PayPal API request failed: ${response.status} ${errorText}`)
      }

      const data: PayPalTransactionSearchResponse = await response.json()
      return data
    } catch (error) {
      console.error('PayPal transaction search error:', error)
      throw new Error(`Failed to search PayPal transactions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Holt alle Transaktionen für einen Zeitraum (mit Pagination)
   */
  async getAllTransactions(
    startDate: string,
    endDate: string
  ): Promise<PayPalTransaction[]> {
    const allTransactions: PayPalTransaction[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.searchTransactions(startDate, endDate, page, 500)
      
      if (response.transaction_details && response.transaction_details.length > 0) {
        allTransactions.push(...response.transaction_details)
        
        // Prüfe ob es weitere Seiten gibt
        const nextLink = response.links?.find(link => link.rel === 'next')
        hasMore = !!nextLink
        page++
      } else {
        hasMore = false
      }

      // Sicherheits-Limit: max 20 Seiten (= 10.000 Transaktionen)
      if (page > 20) {
        console.warn('PayPal: Reached maximum page limit (20 pages)')
        break
      }
    }

    return allTransactions
  }

  /**
   * Extrahiert Gebühren aus einer Transaktion
   */
  extractFee(transaction: PayPalTransaction): number {
    if (transaction.transaction_info.fee_amount) {
      return parseFloat(transaction.transaction_info.fee_amount.value) || 0
    }
    return 0
  }

  /**
   * Berechnet Netto-Betrag (Betrag - Gebühren)
   */
  calculateNetAmount(transaction: PayPalTransaction): number {
    const gross = parseFloat(transaction.transaction_info.transaction_amount.value) || 0
    const fee = this.extractFee(transaction)
    return gross - fee
  }

  /**
   * Prüft ob eine Transaktion erfolgreich abgeschlossen wurde
   */
  isSuccessfulTransaction(transaction: PayPalTransaction): boolean {
    const status = transaction.transaction_info.transaction_status?.toUpperCase()
    return status === 'S' || status === 'SUCCESS' || status === 'COMPLETED'
  }

  /**
   * Formatiert Transaktion für FIBU-Integration
   */
  formatForFibu(transaction: PayPalTransaction) {
    const info = transaction.transaction_info
    const payer = transaction.payer_info
    
    return {
      transactionId: info.transaction_id,
      datum: info.transaction_initiation_date,
      betrag: parseFloat(info.transaction_amount.value),
      waehrung: info.transaction_amount.currency_code,
      gebuehr: this.extractFee(transaction),
      nettoBetrag: this.calculateNetAmount(transaction),
      status: info.transaction_status,
      ereignis: info.transaction_event_code,
      betreff: info.transaction_subject || '',
      notiz: info.transaction_note || '',
      rechnungsNr: info.invoice_id || null,
      kundenEmail: payer?.email_address || null,
      kundenName: payer?.payer_name?.alternate_full_name || 
                   `${payer?.payer_name?.given_name || ''} ${payer?.payer_name?.surname || ''}`.trim() || null,
      quelle: 'PayPal',
      ursprungsdaten: transaction,
    }
  }
}

// Singleton Instanz
let paypalClient: PayPalClient | null = null

export function getPayPalClient(): PayPalClient {
  if (!paypalClient) {
    paypalClient = new PayPalClient()
  }
  return paypalClient
}
