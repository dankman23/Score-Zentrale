/**
 * eBay Finances API Integration
 * Dokumentation: https://developer.ebay.com/api-docs/sell/finances/overview.html
 */

interface EbayConfig {
  env: 'SANDBOX' | 'PRODUCTION'
  appId: string
  devId: string
  certId: string
  userToken: string
  marketplace: string
}

interface EbayTransaction {
  transactionId: string
  orderId: string
  buyerUsername: string
  amount: {
    value: string
    currency: string
  }
  transactionDate: string
  transactionType: string
  transactionStatus: string
  paymentMethod: string
  fees: Array<{
    feeType: string
    amount: {
      value: string
      currency: string
    }
  }>
  references: Array<{
    referenceId: string
    referenceType: string
  }>
}

/**
 * eBay API Client
 */
export class EbayFinancesAPI {
  private config: EbayConfig
  private baseUrl: string

  constructor() {
    this.config = {
      env: (process.env.EBAY_ENV as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
      appId: process.env.EBAY_APP_ID || '',
      devId: process.env.EBAY_DEV_ID || '',
      certId: process.env.EBAY_CERT_ID || '',
      userToken: process.env.EBAY_USER_TOKEN || '',
      marketplace: process.env.EBAY_MARKETPLACE || 'EBAY_DE'
    }

    // API Base URLs
    this.baseUrl = this.config.env === 'SANDBOX'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com'
  }

  /**
   * Validiert die Konfiguration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!this.config.appId) errors.push('EBAY_APP_ID fehlt in .env')
    if (!this.config.devId) errors.push('EBAY_DEV_ID fehlt in .env')
    if (!this.config.certId) errors.push('EBAY_CERT_ID fehlt in .env')
    if (!this.config.userToken) errors.push('EBAY_USER_TOKEN fehlt in .env (bitte User Token generieren)')

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Generiert OAuth2 Access Token
   * Dokumentation: https://developer.ebay.com/api-docs/static/oauth-credentials-grant-flow.html
   */
  async getAccessToken(): Promise<string> {
    // Für User Token nutzen wir den bereits generierten Token
    // Alternativ: OAuth2 Client Credentials Flow für App-Token
    
    if (this.config.userToken) {
      return this.config.userToken
    }

    // Client Credentials Flow (falls kein User Token)
    const credentials = Buffer.from(`${this.config.appId}:${this.config.certId}`).toString('base64')
    
    const response = await fetch(`${this.baseUrl}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope/sell.finances'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`eBay OAuth failed: ${error}`)
    }

    const data = await response.json()
    return data.access_token
  }

  /**
   * Holt Transaktionen aus der eBay Finances API
   * 
   * @param fromDate Startdatum (ISO 8601)
   * @param toDate Enddatum (ISO 8601)
   * @param limit Max. Anzahl Transaktionen
   */
  async getTransactions(
    fromDate: string,
    toDate: string,
    limit: number = 200
  ): Promise<EbayTransaction[]> {
    const validation = this.validateConfig()
    if (!validation.valid) {
      throw new Error(`eBay Config ungültig: ${validation.errors.join(', ')}`)
    }

    const accessToken = await this.getAccessToken()

    // Finances API: getTransactions
    // https://developer.ebay.com/api-docs/sell/finances/resources/transaction/methods/getTransactions
    const url = new URL(`${this.baseUrl}/sell/finances/v1/transaction`)
    url.searchParams.append('filter', `transactionDate:[${fromDate}..${toDate}]`)
    url.searchParams.append('limit', limit.toString())
    url.searchParams.append('sort', 'transactionDate')

    console.log(`[eBay API] Fetching transactions: ${fromDate} to ${toDate}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': this.config.marketplace
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`[eBay API] Error:`, error)
      throw new Error(`eBay API Error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    console.log(`[eBay API] Gefundene Transaktionen: ${data.transactions?.length || 0}`)

    return data.transactions || []
  }

  /**
   * Holt Payout-Details (Auszahlungen)
   */
  async getPayouts(fromDate: string, toDate: string): Promise<any[]> {
    const validation = this.validateConfig()
    if (!validation.valid) {
      throw new Error(`eBay Config ungültig: ${validation.errors.join(', ')}`)
    }

    const accessToken = await this.getAccessToken()

    const url = new URL(`${this.baseUrl}/sell/finances/v1/payout`)
    url.searchParams.append('filter', `payoutDate:[${fromDate}..${toDate}]`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': this.config.marketplace
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`[eBay API] Error:`, error)
      throw new Error(`eBay API Error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    console.log(`[eBay API] Gefundene Payouts: ${data.payouts?.length || 0}`)

    return data.payouts || []
  }

  /**
   * Transformiert eBay Transaction zu unserem einheitlichen Format
   */
  transformTransaction(transaction: EbayTransaction): any {
    const amount = parseFloat(transaction.amount.value)
    const totalFees = transaction.fees?.reduce((sum, fee) => {
      return sum + parseFloat(fee.amount.value)
    }, 0) || 0

    // Finde Order ID aus References
    const orderRef = transaction.references?.find(r => r.referenceType === 'ORDER_ID')
    const orderId = orderRef?.referenceId || transaction.orderId || ''

    return {
      transactionId: transaction.transactionId,
      orderId: orderId,
      datum: transaction.transactionDate,
      datumDate: new Date(transaction.transactionDate),
      betrag: amount,
      waehrung: transaction.amount.currency,
      gebuehren: totalFees,
      nettoBetrag: amount - totalFees,
      
      // Gegenkonto / Kunde
      gegenkonto: transaction.buyerUsername || 'eBay Käufer',
      kundenName: transaction.buyerUsername,
      
      // Beschreibung
      verwendungszweck: `${transaction.transactionType} - Order ${orderId}`,
      beschreibung: transaction.transactionType,
      
      // Status
      status: transaction.transactionStatus,
      zahlungsart: transaction.paymentMethod || 'eBay Managed Payments',
      
      // Metadaten
      transaktionsTyp: transaction.transactionType,
      fees: transaction.fees,
      
      // Import-Info
      importDatum: new Date(),
      quelle: 'eBay Payments',
      sourceSystem: 'ebay'
    }
  }
}

/**
 * Singleton Instance
 */
let ebayApiInstance: EbayFinancesAPI | null = null

export function getEbayAPI(): EbayFinancesAPI {
  if (!ebayApiInstance) {
    ebayApiInstance = new EbayFinancesAPI()
  }
  return ebayApiInstance
}
