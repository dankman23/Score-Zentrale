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
 * Hauptformel aus Excel (vereinfacht):
 * VK_netto = (EK + Fixkosten_Beitrag + Kosten_statisch) * (1 + Prozent_Aufschlag)
 * 
 * Dann werden Plattformgebühren (eBay/Amazon, PayPal) berücksichtigt
 */
function berechnePreis(ek: number, regler: any, ve: number) {
  const {
    kosten_variabel = 0,
    kosten_statisch = 0,
    mwst = 0.19,
    ebay_amazon = 0,
    paypal = 0,
    paypal_fix = 0,
    fixkosten_beitrag = 0,
    gewinn_regler_1a = 0,
    gewinn_regler_2c = 0,
    gewinn_regler_3e = 0,
    prozent_aufschlag = 0,
    aa_threshold = 0
  } = regler

  // Schritt 1: Basis = EK + Kosten_statisch + Fixkosten_Beitrag
  const basis = ek + kosten_statisch + fixkosten_beitrag

  // Schritt 2: VK netto berechnen
  // Basierend auf Excel: VK = (Basis) * (1 + Prozent_Aufschlag)
  let vk_netto = basis * (1 + prozent_aufschlag)

  // Plattformgebühren einrechnen (wenn gesetzt)
  if (ebay_amazon > 0) {
    vk_netto = vk_netto / (1 - ebay_amazon)
  }

  if (paypal > 0) {
    vk_netto = (vk_netto + paypal_fix) / (1 - paypal)
  }

  // VK brutto = VK netto * (1 + MwSt.)
  const vk_brutto = vk_netto * (1 + mwst)
  
  // Shop-Preis (8% Rabatt)
  const shop_rabatt = aa_threshold || 0.08
  const vk_shop_netto = vk_netto * (1 - shop_rabatt)
  const vk_shop_brutto = vk_brutto * (1 - shop_rabatt)

  // Gewinn-Prozente berechnen
  const gewinn = vk_netto - ek
  const gewinn_prozent_vk = vk_netto > 0 ? (gewinn / vk_netto) * 100 : 0
  const gewinn_prozent_ek = ek > 0 ? (gewinn / ek) * 100 : 0

  return {
    ve,
    vk_netto: parseFloat(vk_netto.toFixed(2)),
    vk_brutto: parseFloat(vk_brutto.toFixed(2)),
    vk_shop_netto: parseFloat(vk_shop_netto.toFixed(2)),
    vk_shop_brutto: parseFloat(vk_shop_brutto.toFixed(2)),
    gewinn_prozent_vk: parseFloat(gewinn_prozent_vk.toFixed(2)),
    gewinn_prozent_ek: parseFloat(gewinn_prozent_ek.toFixed(2))
  }
}
