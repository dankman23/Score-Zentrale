/**
 * Kaltakquise - Automatische Such-Strategie
 * Rotiert durch relevante Branchen und Regionen
 */

export interface SearchQuery {
  industry: string
  region: string
  limit: number
}

/**
 * Relevante Branchen für Score Schleifwerkzeuge
 */
export const TARGET_INDUSTRIES = [
  'Metallbau',
  'Stahlbau',
  'Edelstahlverarbeitung',
  'Schweißbetrieb',
  'Schlosserei',
  'Blechbearbeitung',
  'Laserschneiden',
  'CNC-Fertigung',
  'Maschinenbau',
  'Anlagenbau',
  'Fahrzeugbau',
  'Karosseriebau',
  'Tischlerei',
  'Schreinerei',
  'Möbelbau',
  'Lackiererei',
  'Pulverbeschichtung',
  'Oberflächentechnik',
  'Restaurierung Metall',
  'Kunstschmiede',
  'Metallgestaltung'
]

/**
 * Deutsche Großstädte und Regionen (geografische Abdeckung)
 */
export const TARGET_REGIONS = [
  // NRW
  'Köln',
  'Düsseldorf',
  'Dortmund',
  'Essen',
  'Duisburg',
  'Bochum',
  'Wuppertal',
  'Bielefeld',
  'Bonn',
  'Münster',
  'Mönchengladbach',
  'Aachen',
  
  // Bayern
  'München',
  'Nürnberg',
  'Augsburg',
  'Regensburg',
  'Ingolstadt',
  'Würzburg',
  'Fürth',
  
  // Baden-Württemberg
  'Stuttgart',
  'Karlsruhe',
  'Mannheim',
  'Freiburg',
  'Heidelberg',
  'Heilbronn',
  'Ulm',
  'Pforzheim',
  
  // Niedersachsen
  'Hannover',
  'Braunschweig',
  'Oldenburg',
  'Osnabrück',
  'Wolfsburg',
  'Göttingen',
  
  // Hessen
  'Frankfurt',
  'Wiesbaden',
  'Kassel',
  'Darmstadt',
  'Offenbach',
  
  // Andere
  'Berlin',
  'Hamburg',
  'Bremen',
  'Leipzig',
  'Dresden',
  'Chemnitz',
  'Magdeburg',
  'Erfurt',
  'Rostock',
  'Kiel'
]

/**
 * Generiert die nächste Such-Query basierend auf Rotation
 */
export function getNextSearchQuery(lastQuery?: SearchQuery): SearchQuery {
  // Wenn keine vorherige Query, starte mit erstem Paar
  if (!lastQuery) {
    return {
      industry: TARGET_INDUSTRIES[0],
      region: TARGET_REGIONS[0],
      limit: 5
    }
  }
  
  // Finde aktuelle Indizes
  const industryIndex = TARGET_INDUSTRIES.indexOf(lastQuery.industry)
  const regionIndex = TARGET_REGIONS.indexOf(lastQuery.region)
  
  // Rotation: Region wechseln, dann Branche
  let nextRegionIndex = regionIndex + 1
  let nextIndustryIndex = industryIndex
  
  // Wenn alle Regionen durch, wechsle zur nächsten Branche
  if (nextRegionIndex >= TARGET_REGIONS.length) {
    nextRegionIndex = 0
    nextIndustryIndex = (industryIndex + 1) % TARGET_INDUSTRIES.length
  }
  
  return {
    industry: TARGET_INDUSTRIES[nextIndustryIndex],
    region: TARGET_REGIONS[nextRegionIndex],
    limit: 5
  }
}

/**
 * Generiert Such-Query für spezifische Präferenzen
 */
export function getSearchQueryWithPreferences(preferences: {
  preferredIndustries?: string[]
  preferredRegions?: string[]
  limit?: number
}): SearchQuery {
  const industries = preferences.preferredIndustries?.length 
    ? preferences.preferredIndustries 
    : TARGET_INDUSTRIES
    
  const regions = preferences.preferredRegions?.length 
    ? preferences.preferredRegions 
    : TARGET_REGIONS
  
  // Zufällige Auswahl aus Präferenzen
  const randomIndustry = industries[Math.floor(Math.random() * industries.length)]
  const randomRegion = regions[Math.floor(Math.random() * regions.length)]
  
  return {
    industry: randomIndustry,
    region: randomRegion,
    limit: preferences.limit || 5
  }
}

/**
 * Validiert ob Branche und Region gültig sind
 */
export function isValidSearchQuery(query: SearchQuery): boolean {
  return (
    typeof query.industry === 'string' &&
    typeof query.region === 'string' &&
    query.industry.length > 0 &&
    query.region.length > 0 &&
    query.limit > 0 &&
    query.limit <= 10
  )
}
