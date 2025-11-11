export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/preise/g2/berechnen
 * Neue g2-Preisformel mit S-Übergang und Staffellogik
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ek, params, staffel_mengen } = body

    if (!ek || !params) {
      return NextResponse.json({ 
        ok: false, 
        error: 'EK und Parameter erforderlich' 
      }, { status: 400 })
    }

    const staffeln = staffel_mengen || [1, 5, 10, 20, 50, 100, 200, 500]

    // Schritt 1: Plattformpreis für VE=1 berechnen
    const plattformpreis_unit = g2(ek, params)

    // Schritt 2: Staffelpreise berechnen
    const ergebnisse = []
    
    for (let i = 0; i < staffeln.length; i++) {
      const staffel_menge = staffeln[i]
      const paketpreis_ek = ek * staffel_menge
      
      // g2 für dieses Paket
      let plattform_paket = g2(paketpreis_ek, params)
      
      // Alternative Algorithmus prüfen (nächstgrößere Staffel)
      if (i < staffeln.length - 1) {
        const naechste_menge = staffeln[i + 1]
        const naechster_paket_ek = ek * naechste_menge
        const naechster_plattform = g2(naechster_paket_ek, params)
        
        // Wenn nächstgrößere Staffel ≤ threshold: +2% von nächstem
        if (naechster_plattform <= (params.aa_threshold || 18)) {
          plattform_paket = naechster_plattform * 1.02
        }
      }
      
      // Shop-Preis
      const shop_paket = plattform_paket * (params.shp_fac || 0.92)
      const shop_unit = shop_paket / staffel_menge
      
      ergebnisse.push({
        staffel: staffel_menge,
        paket_ek: parseFloat(paketpreis_ek.toFixed(2)),
        plattform_paket: parseFloat(plattform_paket.toFixed(2)),
        plattform_unit: parseFloat((plattform_paket / staffel_menge).toFixed(2)),
        shop_paket: parseFloat(shop_paket.toFixed(2)),
        shop_unit: parseFloat(shop_unit.toFixed(2))
      })
    }

    return NextResponse.json({ 
      ok: true,
      plattformpreis_unit: parseFloat(plattformpreis_unit.toFixed(2)),
      shoppreis_unit: parseFloat((plattformpreis_unit * (params.shp_fac || 0.92)).toFixed(2)),
      ergebnisse
    })
  } catch (error: any) {
    console.error('[G2 Berechnung] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * Alte Formel f_alt
 */
function f_alt(x: number, params: any): number {
  const {
    c = 1.07,
    a = 0.81,
    pa = 0.35,
    fixcost1 = 0,
    fixcost2 = 1.4,
    varpct1 = 0.25,
    varpct2 = 0.02,
    aufschlag = 1.08
  } = params

  const zaehler = c * Math.pow(x, a) + pa + fixcost1 + fixcost2 + x
  const nenner = 1 - varpct1 - varpct2
  
  return (zaehler / nenner) * aufschlag
}

/**
 * g2-Formel mit S-Übergang
 */
function g2(x: number, params: any): number {
  const {
    gstart_ek = 50,
    gneu_ek = 150,
    gneu_vk = 180,
    k = 1.0  // Steuerfaktor (0.8 - 1.0)
  } = params

  // Bereich 1: x ≤ gstart_ek
  if (x <= gstart_ek) {
    return f_alt(x, params)
  }

  // rNEU berechnen
  const f_alt_gneu = f_alt(gneu_ek, params)
  const rNEU = gneu_vk / f_alt_gneu

  // Bereich 3: x ≥ gneu_ek
  if (x >= gneu_ek) {
    return rNEU * f_alt(x, params)
  }

  // Bereich 2: S-Übergang (gstart_ek < x < gneu_ek)
  const t = (x - gstart_ek) / (gneu_ek - gstart_ek)
  const S = 3 * Math.pow(t, 2) - 2 * Math.pow(t, 3)  // Smoothstep
  
  return f_alt(x, params) * (1 + (k - 1) * S)
}
