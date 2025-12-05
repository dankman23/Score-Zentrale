/**
 * JTL-Customer-Matcher
 * Prüft ob ein Prospect bereits als Kunde in JTL-Wawi existiert
 * 
 * Matching-Strategien:
 * 1. Exakte Firmenname-Übereinstimmung
 * 2. Fuzzy-Matching (Levenshtein-Distance)
 * 3. Domain-Matching (Email-Domain vs. Website)
 */

import { connectToMSSQLRead } from '../app/lib/db/mssql'

export interface JTLCustomerMatch {
  matched: boolean
  confidence: number // 0-100%
  matchType: 'exact' | 'fuzzy' | 'domain' | 'none'
  jtlCustomer?: {
    kKunde: number
    cFirma: string
    cEmail: string
    cHomepage: string
    cOrt: string
    nUmsatzGesamt: number
  }
}

/**
 * Normalisiert Firmennamen für besseres Matching
 * Entfernt: GmbH, AG, e.K., Rechtsformen, Sonderzeichen
 */
function normalizeFirmenname(name: string): string {
  if (!name) return ''
  
  return name
    .toLowerCase()
    .trim()
    // Entferne Rechtsformen
    .replace(/\s+(gmbh|ag|kg|ohg|gbr|e\.k\.|ug|mbh|se|co\.|co|ltd|limited)/gi, '')
    // Entferne Sonderzeichen
    .replace(/[^\w\s]/g, '')
    // Entferne mehrfache Leerzeichen
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrahiert Domain aus URL oder Email
 * www.firma.de → firma.de
 * info@firma.de → firma.de
 */
function extractDomain(input: string): string {
  if (!input) return ''
  
  // Email-Format
  if (input.includes('@')) {
    return input.split('@')[1].toLowerCase()
  }
  
  // URL-Format
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`)
    return url.hostname.replace(/^www\./, '').toLowerCase()
  } catch (e) {
    return input.replace(/^www\./, '').toLowerCase()
  }
}

/**
 * Berechnet Levenshtein-Distance zwischen zwei Strings
 * Gibt Similarity-Score 0-1 zurück
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (!str1 || !str2) return 0.0
  
  const len1 = str1.length
  const len2 = str2.length
  const maxLen = Math.max(len1, len2)
  
  if (maxLen === 0) return 1.0
  
  // Levenshtein Distance Matrix
  const matrix: number[][] = []
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }
  
  const distance = matrix[len1][len2]
  return 1 - (distance / maxLen)
}

/**
 * Prüft ob ein Prospect bereits als JTL-Kunde existiert
 * 
 * @param companyName - Firmenname des Prospects
 * @param website - Website-URL des Prospects
 * @param email - Email-Adresse des Prospects (optional)
 * @returns JTLCustomerMatch mit Matching-Info
 */
export async function checkJTLCustomerMatch(
  companyName: string,
  website: string,
  email?: string
): Promise<JTLCustomerMatch> {
  
  console.log(`[JTL-Matcher] Checking: ${companyName} (${website})`)
  
  try {
    const pool = await connectToMSSQLRead()
    
    // Normalisierte Werte für Matching
    const normalizedName = normalizeFirmenname(companyName)
    const prospectDomain = extractDomain(website)
    const prospectEmailDomain = email ? extractDomain(email) : null
    
    console.log(`[JTL-Matcher] Normalized: "${normalizedName}", Domain: ${prospectDomain}`)
    
    // SQL-Query: Lade alle aktiven Kunden
    // Filtern nach: Nicht gelöscht, hat Firma-Name
    const result = await pool.request().query(`
      SELECT TOP 500
        k.kKunde,
        k.cFirma,
        k.cMail as cEmail,
        k.cWWW as cHomepage,
        k.cOrt,
        ISNULL(SUM(r.fGesamtsumme), 0) as nUmsatzGesamt
      FROM tKunde k
      LEFT JOIN tRechnung r ON r.kKunde = k.kKunde
      WHERE 
        k.nRegistriert = 1
        AND k.cFirma IS NOT NULL
        AND k.cFirma != ''
      GROUP BY k.kKunde, k.cFirma, k.cMail, k.cWWW, k.cOrt
      ORDER BY nUmsatzGesamt DESC
    `)
    
    const customers = result.recordset
    console.log(`[JTL-Matcher] Loaded ${customers.length} JTL customers for matching`)
    
    // Matching-Loop
    let bestMatch: any = null
    let bestScore = 0
    let bestType: 'exact' | 'fuzzy' | 'domain' = 'fuzzy'
    
    for (const customer of customers) {
      const jtlName = normalizeFirmenname(customer.cFirma)
      const jtlDomain = customer.cHomepage ? extractDomain(customer.cHomepage) : null
      const jtlEmailDomain = customer.cEmail ? extractDomain(customer.cEmail) : null
      
      // 1. Exakte Name-Übereinstimmung (100%)
      if (normalizedName === jtlName) {
        bestMatch = customer
        bestScore = 100
        bestType = 'exact'
        break // Perfektes Match gefunden!
      }
      
      // 2. Domain-Matching (95%)
      if (prospectDomain && jtlDomain && prospectDomain === jtlDomain) {
        if (bestScore < 95) {
          bestMatch = customer
          bestScore = 95
          bestType = 'domain'
        }
      }
      
      // 3. Email-Domain-Matching (90%)
      if (prospectEmailDomain && jtlEmailDomain && prospectEmailDomain === jtlEmailDomain) {
        if (bestScore < 90) {
          bestMatch = customer
          bestScore = 90
          bestType = 'domain'
        }
      }
      
      // 4. Fuzzy-Name-Matching (threshold: 85%)
      const similarity = calculateSimilarity(normalizedName, jtlName)
      const fuzzyScore = Math.round(similarity * 100)
      
      if (fuzzyScore >= 85 && fuzzyScore > bestScore) {
        bestMatch = customer
        bestScore = fuzzyScore
        bestType = 'fuzzy'
      }
    }
    
    // Ergebnis
    if (bestMatch && bestScore >= 80) {
      console.log(`[JTL-Matcher] ✅ MATCH FOUND! ${bestMatch.cFirma} (${bestScore}% confidence, type: ${bestType})`)
      
      return {
        matched: true,
        confidence: bestScore,
        matchType: bestType,
        jtlCustomer: {
          kKunde: bestMatch.kKunde,
          cFirma: bestMatch.cFirma,
          cEmail: bestMatch.cEmail,
          cHomepage: bestMatch.cHomepage,
          cOrt: bestMatch.cOrt,
          nUmsatzGesamt: bestMatch.nUmsatzGesamt
        }
      }
    } else {
      console.log(`[JTL-Matcher] ❌ No match found (best score: ${bestScore}%)`)
      
      return {
        matched: false,
        confidence: 0,
        matchType: 'none'
      }
    }
    
  } catch (error: any) {
    console.error('[JTL-Matcher] Error:', error)
    
    // Bei Fehler: Assume no match (fail-safe)
    return {
      matched: false,
      confidence: 0,
      matchType: 'none'
    }
  }
}

/**
 * Batch-Check: Prüft mehrere Prospects auf einmal
 */
export async function batchCheckJTLCustomers(
  prospects: Array<{ company_name: string; website: string; email?: string }>
): Promise<Map<string, JTLCustomerMatch>> {
  
  const results = new Map<string, JTLCustomerMatch>()
  
  for (const prospect of prospects) {
    const match = await checkJTLCustomerMatch(
      prospect.company_name,
      prospect.website,
      prospect.email
    )
    results.set(prospect.website, match)
  }
  
  return results
}
