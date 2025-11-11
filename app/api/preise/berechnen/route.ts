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
 * Hauptformel aus Excel:
 * =WENN(B17=0;0;WENN(C17=0;0;WENN(D17=0;0;(WENN(G17=1;
 *   ($B$25*$B$11)+$B$12;
 *   ((($B$25*$B$11)+$B$12)*(1+$B$13))*(1+$B$14)
 * )))))
 */
function berechnePreis(ek: number, regler: any, ve: number) {
  const {
    kosten_variabel,
    kosten_statisch,
    mwst,
    ebay_amazon,
    paypal,
    paypal_fix,
    fixkosten,
    gewinn_regler_2c,
    prozent_aufschlag
  } = regler

  // Basis-Check
  if (kosten_variabel === 0 || kosten_statisch === 0) {
    return { ve, vk_netto: 0, vk_brutto: 0, vk_shop_netto: 0, vk_shop_brutto: 0 }
  }

  // Basis-Berechnung (vereinfacht, G17=1 Modus)
  // In der Excel: ($B$25 * $B$11) + $B$12
  // $B$25 = EK, $B$11 = kosten_variabel, $B$12 = kosten_statisch
  const basispreis = (ek * kosten_variabel) + kosten_statisch

  // Standard-Modus: Basis * (1 + MwSt) * (1 + eBay/Amazon)
  const vk_netto = ((basispreis * (1 + mwst)) * (1 + ebay_amazon)) * gewinn_regler_2c * prozent_aufschlag
  
  // VK brutto = VK netto * (1 + MwSt)
  const vk_brutto = vk_netto * (1 + mwst)
  
  // Shop-Preis (8% Rabatt)
  const vk_shop_netto = vk_netto * 0.92
  const vk_shop_brutto = vk_brutto * 0.92

  return {
    ve,
    vk_netto: parseFloat(vk_netto.toFixed(2)),
    vk_brutto: parseFloat(vk_brutto.toFixed(2)),
    vk_shop_netto: parseFloat(vk_shop_netto.toFixed(2)),
    vk_shop_brutto: parseFloat(vk_shop_brutto.toFixed(2)),
    gewinn_prozent_vk: ek > 0 ? parseFloat((((vk_netto - ek) / vk_netto) * 100).toFixed(2)) : 0,
    gewinn_prozent_ek: ek > 0 ? parseFloat((((vk_netto - ek) / ek) * 100).toFixed(2)) : 0
  }
}
