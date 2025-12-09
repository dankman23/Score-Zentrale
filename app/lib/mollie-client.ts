/**
 * Mollie API Client für Zahlungsabruf
 * Dokumentation: https://docs.mollie.com/reference/v2/payments-api
 */

import createMollieClient from '@mollie/api-client'

interface MollieClientConfig {
  accessToken: string
  refreshToken?: string
}

export class MollieClient {
  private client: any
  private config: MollieClientConfig
  private tokenExpiry: number = Date.now() + 3600 * 1000 // 1 Stunde

  constructor(config: MollieClientConfig) {
    this.config = config
    this.client = createMollieClient({ accessToken: config.accessToken })
  }

  /**
   * Token-Refresh (falls nötig)
   */
  private async refreshTokenIfNeeded(): Promise<void> {
    // Token läuft in weniger als 5 Minuten ab
    if (Date.now() > this.tokenExpiry - 300000 && this.config.refreshToken) {
      try {
        // Mollie OAuth2 Token Refresh (configurable via env var)
        const mollieTokenUrl = process.env.MOLLIE_TOKEN_URL || 'https://api.mollie.com/oauth2/tokens'
        const response = await fetch(mollieTokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.config.refreshToken,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          this.config.accessToken = data.access_token
          if (data.refresh_token) {
            this.config.refreshToken = data.refresh_token
          }
          this.tokenExpiry = Date.now() + (data.expires_in * 1000)
          
          // Erstelle neuen Client mit neuem Token
          this.client = createMollieClient({ accessToken: this.config.accessToken })
          
          console.log('[Mollie] Token erfolgreich erneuert')
        } else {
          console.error('[Mollie] Token refresh failed:', await response.text())
        }
      } catch (error) {
        console.error('[Mollie] Token refresh error:', error)
      }
    }
  }

  /**
   * Hole Payments (Zahlungen) für einen Zeitraum
   */
  async getPayments(params: {
    from?: string
    limit?: number
  } = {}): Promise<any[]> {
    await this.refreshTokenIfNeeded()

    try {
      const allPayments: any[] = []
      let nextUrl: string | null = null
      const limit = params.limit || 250 // Max 250 per request

      do {
        const response = nextUrl
          ? await this.client.payments.iterate(nextUrl)
          : await this.client.payments.page({ limit })

        // Sammle Payments
        for await (const payment of response) {
          // Filter nach Datum wenn angegeben
          if (params.from) {
            const paymentDate = new Date(payment.createdAt)
            const fromDate = new Date(params.from)
            if (paymentDate >= fromDate) {
              allPayments.push(payment)
            }
          } else {
            allPayments.push(payment)
          }
        }

        // Nächste Seite
        nextUrl = response._links?.next?.href || null
      } while (nextUrl && allPayments.length < 5000) // Max 5000 für Performance

      console.log(`[Mollie] ${allPayments.length} Payments abgerufen`)
      return allPayments
    } catch (error) {
      console.error('[Mollie] Error fetching payments:', error)
      throw new Error(`Mollie: Payments konnten nicht abgerufen werden: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Formatiert Payment für FIBU-Integration
   */
  formatForFibu(payment: any) {
    return {
      transactionId: payment.id,
      datum: payment.createdAt,
      datumDate: new Date(payment.createdAt),
      betrag: parseFloat(payment.amount.value),
      waehrung: payment.amount.currency,
      status: payment.status,
      methode: payment.method || null,
      beschreibung: payment.description || '',
      kundenName: payment.metadata?.customerName || payment.billingAddress?.givenName + ' ' + payment.billingAddress?.familyName || null,
      kundenEmail: payment.metadata?.customerEmail || payment.billingAddress?.email || null,
      rechnungsNr: payment.metadata?.invoiceId || null,
      quelle: 'Mollie',
      ursprungsdaten: payment,
    }
  }
}

// Singleton
let mollieClient: MollieClient | null = null

export function getMollieClient(): MollieClient {
  if (!mollieClient) {
    const config: MollieClientConfig = {
      accessToken: process.env.MOLLIE_ACCESS_TOKEN || '',
      refreshToken: process.env.MOLLIE_REFRESH_TOKEN || '',
    }

    if (!config.accessToken) {
      throw new Error('Mollie Access Token nicht konfiguriert')
    }

    mollieClient = new MollieClient(config)
  }

  return mollieClient
}
