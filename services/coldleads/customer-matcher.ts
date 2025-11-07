/**
 * Customer Matcher - JTL-Wawi Integration
 * Matched Prospects mit bestehenden Kunden aus JTL
 */

import { getSqlConnection } from '@/lib/db/mssql'

interface JTLCustomer {
  id: number
  name: string
  email: string | null
  website: string | null
}

interface MatchResult {
  is_match: boolean
  confidence: number  // 0-100
  matched_customer_id: number | null
  matched_customer_name: string | null
  match_type: 'exact_domain' | 'fuzzy_name' | 'email_domain' | 'none'
  reason: string
}

/**
 * Prüft ob ein Prospect bereits Kunde in JTL ist
 */
export async function matchProspectWithJTLCustomer(
  companyName: string,
  website: string,
  contactEmails: string[] = []
): Promise<MatchResult> {
  
  try {
    const pool = await getSqlConnection()
    
    // Alle aktiven Kunden aus JTL holen
    const result = await pool.request().query(`
      SELECT 
        kKunde as id,
        cName as name,
        cMail as email,
        cWWW as website
      FROM tKunde
      WHERE nAktiv = 1
    `)
    
    const customers: JTLCustomer[] = result.recordset
    
    // 1. Domain-Match (höchste Priorität)
    const prospectDomain = extractDomain(website)
    if (prospectDomain) {
      for (const customer of customers) {
        if (customer.website) {
          const customerDomain = extractDomain(customer.website)
          if (customerDomain === prospectDomain) {
            return {
              is_match: true,
              confidence: 95,
              matched_customer_id: customer.id,
              matched_customer_name: customer.name,
              match_type: 'exact_domain',
              reason: `Domain-Match: ${prospectDomain}`
            }\n          }\n        }\n        \n        // Email-Domain-Match\n        if (customer.email) {\n          const emailDomain = customer.email.split('@')[1]\n          if (emailDomain && prospectDomain.includes(emailDomain)) {\n            return {\n              is_match: true,\n              confidence: 85,\n              matched_customer_id: customer.id,\n              matched_customer_name: customer.name,\n              match_type: 'email_domain',\n              reason: `Email-Domain-Match: ${emailDomain}`\n            }\n          }\n        }\n      }\n    }\n    \n    // 2. Fuzzy Name-Match\n    for (const customer of customers) {\n      const similarity = calculateNameSimilarity(companyName, customer.name)\n      if (similarity >= 85) {\n        return {\n          is_match: true,\n          confidence: similarity,\n          matched_customer_id: customer.id,\n          matched_customer_name: customer.name,\n          match_type: 'fuzzy_name',\n          reason: `Namens-Ähnlichkeit: ${similarity}%`\n        }\n      }\n    }\n    \n    // 3. Keine Übereinstimmung\n    return {\n      is_match: false,\n      confidence: 0,\n      matched_customer_id: null,\n      matched_customer_name: null,\n      match_type: 'none',\n      reason: 'Kein Match gefunden'\n    }\n    \n  } catch (error: any) {\n    console.error('[CustomerMatcher] Error:', error)\n    // Bei Fehler: Kein Match zurückgeben\n    return {\n      is_match: false,\n      confidence: 0,\n      matched_customer_id: null,\n      matched_customer_name: null,\n      match_type: 'none',\n      reason: `Fehler bei Matching: ${error.message}`\n    }\n  }\n}\n\n/**\n * Extrahiert Domain aus URL\n */\nfunction extractDomain(url: string): string | null {\n  try {\n    // Normalisiere URL\n    let normalized = url.trim().toLowerCase()\n    if (!normalized.startsWith('http')) {\n      normalized = 'https://' + normalized\n    }\n    \n    const urlObj = new URL(normalized)\n    let domain = urlObj.hostname\n    \n    // Entferne www.\n    domain = domain.replace(/^www\\./, '')\n    \n    return domain\n  } catch {\n    return null\n  }\n}\n\n/**\n * Berechnet Namens-Ähnlichkeit (Levenshtein-basiert, vereinfacht)\n */\nfunction calculateNameSimilarity(name1: string, name2: string): number {\n  // Normalisiere Namen\n  const normalize = (s: string) => s\n    .toLowerCase()\n    .replace(/gmbh|ag|kg|ohg|gbr|ug|mbh|co\\.|&|\\.|,/g, '')\n    .replace(/\\s+/g, ' ')\n    .trim()\n  \n  const n1 = normalize(name1)\n  const n2 = normalize(name2)\n  \n  // Exakte Übereinstimmung\n  if (n1 === n2) return 100\n  \n  // Einfacher String-Vergleich\n  if (n1.includes(n2) || n2.includes(n1)) return 90\n  \n  // Levenshtein-Distanz (vereinfacht)\n  const distance = levenshteinDistance(n1, n2)\n  const maxLength = Math.max(n1.length, n2.length)\n  const similarity = (1 - distance / maxLength) * 100\n  \n  return Math.round(similarity)\n}\n\n/**\n * Levenshtein-Distanz (Edit-Distance)\n */\nfunction levenshteinDistance(s1: string, s2: string): number {\n  const len1 = s1.length\n  const len2 = s2.length\n  const matrix: number[][] = []\n  \n  for (let i = 0; i <= len1; i++) {\n    matrix[i] = [i]\n  }\n  \n  for (let j = 0; j <= len2; j++) {\n    matrix[0][j] = j\n  }\n  \n  for (let i = 1; i <= len1; i++) {\n    for (let j = 1; j <= len2; j++) {\n      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1\n      matrix[i][j] = Math.min(\n        matrix[i - 1][j] + 1,      // deletion\n        matrix[i][j - 1] + 1,      // insertion\n        matrix[i - 1][j - 1] + cost // substitution\n      )\n    }\n  }\n  \n  return matrix[len1][len2]\n}\n"}