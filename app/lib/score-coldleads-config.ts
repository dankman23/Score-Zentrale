/**
 * Score Schleifwerkzeuge - Kaltakquise Configuration
 * Basierend auf ChatGPT Optimierungs-Prompt
 */

export const SCORE_CONFIG = {
  company: {
    name: 'Score Schleifwerkzeuge',
    location: 'Köln',
    phone: '0221 25999901',
    email_main: 'leismann@score-schleifwerkzeuge.de',
    business_form_url: 'https://score-schleifwerkzeuge.de/business',
    website: 'https://score-schleifwerkzeuge.de'
  },
  
  sender: {
    display_name: 'Daniel von Score Schleifwerkzeuge',
    email: 'daniel@score-schleifwerkzeuge.de'
  },
  
  brands: {
    primary: ['Klingspor', '3M', 'Norton', 'VSM', 'PFERD', 'Rhodius', 'Tyrolit', 'Mirka', 'Indasa', 'Starcke'],
    // Marken-Mapping nach Material/Anwendung
    by_material: {
      'Edelstahl': ['3M Cubitron II', 'Klingspor CS 411 Y', 'PFERD POLIFAN'],
      'Stahl': ['Klingspor', 'VSM', 'Norton'],
      'Aluminium': ['3M', 'Mirka', 'PFERD'],
      'Holz': ['Starcke', 'VSM', 'Klingspor']
    },
    by_application: {
      'Schweißnahtbearbeitung': ['Rhodius', 'PFERD', 'Klingspor'],
      'Polieren': ['3M', 'Mirka', 'Indasa'],
      'Entgraten': ['VSM', 'Norton', 'Klingspor'],
      'Trennen': ['Rhodius', 'Tyrolit', 'Norton']
    }
  },
  
  value_propositions: [
    'Schnelle Verfügbarkeit durch Lager & Partner',
    'Sondermaße & Konfektion auf Anfrage',
    'Rahmenverträge mit Staffelpreisen',
    'Technischer Support & Beratung',
    'Breites Sortiment führender Marken',
    'Zuverlässige Lieferung deutschlandweit'
  ],
  
  email_limits: {
    mail_1_max_words: 180,
    mail_2_max_words: 110,
    mail_3_max_words: 90,
    subject_min_chars: 55,
    subject_max_chars: 70
  },
  
  followup_schedule: {
    followup_1_days: 5,  // 4-6 Tage
    followup_2_days: 12  // 10-14 Tage
  }
}

/**
 * Generiert Absenderblock für Emails
 */
export function getEmailSignature(): string {
  return `Beste Grüße
Daniel Leismann

Score-Schleifwerkzeuge
B2B-Kundenbetreuer

-- 
Besuchen Sie auch unseren Schleifmittel-Shop auf www.score-schleifwerkzeuge.de und kaufen Sie dort Schleifscheiben, Schleifbänder etc. zu Staffelpreisen unabhängig von den handelsüblichen OVP-Größen. 

Score Handels GmbH & Co. KG 
Sülzburgstr. 187 
50937 Köln 
Telefon: +49(0)221-25999901 
email: support@score-schleifwerkzeuge.de

Amtsgericht Köln, HRA 31021 
Persönlich haftende Gesellschafterin der SCORE Handels GmbH & Co. KG: 
SCORE Handels Verwaltungs GmbH 
Sülzburgstraße 187 
50937 Köln 
Amtsgericht Köln, HRB 83408 
Geschäftsführer: Dr. Alexander Biehl`
}

/**
 * Wählt passende Marken basierend auf Material + Anwendung
 */
export function selectBrandsForProspect(
  materials: string[],
  applications: string[]
): string[] {
  const selectedBrands = new Set<string>()
  
  // Prüfe Material-Mapping
  materials.forEach(material => {
    const brands = SCORE_CONFIG.brands.by_material[material]
    if (brands) {
      brands.forEach(brand => selectedBrands.add(brand))
    }
  })
  
  // Prüfe Anwendungs-Mapping
  applications.forEach(app => {
    const brands = SCORE_CONFIG.brands.by_application[app]
    if (brands) {
      brands.forEach(brand => selectedBrands.add(brand))
    }
  })
  
  // Falls keine spezifischen Treffer, nehme Top-Marken
  if (selectedBrands.size === 0) {
    return SCORE_CONFIG.brands.primary.slice(0, 3)
  }
  
  // Maximal 3 Marken zurückgeben
  return Array.from(selectedBrands).slice(0, 3)
}

/**
 * Wählt passende Value Propositions
 */
export function selectValuePropositions(count: number = 3): string[] {
  return SCORE_CONFIG.value_propositions.slice(0, count)
}
