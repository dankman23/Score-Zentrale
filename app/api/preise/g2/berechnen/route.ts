export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/preise/g2/berechnen
 * Neue Preisformel g2 mit S-Übergang, VE-Staffeln, PriceDiscounter und ShopModifier
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      ek_input,
      ek_input_per,  // "VE" oder "Stück"
      ve_size,
      regler,
      tier_set,
      show_ab1,
      ab1_markup_pct,
      pretty_round
    } = body

    if (!ek_input || !regler || !ve_size) {
      return NextResponse.json({ 
        ok: false, 
        error: 'EK, Regler und VE-Größe erforderlich' 
      }, { status: 400 })
    }

    // EK pro Stück berechnen
    const ek_unit = ek_input_per === 'VE' 
      ? ek_input / ve_size 
      : ek_input

    // Tier-Schwellen auswählen
    const tierThresholds = getTierThresholds(tier_set || 'Standard', ek_input_per === 'VE' ? ek_input : ek_input * ve_size)

    // Staffeln generieren
    const staffeln = generateTiers(tierThresholds, ek_unit, ve_size, pretty_round || false)

    // Plattformpreis für erste Staffel (ab VE)
    const erste_staffel = staffeln[0]
    const ek_pack_erste = erste_staffel.qtyPieces * ek_unit
    const plattformpreis_pack = berechneG2(ek_pack_erste, regler)
    const plattformpreis_unit = plattformpreis_pack / erste_staffel.qtyPieces

    // Alle Staffelpreise berechnen
    const ergebnisse = staffeln.map((tier, idx) => {
      const ek_pack = tier.qtyPieces * ek_unit
      const plattform_pack = berechneG2(ek_pack, regler) * (regler.price_discounter || 1)
      const plattform_unit = plattform_pack / tier.qtyPieces
      
      // Shop-Preis
      const shop_pack = plattform_pack * (regler.shop_modifier || 0.92)
      const shop_unit = shop_pack / tier.qtyPieces

      return {
        label: tier.label,
        qtyPieces: tier.qtyPieces,
        packPriceShop: parseFloat(shop_pack.toFixed(2)),
        unitPriceShop: parseFloat(shop_unit.toFixed(2)),
        unitPricePlatform: parseFloat(plattform_unit.toFixed(2)),
        selectable: tier.selectable
      }
    })

    // "ab 1" hinzufügen wenn gewünscht
    if (show_ab1 && ergebnisse.length > 0) {
      const ab1_price = ergebnisse[0].unitPriceShop * (1 + (ab1_markup_pct || 0.02))
      ergebnisse.unshift({
        label: 'ab 1',
        qtyPieces: 1,
        packPriceShop: parseFloat(ab1_price.toFixed(2)),
        unitPriceShop: parseFloat(ab1_price.toFixed(2)),
        unitPricePlatform: 0,
        selectable: false
      })
    }

    return NextResponse.json({ 
      ok: true,
      plattformpreis_unit: parseFloat(plattformpreis_unit.toFixed(2)),
      ergebnisse
    })
  } catch (error: any) {
    console.error('[G2 Berechnung] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * Basisfunktion f_alt
 */
function f_alt(x: number, params: any): number {
  const { a, c, pa, fixcost, eba_pct, paypal_pct, aufschlag } = params
  
  const numerator = (c * Math.pow(x, a)) + pa + fixcost + x
  const denominator = 1 - eba_pct - paypal_pct
  
  return (numerator / denominator) * aufschlag
}

/**
 * g2-Funktion mit S-Übergang
 */
function berechneG2(x: number, regler: any): number {
  const {
    a = 0.81,
    c = 1.07,
    pa = 0.35,
    fixcost = 1.4,
    eba_pct = 0.25,
    paypal_pct = 0.02,
    aufschlag = 1.08,
    gstart_ek = 50,
    gneu_ek = 150,
    gneu_vk = 180
  } = regler

  const params = { a, c, pa, fixcost, eba_pct, paypal_pct, aufschlag }

  // Bereich 1: x <= gstart_ek
  if (x <= gstart_ek) {
    return f_alt(x, params)
  }

  // rNEU berechnen
  const f_alt_gneu = f_alt(gneu_ek, params)
  const rNEU = gneu_vk / f_alt_gneu

  // Bereich 3: x >= gneu_ek
  if (x >= gneu_ek) {
    return rNEU * f_alt(x, params)
  }

  // Bereich 2: S-Übergang
  const u = (x - gstart_ek) / (gneu_ek - gstart_ek)
  const S = 3 * Math.pow(u, 2) - 2 * Math.pow(u, 3)  // Smooth-Step
  
  return f_alt(x, params) * (1 + (rNEU - 1) * S)
}

/**
 * Tier-Schwellen basierend auf TierSet
 */
function getTierThresholds(tierSet: string, ek_ve: number): number[] {
  const sets: Record<string, number[]> = {
    'Basis': [20, 40, 60, 100, 150, 250, 400, 600],
    'Standard': [25, 50, 100, 150, 250, 400, 600, 1000],
    'High': [50, 100, 200, 400, 700, 1000]
  }
  
  return sets[tierSet] || sets['Standard']
}

/**
 * Staffeln generieren
 */
function generateTiers(thresholds: number[], ek_unit: number, ve_size: number, prettyRound: boolean): any[] {
  const tiers: any[] = []
  const ek_ve = ek_unit * ve_size

  for (const threshold of thresholds) {
    let needed_ves = Math.ceil(threshold / ek_ve)
    
    // Schöne Rundung für große Mengen
    if (prettyRound && needed_ves > 20) {
      const roundTargets = [12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120, 150, 200, 250, 300, 400, 500]
      for (const target of roundTargets) {
        if (needed_ves <= target) {
          needed_ves = target
          break
        }
      }
    }

    const qty_pieces = needed_ves * ve_size
    
    // Duplikate vermeiden
    if (tiers.length === 0 || tiers[tiers.length - 1].qtyPieces !== qty_pieces) {
      tiers.push({
        label: `ab ${qty_pieces}`,
        qtyPieces: qty_pieces,
        selectable: true
      })
    }
  }

  // Max 8 Stufen
  return tiers.slice(0, 8)
}
