export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/preise/g2/berechnen
 * g2-Formel: Nutzt alte Formel + 3 Intervalle
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ek, warengruppe_regler, g2_params, staffel_mengen } = body

    if (!ek || !warengruppe_regler || !g2_params) {
      return NextResponse.json({ 
        ok: false, 
        error: 'EK, Warengruppen-Regler und g2-Parameter erforderlich' 
      }, { status: 400 })
    }

    const staffeln = staffel_mengen || [1, 5, 10, 20, 50, 100, 200, 500]

    // Einzelpreis
    const plattform_unit = g2(ek, warengruppe_regler, g2_params)
    const shop_unit = plattform_unit * (g2_params.shp_fac || 0.92)

    // Staffelpreise
    const ergebnisse = staffeln.map(staffel => {
      const paket_ek = ek * staffel
      const plattform_paket = g2(paket_ek, warengruppe_regler, g2_params)
      const shop_paket = plattform_paket * (g2_params.shp_fac || 0.92)

      return {
        staffel,
        paket_ek: parseFloat(paket_ek.toFixed(2)),
        plattform_unit: parseFloat((plattform_paket / staffel).toFixed(2)),
        shop_unit: parseFloat((shop_paket / staffel).toFixed(2))
      }
    })

    return NextResponse.json({ 
      ok: true,
      plattform_unit: parseFloat(plattform_unit.toFixed(2)),
      shop_unit: parseFloat(shop_unit.toFixed(2)),
      ergebnisse
    })
  } catch (error: any) {
    console.error('[G2] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * f_alt - EXAKT wie alte Formel (für VE=1)
 * 
 * Alte Formel aus /api/preise/berechnen:
 * zaehler = (c * (ve * ek)^a) + paypal_fix + fixkosten_beitrag + (ve * ek)
 * nenner = 1 - ebay_amazon - paypal
 * vk = (zaehler / nenner) * (1 + prozent_aufschlag) / ve
 */
function f_alt(x: number, wg: any, g2: any): number {
  const ve = 1
  const c = wg.gewinn_regler_2c || 1.07
  const a = wg.gewinn_regler_1a || 0.81
  const paypal_fix = g2.fixcost1 || 0.35
  const fixkosten_beitrag = g2.fixcost2 || 1.4
  const eba = g2.varpct1 || 0.25
  const paypal = g2.varpct2 || 0.02
  const prozent_aufschlag = (g2.aufschlag - 1) || 0.08  // 1.08 → 0.08

  // EXAKT wie alte Formel
  const zaehler = (c * Math.pow(ve * x, a)) + paypal_fix + fixkosten_beitrag + (ve * x)
  const nenner = 1 - eba - paypal
  
  return (zaehler / nenner) * (1 + prozent_aufschlag) / ve
}

/**
 * g2 mit 3 Intervallen
 */
function g2(x: number, wg: any, g2_params: any): number {
  const gstart = g2_params.gstart_ek || 12
  const gneu_ek = g2_params.gneu_ek || 100
  const gneu_vk = g2_params.gneu_vk || 189

  // Intervall I: x ≤ gstart_ek → identisch mit alter Formel
  if (x <= gstart) {
    return f_alt(x, wg, g2_params)
  }

  // rNEU berechnen
  const f_gneu = f_alt(gneu_ek, wg, g2_params)
  const rNEU = gneu_vk / f_gneu

  // Intervall III: x ≥ gneu_ek
  if (x >= gneu_ek) {
    return rNEU * f_alt(x, wg, g2_params)
  }

  // Intervall II: S-Übergang
  const t = (x - gstart) / (gneu_ek - gstart)
  const S = 3 * Math.pow(t, 2) - 2 * Math.pow(t, 3)
  const L = 1 + (rNEU - 1) * S

  return f_alt(x, wg, g2_params) * L
}
