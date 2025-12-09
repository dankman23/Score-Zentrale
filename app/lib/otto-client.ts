/**
 * Otto Partner Connect API Client
 * Dokumentation: https://api.otto.market/docs/
 * Receipts API v3: https://api.otto.market/docs/functional-interfaces/receipts/
 */

interface OttoClientConfig {
  clientId: string
  clientSecret: string
  apiUrl: string
}

interface OttoReceipt {
  receiptNumber: string
  salesOrderId: string
  orderDate: string
  receiptDate: string
  totalGrossAmount: {
    amount: number
    currency: string
  }
  totalNetAmount?: {
    amount: number
    currency: string
  }
  receiptType: 'PURCHASE' | 'REFUND'
  isRealReceipt: boolean
  links?: any[]
}

export class OttoClient {
  private config: OttoClientConfig
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: OttoClientConfig) {
    this.config = config
  }

  /**
   * Holt OAuth2 Access Token
   */
  private async getAccessToken(): Promise<string> {
    // Token ist noch gültig (mit 5 Min Puffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken
    }

    try {
      // OAuth2 Client Credentials Flow
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')
      
      const response = await fetch(`${this.config.apiUrl}/v1/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Otto OAuth failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in * 1000)
      
      console.log('[Otto] Access Token erfolgreich abgerufen')
      return this.accessToken
    } catch (error) {
      console.error('[Otto] OAuth error:', error)
      throw new Error(`Otto: Access Token konnte nicht abgerufen werden: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Holt Receipts (Rechnungen) für einen Zeitraum
   */
  async getReceipts(params: {
    from: string  // YYYY-MM-DD
    to: string    // YYYY-MM-DD
    receiptTypes?: string[]  // ['PURCHASE', 'REFUND']
    limit?: number
  }): Promise<OttoReceipt[]> {
    const token = await this.getAccessToken()

    const queryParams = new URLSearchParams({
      from: params.from,
      to: params.to,
      limit: (params.limit || 100).toString(),
    })

    if (params.receiptTypes && params.receiptTypes.length > 0) {
      params.receiptTypes.forEach(type => {
        queryParams.append('receiptTypes', type)
      })
    }

    try {
      const url = `${this.config.apiUrl}/v3/receipts?${queryParams.toString()}`
      console.log(`[Otto] Fetching receipts: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Otto API request failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      
      console.log(`[Otto] Received ${data.receipts?.length || 0} receipts`)
      
      return data.receipts || []
    } catch (error) {
      console.error('[Otto] Error fetching receipts:', error)
      throw new Error(`Otto: Receipts konnten nicht abgerufen werden: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Formatiert Receipt für FIBU-Integration
   */
  formatForFibu(receipt: OttoReceipt) {
    const isRefund = receipt.receiptType === 'REFUND'
    const amount = receipt.totalGrossAmount.amount
    
    return {
      transactionId: receipt.receiptNumber,
      datum: receipt.receiptDate,
      datumDate: new Date(receipt.receiptDate),
      bestelldatum: receipt.orderDate,
      orderId: receipt.salesOrderId,
      betrag: isRefund ? -Math.abs(amount) : amount,
      waehrung: receipt.totalGrossAmount.currency,
      nettoBetrag: receipt.totalNetAmount?.amount || null,
      typ: receipt.receiptType,
      istEchteRechnung: receipt.isRealReceipt,
      quelle: 'Otto',
      ursprungsdaten: receipt,
    }
  }
}

// Singleton
let ottoClient: OttoClient | null = null

export function getOttoClient(): OttoClient {
  if (!ottoClient) {
    const config: OttoClientConfig = {
      clientId: process.env.OTTO_CLIENT_ID || '',
      clientSecret: process.env.OTTO_CLIENT_SECRET || '',
      apiUrl: process.env.OTTO_API_URL || 'https://api.otto.market',
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Otto API Credentials nicht konfiguriert')
    }

    ottoClient = new OttoClient(config)
  }

  return ottoClient
}
