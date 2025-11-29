/**
 * Learning Database für intelligentes Konto-Mapping
 * Speichert erfolgreiche Zuordnungen und lernt daraus
 */

import { Db } from 'mongodb'

export interface MatchingRule {
  _id?: any
  pattern: string          // z.B. "Amazon Commission", "Telekom"
  matchType: 'vendor' | 'category' | 'keyword' | 'exact'
  targetKonto: string      // SKR04 Kontonummer
  targetSteuersatz: number // 19, 7, 0
  kontoBezeichnung?: string
  confidence: number       // 0.0 - 1.0
  usageCount: number       // Wie oft erfolgreich verwendet
  lastUsed: Date
  createdBy: 'auto' | 'manual' | 'import'
  createdAt: Date
  metadata?: {
    anbieter?: string
    kategorie?: string
    notes?: string
  }
}

export interface MatchingHistory {
  _id?: any
  zahlungId: string
  zahlungBetrag: number
  zahlungDatum: Date
  zahlungText: string
  belegId?: string
  belegNr?: string
  matchMethod: string      // "re_nummer", "au_nummer", "betrag_datum", etc.
  confidence: 'high' | 'medium' | 'low'
  zuordnungsArt: 'rechnung' | 'konto'
  targetKonto?: string
  isCorrect: boolean | null  // User-Feedback: true/false/null
  correctedKonto?: string    // Falls User korrigiert hat
  createdAt: Date
  updatedAt?: Date
}

/**
 * Initialisiert Collections mit Indexes
 */
export async function initLearningCollections(db: Db) {
  const rulesCollection = db.collection('fibu_matching_rules')
  const historyCollection = db.collection('fibu_matching_history')
  
  // Indexes für Rules
  await rulesCollection.createIndex({ pattern: 1, matchType: 1 }, { unique: true })
  await rulesCollection.createIndex({ targetKonto: 1 })
  await rulesCollection.createIndex({ usageCount: -1 })  // Häufigste zuerst
  await rulesCollection.createIndex({ confidence: -1 })
  
  // Indexes für History
  await historyCollection.createIndex({ zahlungId: 1 })
  await historyCollection.createIndex({ belegId: 1 })
  await historyCollection.createIndex({ matchMethod: 1 })
  await historyCollection.createIndex({ createdAt: -1 })
  await historyCollection.createIndex({ isCorrect: 1 })
  
  console.log('[Learning DB] Collections initialized with indexes')
}

/**
 * Speichert eine neue Matching-Rule oder aktualisiert bestehende
 */
export async function saveMatchingRule(
  db: Db,
  rule: Omit<MatchingRule, '_id' | 'usageCount' | 'lastUsed' | 'createdAt'>
): Promise<void> {
  const collection = db.collection<MatchingRule>('fibu_matching_rules')
  
  const existing = await collection.findOne({
    pattern: rule.pattern,
    matchType: rule.matchType
  })
  
  if (existing) {
    // Update: Erhöhe usageCount, aktualisiere lastUsed und Confidence
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          targetKonto: rule.targetKonto,
          targetSteuersatz: rule.targetSteuersatz,
          kontoBezeichnung: rule.kontoBezeichnung,
          confidence: Math.min(1.0, existing.confidence + 0.05), // Erhöhe Confidence leicht
          lastUsed: new Date(),
          metadata: rule.metadata
        },
        $inc: { usageCount: 1 }
      }
    )
  } else {
    // Insert: Neue Rule
    await collection.insertOne({
      ...rule,
      usageCount: 1,
      lastUsed: new Date(),
      createdAt: new Date()
    })
  }
}

/**
 * Speichert Matching-History für Learning
 */
export async function saveMatchingHistory(
  db: Db,
  history: Omit<MatchingHistory, '_id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const collection = db.collection<MatchingHistory>('fibu_matching_history')
  
  const result = await collection.insertOne({
    ...history,
    createdAt: new Date()
  })
  
  return result.insertedId.toString()
}

/**
 * Findet gelernte Rule für Pattern
 */
