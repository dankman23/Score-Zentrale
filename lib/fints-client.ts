/**
 * FinTS/HBCI Client für deutsche Banken
 * Aktuell: Commerzbank
 */

import { PinTanClient } from 'node-fints'

interface FinTSConfig {
  blz: string
  user: string
  pin: string
  url: string
}

interface FinTSAccount {
  iban: string
  bic?: string
  accountNumber: string
  subAccount?: string
  blz: string
  owner?: string
  type?: string
  currency?: string
}

interface FinTSTransaction {
  date: Date
  valueDate: Date
  amount: number
  currency: string
  purpose: string
  counterpartyName?: string
  counterpartyIban?: string
  counterpartyBic?: string
  bookingText?: string
  bookingKey?: string
  primanotaNumber?: string
  externalId: string
}

export class FinTSBankClient {
  private client: PinTanClient | null = null
  private config: FinTSConfig

  constructor(config: FinTSConfig) {
    this.config = config
  }

  /**
   * Erstellt FinTS Client
   */
  private createClient(): PinTanClient {
    return new PinTanClient({
      url: this.config.url,
      name: this.config.user,
      pin: this.config.pin,
      blz: this.config.blz,
      productId: '9FA6681DEC0CF3046BFC2F8A6', // Beispiel-Produkt-ID
      productVersion: '1.0',
    })
  }

  /**
   * Holt alle Konten
   */
  async getAccounts(): Promise<FinTSAccount[]> {
    try {
      this.client = this.createClient()
      
      const accounts = await this.client.accounts()
      
      return accounts.map((account: any) => ({
        iban: account.iban,
        bic: account.bic,
        accountNumber: account.accountNumber,
        subAccount: account.subAccount,
        blz: account.blz,
        owner: account.accountOwnerName || account.accountName,
        type: account.accountType,
        currency: account.currency || 'EUR',
      }))
    } catch (error) {
      console.error('[FinTS] Error fetching accounts:', error)
      throw new Error(`FinTS: Konten konnten nicht abgerufen werden: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      // FinTS Client hat keine close() Methode
      this.client = null
    }
  }

  /**
   * Holt Transaktionen für ein Konto
   */
  async getTransactions(
    accountIban: string,
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<FinTSTransaction[]> {
    try {
      this.client = this.createClient()
      
      // Hole alle Konten
      const accounts = await this.client.accounts()
      
      // Finde das richtige Konto
      const account = accounts.find((acc: any) => acc.iban === accountIban)
      if (!account) {
        throw new Error(`Konto mit IBAN ${accountIban} nicht gefunden`)
      }

      console.log(`[FinTS] Fetching transactions for ${accountIban} from ${startDate.toISOString()} to ${endDate.toISOString()}`)

      // Hole Transaktionen
      const statements = await this.client.statements(account, startDate, endDate)
      
      const transactions: FinTSTransaction[] = []
      
      // Parse Statements
      for (const statement of statements) {
        if (statement.transactions && Array.isArray(statement.transactions)) {
          for (const txn of statement.transactions) {
            transactions.push({
              date: txn.entryDate || txn.valueDate,
              valueDate: txn.valueDate,
              amount: txn.amount,
              currency: txn.currency || 'EUR',
              purpose: this.cleanPurpose(txn.purpose || txn.description || ''),
              counterpartyName: txn.remittanceName || txn.applicantName || null,
              counterpartyIban: txn.remittanceIban || txn.applicantIban || null,
              counterpartyBic: txn.remittanceBic || txn.applicantBic || null,
              bookingText: txn.bookingText || null,
              bookingKey: txn.bookingKey || null,
              primanotaNumber: txn.primanotaNumber || null,
              externalId: this.generateExternalId(txn),
            })
          }
        }
      }

      console.log(`[FinTS] Found ${transactions.length} transactions`)
      
      return transactions
    } catch (error) {
      console.error('[FinTS] Error fetching transactions:', error)
      throw new Error(`FinTS: Transaktionen konnten nicht abgerufen werden: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      // FinTS Client hat keine close() Methode
      this.client = null
    }
  }

  /**
   * Holt Kontostand
   */
  async getBalance(accountIban: string): Promise<{ amount: number; currency: string; date: Date }> {
    try {
      this.client = this.createClient()
      
      const accounts = await this.client.accounts()
      const account = accounts.find((acc: any) => acc.iban === accountIban)
      
      if (!account) {
        throw new Error(`Konto mit IBAN ${accountIban} nicht gefunden`)
      }

      const balance = await this.client.balance(account)
      
      return {
        amount: balance.value,
        currency: balance.currency || 'EUR',
        date: new Date(),
      }
    } catch (error) {
      console.error('[FinTS] Error fetching balance:', error)
      throw new Error(`FinTS: Kontostand konnte nicht abgerufen werden: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      // FinTS Client hat keine close() Methode
      this.client = null
    }
  }

  /**
   * Bereinigt Verwendungszweck (entfernt Zeilenumbrüche, Mehrfach-Leerzeichen)
   */
  private cleanPurpose(purpose: string): string {
    return purpose
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Generiert eindeutige ID für Transaktion
   */
  private generateExternalId(txn: any): string {
    const date = (txn.entryDate || txn.valueDate).toISOString().split('T')[0]
    const amount = Math.abs(txn.amount).toFixed(2)
    const purpose = (txn.purpose || txn.description || '').substring(0, 20)
    return `${date}_${amount}_${purpose}`.replace(/[^a-zA-Z0-9_.-]/g, '_')
  }

  /**
   * Formatiert Transaktion für FIBU-Integration
   */
  formatForFibu(transaction: FinTSTransaction, bankName: string = 'Commerzbank') {
    return {
      transactionId: transaction.externalId,
      datum: transaction.date.toISOString(),
      datumDate: transaction.date,
      wertstellungsdatum: transaction.valueDate.toISOString(),
      betrag: transaction.amount,
      waehrung: transaction.currency,
      verwendungszweck: transaction.purpose,
      gegenkonto: transaction.counterpartyName || null,
      gegenkontoIban: transaction.counterpartyIban || null,
      gegenkontoBic: transaction.counterpartyBic || null,
      buchungstext: transaction.bookingText || null,
      buchungsschluessel: transaction.bookingKey || null,
      primanota: transaction.primanotaNumber || null,
      quelle: bankName,
      ursprungsdaten: transaction,
    }
  }
}

// Singleton für Commerzbank
let commerzbankClient: FinTSBankClient | null = null

export function getCommerzbankClient(): FinTSBankClient {
  if (!commerzbankClient) {
    const config: FinTSConfig = {
      blz: process.env.COMMERZBANK_BLZ || '',
      user: process.env.COMMERZBANK_USER || '',
      pin: process.env.COMMERZBANK_PIN || '',
      url: process.env.COMMERZBANK_URL || 'https://fints.commerzbank.de/fints',
    }

    if (!config.blz || !config.user || !config.pin) {
      throw new Error('Commerzbank FinTS credentials not configured')
    }

    commerzbankClient = new FinTSBankClient(config)
  }
  
  return commerzbankClient
}
