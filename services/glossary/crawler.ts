/**
 * JTL-Wawi Dokumentations-Crawler
 * Crawlt https://wawi-db.jtl-software.de/tables/{VERSION}
 * und extrahiert Tabellen-Schema-Informationen
 */

interface CrawlerOptions {
  version: string
  baseUrl: string
  maxRetries?: number
  timeout?: number
}

interface TableInfo {
  name: string
  url: string
  description?: string
}

export class JTLDocCrawler {
  private version: string
  private baseUrl: string
  private maxRetries: number
  private timeout: number

  constructor(options: CrawlerOptions) {
    this.version = options.version
    this.baseUrl = options.baseUrl
    this.maxRetries = options.maxRetries || 3
    this.timeout = options.timeout || 30000
  }

  /**
   * Crawl Hauptseite und liste alle Tabellen
   */
  async crawlTableList(): Promise<TableInfo[]> {
    const url = `${this.baseUrl}/${this.version}`
    console.log(`[Crawler] Fetching table list from: ${url}`)

    try {
      const html = await this.fetchWithRetry(url)
      return this.parseTableList(html, url)
    } catch (error) {
      console.error('[Crawler] Failed to fetch table list:', error)
      throw new Error(`Failed to crawl table list: ${error}`)
    }
  }

  /**
   * Crawl einzelne Tabellen-Detail-Seite
   */
  async crawlTableDetail(tableUrl: string): Promise<any> {
    console.log(`[Crawler] Fetching table detail: ${tableUrl}`)

    try {
      const html = await this.fetchWithRetry(tableUrl)
      return this.parseTableDetail(html)
    } catch (error) {
      console.error(`[Crawler] Failed to fetch table detail ${tableUrl}:`, error)
      return null
    }
  }

  /**
   * HTTP fetch mit Retry-Logik
   */
  private async fetchWithRetry(url: string, attempt = 1): Promise<string> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Score-Zentrale-Glossar-Crawler/1.0'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.text()
    } catch (error: any) {
      if (attempt < this.maxRetries) {
        const delay = attempt * 1000
        console.warn(`[Crawler] Retry ${attempt}/${this.maxRetries} after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.fetchWithRetry(url, attempt + 1)
      }
      throw error
    }
  }

  /**
   * Parse Tabellen-Liste aus HTML
   */
  private parseTableList(html: string, baseUrl: string): TableInfo[] {
    const tables: TableInfo[] = []
    
    // Einfaches Regex-Pattern für Links zu Tabellen
    // Format: <a href="/tables/1.10.14.3/Verkauf.tAuftrag">Verkauf.tAuftrag</a>
    const linkPattern = /<a\s+href=["']([^"']*?)["'][^>]*>([\w.]+)<\/a>/gi
    
    let match
    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1]
      const name = match[2]
      
      // Nur Tabellen (enthalten Punkt im Namen wie "Verkauf.tAuftrag")
      if (name.includes('.') && name.startsWith('t')) {
        const fullUrl = href.startsWith('http') 
          ? href 
          : `${baseUrl.replace(/\/tables\/.*$/, '')}${href}`
        
        tables.push({
          name,
          url: fullUrl
        })
      }
    }

    console.log(`[Crawler] Found ${tables.length} tables`)
    return tables
  }

  /**
   * Parse Tabellen-Details aus HTML
   */
  private parseTableDetail(html: string): any {
    // Extrahiere Tabellen-Metadaten
    const table: any = {
      columns: [],
      primary_key: null,
      foreign_keys: [],
      indexes: []
    }

    // Beschreibung extrahieren
    const descMatch = html.match(/<p[^>]*class=["']?description["']?[^>]*>(.*?)<\/p>/i)
    if (descMatch) {
      table.description = this.cleanHtml(descMatch[1])
    }

    // Spalten extrahieren (Tabellen-Format)
    const columnPattern = /<tr[^>]*>\s*<td[^>]*>([\w]+)<\/td>\s*<td[^>]*>([\w()]+)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi
    
    let columnMatch
    while ((columnMatch = columnPattern.exec(html)) !== null) {
      const column = {
        name: columnMatch[1].trim(),
        type: columnMatch[2].trim(),
        nullable: columnMatch[3].toLowerCase().includes('yes') || columnMatch[3].toLowerCase().includes('null'),
        default_value: columnMatch[4].trim() || null
      }
      table.columns.push(column)
    }

    // Primary Key extrahieren
    const pkMatch = html.match(/Primary\s+Key[:\s]*<[^>]+>([\w]+)<\//i)
    if (pkMatch) {
      table.primary_key = pkMatch[1].trim()
    }

    // Foreign Keys extrahieren
    const fkPattern = /Foreign\s+Key[:\s]*(\w+)\s*→\s*([\w.]+)\((\w+)\)/gi
    let fkMatch
    while ((fkMatch = fkPattern.exec(html)) !== null) {
      table.foreign_keys.push({
        column: fkMatch[1].trim(),
        references_table: fkMatch[2].trim(),
        references_column: fkMatch[3].trim()
      })
    }

    return table
  }

  /**
   * HTML-Tags entfernen und Text bereinigen
   */
  private cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
  }
}

/**
 * Factory-Funktion für einfache Nutzung
 */
export function createCrawler(): JTLDocCrawler {
  const version = process.env.JTL_DOC_VERSION || '1.10.14.3'
  const baseUrl = process.env.JTL_DOC_BASE || 'https://wawi-db.jtl-software.de/tables'
  
  return new JTLDocCrawler({ version, baseUrl })
}
