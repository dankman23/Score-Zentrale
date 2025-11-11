export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/preise/berechnen
 * Berechnet VK-Preise basierend auf Excel-Formel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ek, regler, ve_staffeln } = body

    if (!ek || !regler) {
      return NextResponse.json({ 
        ok: false, 
        error: 'EK und Regler erforderlich' 
      }, { status: 400 })
    }

    const staffeln = ve_staffeln || [1, 3, 5, 10, 25, 50, 100, 300]
    const ergebnisse = staffeln.map(ve => berechnePreis(ek, regler, ve))

    return NextResponse.json({ 
      ok: true, 
      ergebnisse 
    })
  } catch (error: any) {
    console.error('[Preisberechnung] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * Excel-Formel für Shop-Staffelpreise (B26 bis I26):
 * =WENN(C25>=$E$8; B18*0,92; C26*1,02)
 * 
 * C25 = VK/Stück (netto) der aktuellen Staffel
 * $E$8 = A.A. Threshold (z.B. 18€)
 * B18 = Plattformpreis
 * C26 = Shop-Preis der RECHTEN Nachbarspalte
 * 
 * WICHTIG: Von RECHTS nach LINKS berechnen!
 */
function berechnePreis(ek: number, regler: any, ve: number) {
  const {
    gewinn_regler_1a = 0,
    gewinn_regler_2c = 0,
    paypal_fix = 0,
    fixkosten_beitrag = 0,
    ebay_amazon = 0,
    paypal = 0,
    prozent_aufschlag = 0,
    mwst = 0.19,
    aa_threshold = 18
  } = regler

  // Excel-Formel für Plattformpreis
  const zaehler = (gewinn_regler_2c * Math.pow(ve * ek, gewinn_regler_1a)) 
                  + paypal_fix 
                  + fixkosten_beitrag 
                  + (ve * ek)
  
  const nenner = 1 - ebay_amazon - paypal
  
  // VK Plattform netto (B18 in Excel)
  const vk_plattform_netto = (zaehler / nenner) * (1 + prozent_aufschlag) / ve
  
  // VK / Stück (netto) für diese Staffel (Zeile 25 in Excel)
  const vk_stueck_netto = vk_plattform_netto

  return {
    ve,
    vk_stueck_netto: parseFloat(vk_stueck_netto.toFixed(2)),
    vk_plattform_netto: parseFloat(vk_plattform_netto.toFixed(2))
  }
}

/**
 * Berechnet alle Staffelpreise inklusive Shop-Preise
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ek, regler, ve_staffeln } = body

    if (!ek || !regler) {
      return NextResponse.json({ 
        ok: false, 
        error: 'EK und Regler erforderlich' 
      }, { status: 400 })
    }

    const staffeln = ve_staffeln || [1, 3, 5, 10, 25, 50, 100, 300]
    
    // Schritt 1: Berechne Plattformpreise für alle Staffeln
    const basisErgebnisse = staffeln.map(ve => berechnePreis(ek, regler, ve))
    
    // Schritt 2: Berechne Shop-Preise von RECHTS nach LINKS
    const ergebnisse = []
    const aa_threshold_value = regler.aa_threshold || 18
    
    for (let i = basisErgebnisse.length - 1; i >= 0; i--) {
      const basis = basisErgebnisse[i]
      const rechterNachbar = i < basisErgebnisse.length - 1 ? ergebnisse[ergebnisse.length - 1] : null
      
      let vk_shop_netto
      
      // Excel-Formel: =WENN(C25>=$E$8; B18*0,92; C26*1,02)
      if (basis.vk_stueck_netto >= aa_threshold_value) {
        // Wenn VK/Stück >= Threshold: 8% Rabatt vom Plattformpreis
        vk_shop_netto = basis.vk_plattform_netto * 0.92
      } else {
        // Sonst: 2% Aufschlag auf rechten Nachbar
        if (rechterNachbar) {
          vk_shop_netto = rechterNachbar.vk_shop_netto * 1.02
        } else {
          // Ganz rechts: 8% Rabatt
          vk_shop_netto = basis.vk_plattform_netto * 0.92
        }
      }
      
      const vk_shop_brutto = vk_shop_netto * (1 + (regler.mwst || 0.19))
      
      ergebnisse.unshift({
        ve: basis.ve,
        vk_netto: basis.vk_plattform_netto,
        vk_shop_netto: parseFloat(vk_shop_netto.toFixed(2)),
        vk_shop_brutto: parseFloat(vk_shop_brutto.toFixed(2))
      })
    }

    return NextResponse.json({ 
      ok: true, 
      plattformpreis: basisErgebnisse[0].vk_plattform_netto,
      ergebnisse 
    })
  } catch (error: any) {
    console.error('[Preisberechnung] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