export async function findLearnedRule(
  db: Db,
  text: string,
  matchType?: 'vendor' | 'category' | 'keyword' | 'exact'
): Promise<MatchingRule | null> {
  const collection = db.collection<MatchingRule>('fibu_matching_rules')
  
  const query: any = {}
  
  if (matchType) {
    query.matchType = matchType
  }
  
  // Suche nach exaktem Match
  const exactMatch = await collection.findOne({
    ...query,
    pattern: text
  })
  
  if (exactMatch) return exactMatch
  
  // Suche nach Teilstring-Match (case-insensitive)
  const regexMatch = await collection.findOne({
    ...query,
    pattern: { $regex: text, $options: 'i' }
  })
  
  if (regexMatch) return regexMatch
  
  // Suche nach Keywords im Text
  const keywords = text.toLowerCase().split(/\s+/)
  const keywordMatches = await collection.find({
    ...query,
    matchType: 'keyword'
  }).toArray()
  
  for (const rule of keywordMatches) {
    if (keywords.some(kw => rule.pattern.toLowerCase().includes(kw))) {
      return rule
    }
  }
  
  return null
}

/**
 * Findet häufigste Konten-Zuordnung für Vendor
 */
export async function findVendorPattern(
  db: Db,
  vendor: string
): Promise<MatchingRule | null> {
  const collection = db.collection<MatchingRule>('fibu_matching_rules')
  
  return await collection.findOne(
    {
      matchType: 'vendor',
      pattern: { $regex: vendor, $options: 'i' }
    },
    {
      sort: { usageCount: -1, confidence: -1 }  // Häufigste & sicherste
    }
  )
}

/**
 * User-Feedback: Markiert History als korrekt/inkorrekt
 */
export async function updateHistoryFeedback(
  db: Db,
  historyId: string,
  isCorrect: boolean,
  correctedKonto?: string
): Promise<void> {
  const collection = db.collection<MatchingHistory>('fibu_matching_history')
  
  await collection.updateOne(
    { _id: historyId },
    {
      $set: {
        isCorrect,
        correctedKonto,
        updatedAt: new Date()
      }
    }
  )
  
  // Wenn korrigiert wurde, erstelle neue Rule aus Korrektur
  if (!isCorrect && correctedKonto) {
    const history = await collection.findOne({ _id: historyId })
    if (history) {
      // Extrahiere Pattern aus zahlungText
      const pattern = history.zahlungText.substring(0, 50).trim()
      
      await saveMatchingRule(db, {
        pattern,
        matchType: 'keyword',
        targetKonto: correctedKonto,
        targetSteuersatz: 19, // Default, sollte User angeben
        confidence: 0.7,
        createdBy: 'manual',
        metadata: {
          notes: `Korrektur von History ${historyId}`
        }
      })
    }
  }
}

/**
 * Statistik: Erfolgsrate des Learnings
 */
export async function getLearningStats(db: Db): Promise<any> {
  const historyCollection = db.collection<MatchingHistory>('fibu_matching_history')
  const rulesCollection = db.collection<MatchingRule>('fibu_matching_rules')
  
  const [
    totalHistory,
    correctMatches,
    incorrectMatches,
    totalRules,
    autoRules,
    manualRules
  ] = await Promise.all([
    historyCollection.countDocuments(),
    historyCollection.countDocuments({ isCorrect: true }),
    historyCollection.countDocuments({ isCorrect: false }),
    rulesCollection.countDocuments(),
    rulesCollection.countDocuments({ createdBy: 'auto' }),
    rulesCollection.countDocuments({ createdBy: 'manual' })
  ])
  
  const successRate = totalHistory > 0
    ? ((correctMatches / (correctMatches + incorrectMatches)) * 100).toFixed(1)
    : 'N/A'
  
  // Top 10 Rules nach Usage
  const topRules = await rulesCollection
    .find()
    .sort({ usageCount: -1 })
    .limit(10)
    .toArray()
  
  return {
    history: {
      total: totalHistory,
      correct: correctMatches,
      incorrect: incorrectMatches,
      successRate: successRate + '%'
    },
    rules: {
      total: totalRules,
      auto: autoRules,
      manual: manualRules
    },
    topRules: topRules.map(r => ({
      pattern: r.pattern,
      konto: r.targetKonto,
      usageCount: r.usageCount,
      confidence: r.confidence
    }))
  }
}

