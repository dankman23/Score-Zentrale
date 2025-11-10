/**
 * Score Schleifwerkzeuge - Produkt-Katalog & Anwendungs-Mapping
 * Definiert welche Produkte für welche Anwendungen geeignet sind
 */

export interface Application {
  id: string
  name: string
  description: string
  keywords: string[]
  materials: string[]
  typical_industries: string[]
}

export interface Product {
  id: string
  name: string
  category: string
  description: string
  applications: string[] // Application IDs
  materials: string[]
  grain_sizes?: string[]
  typical_volume: 'low' | 'medium' | 'high'
}

/**
 * Anwendungen/Arbeitsprozesse die Score-Kunden haben
 */
export const APPLICATIONS: Application[] = [
  {
    id: 'metal_grinding',
    name: 'Metallschleifen',
    description: 'Abtragen, Glätten und Vorbereiten von Metalloberflächen',
    keywords: ['schleifen', 'metall', 'stahl', 'edelstahl', 'aluminium', 'glätten', 'entgraten'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium', 'Metall'],
    typical_industries: ['Metallbau', 'Stahlbau', 'Maschinenbau', 'Fertigung']
  },
  {
    id: 'welding_prep',
    name: 'Schweißnahtvorbereitung',
    description: 'Vorbereiten von Oberflächen vor dem Schweißen',
    keywords: ['schweißen', 'schweißnaht', 'vorbereitung', 'naht', 'fügen'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    typical_industries: ['Schweißbetrieb', 'Stahlbau', 'Metallbau', 'Anlagenbau']
  },
  {
    id: 'welding_finishing',
    name: 'Schweißnahtbearbeitung',
    description: 'Nachbearbeiten und Glätten von Schweißnähten',
    keywords: ['schweißnaht', 'bearbeiten', 'glätten', 'finish', 'nahtnacharbeit'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    typical_industries: ['Schweißbetrieb', 'Stahlbau', 'Anlagenbau']
  },
  {
    id: 'deburring',
    name: 'Entgraten',
    description: 'Entfernen von Graten nach Schneid- oder Stanzprozessen',
    keywords: ['entgraten', 'grat', 'kante', 'schneiden', 'stanzen', 'laser'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium', 'Blech'],
    typical_industries: ['Blechbearbeitung', 'Laserschneiden', 'Stanztechnik', 'Fertigung']
  },
  {
    id: 'surface_prep_painting',
    name: 'Oberflächenvorbereitung Lackierung',
    description: 'Vorbereiten von Oberflächen für Lackierung oder Beschichtung',
    keywords: ['lackieren', 'beschichten', 'vorbereitung', 'grundierung', 'pulver', 'farbe'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium', 'Blech'],
    typical_industries: ['Lackiererei', 'Pulverbeschichtung', 'Metallbau', 'Fahrzeugbau']
  },
  {
    id: 'polishing',
    name: 'Polieren/Hochglanz',
    description: 'Erzeugen von Hochglanz- oder Spiegeloberflächen',
    keywords: ['polieren', 'hochglanz', 'spiegel', 'finish', 'glänzen', 'optik'],
    materials: ['Edelstahl', 'Aluminium', 'Metall'],
    typical_industries: ['Edelstahlverarbeitung', 'Design', 'Architektur', 'Lebensmittelindustrie']
  },
  {
    id: 'rust_removal',
    name: 'Entrosten',
    description: 'Entfernen von Rost und Oxidation',
    keywords: ['rost', 'entrosten', 'oxidation', 'korrosion', 'reinigung'],
    materials: ['Stahl', 'Eisen', 'Metall'],
    typical_industries: ['Restaurierung', 'Instandhaltung', 'Metallbau', 'Stahlbau']
  },
  {
    id: 'wood_sanding',
    name: 'Holzschleifen',
    description: 'Schleifen und Glätten von Holzoberflächen',
    keywords: ['holz', 'tischlerei', 'schreinerei', 'möbel', 'parkett', 'furnier'],
    materials: ['Holz', 'Massivholz', 'MDF', 'Spanplatte'],
    typical_industries: ['Tischlerei', 'Schreinerei', 'Möbelbau', 'Parkett']
  },
  {
    id: 'cutting',
    name: 'Trennen/Schneiden',
    description: 'Trennen von Metall, Stein oder anderen Materialien',
    keywords: ['trennen', 'schneiden', 'trennscheibe', 'flex', 'winkelschleifer'],
    materials: ['Stahl', 'Edelstahl', 'Stein', 'Beton'],
    typical_industries: ['Metallbau', 'Stahlbau', 'Bauwesen', 'Steinmetz']
  },
  {
    id: 'sharpening',
    name: 'Schärfen',
    description: 'Schärfen von Werkzeugen und Schneidkanten',
    keywords: ['schärfen', 'werkzeug', 'messer', 'klinge', 'schneide'],
    materials: ['Stahl', 'HSS', 'Hartmetall'],
    typical_industries: ['Werkzeugbau', 'Metzgerei', 'Scherenschleiferei', 'Messerschmiede']
  }
]

/**
 * Score Schleifwerkzeuge Produkt-Portfolio
 */
export const PRODUCTS: Product[] = [
  // Schleifbänder
  {
    id: 'belt_metal_coarse',
    name: 'Schleifbänder für Metall (grob K40-K80)',
    category: 'Schleifbänder',
    description: 'Grobes Abtragen, Entrosten, Schweißnahtvorbereitung',
    applications: ['metal_grinding', 'welding_prep', 'rust_removal', 'deburring'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    grain_sizes: ['K40', 'K60', 'K80'],
    typical_volume: 'high'
  },
  {
    id: 'belt_metal_medium',
    name: 'Schleifbänder für Metall (mittel K100-K180)',
    category: 'Schleifbänder',
    description: 'Zwischenschliff, Glätten, Vorbereiten für Lackierung',
    applications: ['metal_grinding', 'welding_finishing', 'surface_prep_painting', 'deburring'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    grain_sizes: ['K100', 'K120', 'K150', 'K180'],
    typical_volume: 'high'
  },
  {
    id: 'belt_metal_fine',
    name: 'Schleifbänder für Metall (fein K220-K400)',
    category: 'Schleifbänder',
    description: 'Feinschliff, Vorpolieren, Finish',
    applications: ['metal_grinding', 'polishing', 'surface_prep_painting'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    grain_sizes: ['K220', 'K240', 'K320', 'K400'],
    typical_volume: 'medium'
  },
  {
    id: 'belt_wood',
    name: 'Schleifbänder für Holz (K60-K240)',
    category: 'Schleifbänder',
    description: 'Holzbearbeitung, Möbelbau, Tischlerei',
    applications: ['wood_sanding'],
    materials: ['Holz', 'MDF', 'Spanplatte'],
    grain_sizes: ['K60', 'K80', 'K100', 'K120', 'K180', 'K240'],
    typical_volume: 'medium'
  },
  
  // Fächerscheiben
  {
    id: 'flap_disc_125mm_coarse',
    name: 'Fächerscheiben 125mm (grob K40-K80)',
    category: 'Fächerscheiben',
    description: 'Grobes Schleifen, Entrosten, Schweißnahtvorbereitung',
    applications: ['metal_grinding', 'welding_prep', 'rust_removal', 'deburring'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    grain_sizes: ['K40', 'K60', 'K80'],
    typical_volume: 'high'
  },
  {
    id: 'flap_disc_125mm_medium',
    name: 'Fächerscheiben 125mm (mittel K100-K120)',
    category: 'Fächerscheiben',
    description: 'Zwischenschliff, Schweißnahtfinish, Oberflächen glätten',
    applications: ['metal_grinding', 'welding_finishing', 'surface_prep_painting'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    grain_sizes: ['K100', 'K120'],
    typical_volume: 'high'
  },
  
  // Trennscheiben
  {
    id: 'cutting_disc_125mm',
    name: 'Trennscheiben 125mm für Metall',
    category: 'Trennscheiben',
    description: 'Trennen von Stahl, Edelstahl, Rohren, Profilen',
    applications: ['cutting'],
    materials: ['Stahl', 'Edelstahl', 'Metall'],
    typical_volume: 'high'
  },
  {
    id: 'cutting_disc_230mm',
    name: 'Trennscheiben 230mm für Metall',
    category: 'Trennscheiben',
    description: 'Trennen größerer Profile und Bleche',
    applications: ['cutting'],
    materials: ['Stahl', 'Edelstahl', 'Metall'],
    typical_volume: 'medium'
  },
  
  // Schleifscheiben
  {
    id: 'grinding_disc_125mm',
    name: 'Schruppscheiben 125mm',
    category: 'Schleifscheiben',
    description: 'Grobes Abtragen, Entgraten, Schweißnahtvorbereitung',
    applications: ['metal_grinding', 'welding_prep', 'deburring', 'rust_removal'],
    materials: ['Stahl', 'Edelstahl', 'Aluminium'],
    typical_volume: 'high'
  },
  
  // Vliesscheiben / Kompaktvlies
  {
    id: 'non_woven_medium',
    name: 'Vliesscheiben mittel (Maroon)',
    category: 'Vliesprodukte',
    description: 'Reinigen, Mattieren, Vorpolieren von Edelstahl',
    applications: ['polishing', 'surface_prep_painting', 'welding_finishing'],
    materials: ['Edelstahl', 'Aluminium', 'Metall'],
    typical_volume: 'medium'
  },
  {
    id: 'non_woven_fine',
    name: 'Vliesscheiben fein (Grey/Blue)',
    category: 'Vliesprodukte',
    description: 'Feinschliff, Polieren, Hochglanzfinish',
    applications: ['polishing'],
    materials: ['Edelstahl', 'Aluminium'],
    typical_volume: 'low'
  },
  
  // Schleifpapier
  {
    id: 'sandpaper_sheets',
    name: 'Schleifpapier-Bögen (K60-K240)',
    category: 'Schleifpapier',
    description: 'Handschliff für Holz und Metall',
    applications: ['wood_sanding', 'metal_grinding', 'surface_prep_painting'],
    materials: ['Holz', 'Metall', 'Lackierte Oberflächen'],
    grain_sizes: ['K60', 'K80', 'K100', 'K120', 'K150', 'K180', 'K220', 'K240'],
    typical_volume: 'low'
  }
]

/**
 * Findet passende Produkte für eine gegebene Anwendung
 */
export function getProductsForApplication(applicationId: string): Product[] {
  return PRODUCTS.filter(p => p.applications.includes(applicationId))
}

/**
 * Findet Anwendungen basierend auf Keywords im Text
 */
export function detectApplications(text: string, industry: string): Application[] {
  const lowerText = text.toLowerCase()
  const lowerIndustry = industry.toLowerCase()
  
  const detectedApplications: Array<Application & { confidence: number }> = []
  
  for (const app of APPLICATIONS) {
    let confidence = 0
    
    // Keyword-Matching im Text
    const keywordMatches = app.keywords.filter(kw => lowerText.includes(kw)).length
    confidence += keywordMatches * 15
    
    // Branche passt zu typical_industries
    const industryMatch = app.typical_industries.some(ind => 
      lowerIndustry.includes(ind.toLowerCase()) || ind.toLowerCase().includes(lowerIndustry)
    )
    if (industryMatch) confidence += 25
    
    // Mindest-Confidence 20 um berücksichtigt zu werden
    if (confidence >= 20) {
      detectedApplications.push({ ...app, confidence })
    }
  }
  
  // Sortiere nach Confidence
  detectedApplications.sort((a, b) => b.confidence - a.confidence)
  
  return detectedApplications.slice(0, 5) // Top 5
}

/**
 * Generiert Produktempfehlungen basierend auf erkannten Anwendungen
 * NUR KATEGORIEN - KEINE KÖRNUNGEN!
 */
export function generateProductRecommendations(applications: Application[]): {
  products: Array<{ name: string, category: string, reason: string }>
  estimated_volume: 'low' | 'medium' | 'high'
} {
  const categoryMap = new Map<string, { category: string, applications: string[], score: number }>()
  
  // Sammle alle Produkte für alle Anwendungen
  for (const app of applications) {
    const products = getProductsForApplication(app.id)
    
    for (const product of products) {
      // Gruppiere nach KATEGORIE (ohne Körnungen/Details)
      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, {
          category: product.category,
          applications: [],
          score: 0
        })
      }
      
      const entry = categoryMap.get(product.category)!
      if (!entry.applications.includes(app.name)) {
        entry.applications.push(app.name)
      }
      entry.score += 1
    }
  }
  
  // Sortiere nach Score
  const sortedCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5) // Top 5 Kategorien
  
  // Erstelle simple Empfehlungen: NUR Kategorienamen
  const recommendations = sortedCategories.map(entry => ({
    name: entry.category, // Nur Kategoriename!
    category: entry.category,
    reason: `Für ${entry.applications.slice(0, 3).join(', ')}`
  }))
  
  // Schätze Volumen basierend auf Anzahl Anwendungen
  const totalApplications = applications.length
  
  let estimated_volume: 'low' | 'medium' | 'high' = 'low'
  if (totalApplications >= 4) {
    estimated_volume = 'high'
  } else if (totalApplications >= 2) {
    estimated_volume = 'medium'
  }
  
  return {
    products: recommendations,
    estimated_volume
  }
}
