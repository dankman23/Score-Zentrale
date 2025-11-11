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
 * Excel-Formel aus Lagerware:
 * =WENN($B$11="Nein";
 *   (($B$8*(B15*$C$8)^$A$8)+$D$5+$F$5+(B15*$C$8))/(1-$B$5-$C$5)*(1+$D$8);
 *   (($B$8*(B15*$C$8)^$A$8)+$D$5+$F$5+(B15*$C$8))/(1-$B$5-$C$5)*(1+$D$8)*1,25
 * )
 * 
 * Mapping:
 * B15 = VE (Staffel-Menge)
 * C8 = EK Stück netto
 * A8 = gewinn_regler_1a
 * B8 = gewinn_regler_2c
 * D5 = paypal_fix
 * F5 = fixkosten_beitrag
 * B5 = ebay_amazon
 * C5 = paypal
 * D8 = prozent_aufschlag
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

  // Excel-Formel implementieren
  // Zähler: ($B$8*(B15*$C$8)^$A$8) + $D$5 + $F$5 + (B15*$C$8)
  const zaehler = (gewinn_regler_2c * Math.pow(ve * ek, gewinn_regler_1a)) 
                  + paypal_fix 
                  + fixkosten_beitrag 
                  + (ve * ek)
  
  // Nenner: (1 - $B$5 - $C$5)
  const nenner = 1 - ebay_amazon - paypal
  
  // Plattform Stückpreis (VK netto)
  const vk_plattform_netto = (zaehler / nenner) * (1 + prozent_aufschlag) / ve
  
  // VK brutto = VK netto * (1 + MwSt)
  const vk_plattform_brutto = vk_plattform_netto * (1 + mwst)
  
  // Shop-Preis (Staffelpreis mit aa_threshold% Rabatt)
  const shop_rabatt = aa_threshold / 100
  const vk_shop_netto = vk_plattform_netto * (1 - shop_rabatt)
  const vk_shop_brutto = vk_plattform_brutto * (1 - shop_rabatt)

  // Gewinn-Prozente berechnen
  const gewinn = vk_plattform_netto - ek
  const gewinn_prozent_vk = vk_plattform_netto > 0 ? (gewinn / vk_plattform_netto) * 100 : 0
  const gewinn_prozent_ek = ek > 0 ? (gewinn / ek) * 100 : 0

  return {
    ve,
    vk_netto: parseFloat(vk_plattform_netto.toFixed(2)),
    vk_brutto: parseFloat(vk_plattform_brutto.toFixed(2)),
    vk_shop_netto: parseFloat(vk_shop_netto.toFixed(2)),
    vk_shop_brutto: parseFloat(vk_shop_brutto.toFixed(2)),
    gewinn_prozent_vk: parseFloat(gewinn_prozent_vk.toFixed(2)),
    gewinn_prozent_ek: parseFloat(gewinn_prozent_ek.toFixed(2))
  }
}
