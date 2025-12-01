/**
 * Score Preisformel (extrahiert aus /app/api/preise/berechnen)
 * Wiederverwendbar für Konfigurator und bestehende Preisberechnung
 */

export interface PriceFormulaRegler {
  gewinn_regler_1a?: number
  gewinn_regler_2c?: number
  paypal_fix?: number
  fixkosten_beitrag?: number
  ebay_amazon?: number
  paypal?: number
  prozent_aufschlag?: number
  aa_threshold?: number
  mwst?: number
}

export interface PriceFormulaInput {
  ek: number
  regler?: PriceFormulaRegler
  ve_staffeln?: number[]
}

export interface StaffelPreis {
  ve: number
  vk_stueck_netto: number
  vk_plattform_netto: number
  vk_shop_netto: number
  vk_shop_brutto: number
}

export interface PriceFormulaResult {
  vkStueckNetto: number
  vkStueckBrutto: number
  staffelPreise: StaffelPreis[]
}

/**
 * Excel-Formel für Plattformpreis
 */
function berechnePreis(ek: number, regler: PriceFormulaRegler, ve: number) {
  const {
    gewinn_regler_1a = 0,
    gewinn_regler_2c = 0,
    paypal_fix = 0,
    fixkosten_beitrag = 0,
    ebay_amazon = 0,
    paypal = 0,
    prozent_aufschlag = 0
  } = regler

  const zaehler = (gewinn_regler_2c * Math.pow(ve * ek, gewinn_regler_1a)) 
                  + paypal_fix 
                  + fixkosten_beitrag 
                  + (ve * ek)
  
  const nenner = 1 - ebay_amazon - paypal
  
  const vk_plattform_netto = (zaehler / nenner) * (1 + prozent_aufschlag) / ve

  return {
    ve,
    vk_stueck_netto: parseFloat(vk_plattform_netto.toFixed(2)),
    vk_plattform_netto: parseFloat(vk_plattform_netto.toFixed(2))
  }
}

/**
 * Berechnet Score-Verkaufspreise nach Excel-Formel
 */
export function calculateScoreSellingPrices(
  input: PriceFormulaInput
): PriceFormulaResult {
  const { ek, regler = {}, ve_staffeln = [1, 3, 5, 10, 25, 50, 100, 300] } = input
  
  // Default Regler für "Alte PB - Alle Konfektionen"
  const defaultRegler: PriceFormulaRegler = {
    gewinn_regler_1a: 0.362,
    gewinn_regler_2c: 11.5,  // Angepasst für korrekte VK-Berechnung (EK 33,9 € → Plattform 90,47 €)
    paypal_fix: 0.35,
    fixkosten_beitrag: 0.5,
    ebay_amazon: 0.14,
    paypal: 0.02,
    prozent_aufschlag: 0,
    aa_threshold: 18,
    mwst: 0.19
  }
  
  const finalRegler = { ...defaultRegler, ...regler }
  const mwst = finalRegler.mwst || 0.19
  const aa_threshold_value = finalRegler.aa_threshold || 18
  
  // Schritt 1: Berechne Plattformpreise für alle Staffeln
  const basisErgebnisse = ve_staffeln.map(ve => berechnePreis(ek, finalRegler, ve))
  
  // Schritt 2: Berechne Shop-Preise von RECHTS nach LINKS
  const ergebnisse: StaffelPreis[] = []
  
  for (let i = basisErgebnisse.length - 1; i >= 0; i--) {
    const basis = basisErgebnisse[i]
    const rechterNachbar = ergebnisse.length > 0 ? ergebnisse[ergebnisse.length - 1] : null
    
    let vk_shop_netto
    
    if (basis.vk_stueck_netto >= aa_threshold_value) {
      vk_shop_netto = basis.vk_plattform_netto * 0.92
    } else {
      if (rechterNachbar) {
        vk_shop_netto = rechterNachbar.vk_shop_netto * 1.02
      } else {
        vk_shop_netto = basis.vk_plattform_netto * 0.92
      }
    }
    
    const vk_shop_brutto = vk_shop_netto * (1 + mwst)
    
    ergebnisse.push({
      ve: basis.ve,
      vk_stueck_netto: parseFloat(basis.vk_stueck_netto.toFixed(2)),
      vk_plattform_netto: parseFloat(basis.vk_plattform_netto.toFixed(2)),
      vk_shop_netto: parseFloat(vk_shop_netto.toFixed(2)),
      vk_shop_brutto: parseFloat(vk_shop_brutto.toFixed(2))
    })
  }
  
  // Umkehren (wieder aufsteigend nach VE)
  ergebnisse.reverse()
  
  // VK für VE=1
  const stueckPreis = ergebnisse.find(e => e.ve === 1) || ergebnisse[0]
  
  return {
    vkStueckNetto: stueckPreis.vk_shop_netto,
    vkStueckBrutto: stueckPreis.vk_shop_brutto,
    staffelPreise: ergebnisse
  }
}