/**
 * Import von Default-Rules (Statische Mappings)
 */
export async function importDefaultRules(db: Db): Promise<number> {
  const collection = db.collection<MatchingRule>('fibu_matching_rules')
  
  const defaultRules: Omit<MatchingRule, '_id' | 'usageCount' | 'lastUsed' | 'createdAt'>[] = [
    // Amazon
    {
      pattern: 'Commission',
      matchType: 'category',
      targetKonto: '4970',
      targetSteuersatz: 19,
      kontoBezeichnung: 'Provisionen',
      confidence: 0.95,
      createdBy: 'import',
      metadata: { anbieter: 'amazon', kategorie: 'Commission' }
    },
    {
      pattern: 'AdvertisingFee',
      matchType: 'category',
      targetKonto: '4630',
      targetSteuersatz: 19,
      kontoBezeichnung: 'Werbekosten',
      confidence: 0.95,
      createdBy: 'import',
      metadata: { anbieter: 'amazon', kategorie: 'AdvertisingFee' }
    },
    {
      pattern: 'FBAFee',
      matchType: 'category',
      targetKonto: '4950',
      targetSteuersatz: 19,
      kontoBezeichnung: 'FBA-Gebühren',
      confidence: 0.95,
      createdBy: 'import',
      metadata: { anbieter: 'amazon', kategorie: 'FBAFee' }
    },
    {
      pattern: 'ItemFees',
      matchType: 'category',
      targetKonto: '4910',
      targetSteuersatz: 19,
      kontoBezeichnung: 'Verkaufsgebühren',
      confidence: 0.95,
      createdBy: 'import',
      metadata: { anbieter: 'amazon', kategorie: 'ItemFees' }
    },
    {
      pattern: 'Refund',
      matchType: 'category',
      targetKonto: '8200',
      targetSteuersatz: 19,
      kontoBezeichnung: 'Erlösschmälerungen',
      confidence: 0.90,
      createdBy: 'import',
      metadata: { anbieter: 'amazon', kategorie: 'Refund' }
    },
    
    // PayPal
    {
      pattern: 'PayPal Fee',
      matchType: 'keyword',
      targetKonto: '4950',
      targetSteuersatz: 19,
      kontoBezeichnung: 'PayPal-Gebühren',
      confidence: 0.95,
      createdBy: 'import',
      metadata: { anbieter: 'paypal' }
    },
    {
      pattern: 'Gebühren zu Zahlung',
      matchType: 'keyword',
      targetKonto: '4950',
      targetSteuersatz: 19,
      kontoBezeichnung: 'PayPal-Gebühren',
      confidence: 0.90,
      createdBy: 'import',
      metadata: { anbieter: 'paypal' }
    },
    
    // Bank/Allgemein
    {
      pattern: 'Telekom',
      matchType: 'vendor',
      targetKonto: '6825',
      targetSteuersatz: 19,
      kontoBezeichnung: 'Telekommunikation',
      confidence: 0.90,
      createdBy: 'import'
    },
    {
      pattern: 'Deutsche Telekom',
      matchType: 'vendor',
      targetKonto: '6825',
      targetSteuersatz: 19,
      kontoBezeichnung: 'Telekommunikation',
      confidence: 0.95,
      createdBy: 'import'
    },
    {
      pattern: 'Miete',
      matchType: 'keyword',
      targetKonto: '6400',
      targetSteuersatz: 0,
      kontoBezeichnung: 'Mieten',
      confidence: 0.85,
      createdBy: 'import'
    },
    {
      pattern: 'Versicherung',
      matchType: 'keyword',
      targetKonto: '6300',
      targetSteuersatz: 19,
      kontoBezeichnung: 'Versicherungen',
      confidence: 0.80,
      createdBy: 'import'
    }
  ]
  
  let imported = 0
  
  for (const rule of defaultRules) {
    try {
      await saveMatchingRule(db, rule)
      imported++
    } catch (err) {
      console.error(`[Import] Fehler bei Rule "${rule.pattern}":`, err)
    }
  }
  
  console.log(`[Learning DB] ${imported} Default-Rules importiert`)
  
  return imported
}
