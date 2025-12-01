export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  calculateKlingsporBeltPrice,
  selectScoreEk,
  getMinOrderQty
} from '@/lib/pricing/klingspor-pricing'
import { calculateScoreSellingPrices } from '@/lib/pricing/price-formula'

interface KonfiguratorRequest {
  manufacturer: 'Klingspor'
  type: string
  grit: string | number
  widthMm: number
  lengthMm: number
}

interface KonfiguratorResponse {
  manufacturer: 'Klingspor'
  type: string
  grit: string | number
  widthMm: number
  lengthMm: number

  backingType: string
  listPrice: number
  stueckEk: number
  minOrderQty: number
  ekGesamtMbm: number

  vkStueckNetto: number
  vkStueckBrutto: number
  vkMbmNetto: number
  vkMbmBrutto: number

  staffelPreise: any[]

  debug?: any
}

/**
 * POST /api/pricing/konfigurator
 * Berechnet Klingspor-Schleifbänder mit Score-Preisformel
 */
export async function POST(request: NextRequest) {
  try {
    const body: KonfiguratorRequest = await request.json()
    const { manufacturer, type, grit, widthMm, lengthMm } = body

    // Validierung
    if (!type || !grit || !widthMm || !lengthMm) {
      return NextResponse.json({
        ok: false,
        error: 'Typ, Körnung, Breite und Länge sind erforderlich'
      }, { status: 400 })
    }

    // 1. Klingspor-Berechnung
    const klingsporResult = calculateKlingsporBeltPrice({
      type,
      grit,
      widthMm,
      lengthMm,
      salesOrg: 'DE10',
      currency: 'EUR'
    })

    // 2. Score-EK auswählen
    const stueckEk = selectScoreEk(klingsporResult, type)

    // 3. MBM
    const mbm = getMinOrderQty(widthMm)

    // 4. Gesamt-EK
    const ekGesamtMbm = stueckEk * mbm

    // 5. Score-Preisformel anwenden - WICHTIG: Mit Gesamt-EK für MBM, nicht pro Stück!
    // Die "Alte PB → Alle Konfektionen" nimmt den Gesamt-EK als Input
    const priceFormulaResult = calculateScoreSellingPrices({
      ek: ekGesamtMbm,  // 33,90 € (nicht 2,26 €!)
      // Staffeln sind dann Vielfache der MBM: VE 1 = 1×MBM, VE 3 = 3×MBM, etc.
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    })

    // 6. VK pro Stück = Gesamt-VK / MBM
    const vkStueckNetto = priceFormulaResult.vkStueckNetto / mbm
    const vkStueckBrutto = priceFormulaResult.vkStueckBrutto / mbm
    const vkMbmNetto = priceFormulaResult.vkStueckNetto
    const vkMbmBrutto = priceFormulaResult.vkStueckBrutto

    const response: KonfiguratorResponse = {
      manufacturer: 'Klingspor',
      type,
      grit,
      widthMm,
      lengthMm,

      backingType: klingsporResult.backingType,
      listPrice: klingsporResult.listPrice,
      stueckEk,
      minOrderQty: mbm,
      ekGesamtMbm,

      vkStueckNetto: parseFloat(vkStueckNetto.toFixed(2)),
      vkStueckBrutto: parseFloat(vkStueckBrutto.toFixed(2)),
      vkMbmNetto: parseFloat(vkMbmNetto.toFixed(2)),
      vkMbmBrutto: parseFloat(vkMbmBrutto.toFixed(2)),

      staffelPreise: priceFormulaResult.staffelPreise,

      debug: {
        klingsporCalculation: {
          m2Demand: klingsporResult.m2Demand,
          pricePer100m2: klingsporResult.pricePer100m2,
          basicPrice: klingsporResult.basicPrice,
          zpsdFactor: klingsporResult.zpsdFactor,
          zsc2Factor: klingsporResult.zsc2Factor,
          glueSurcharge: klingsporResult.glueSurcharge,
          totalProductSpecific: klingsporResult.totalProductSpecific,
          salesOrgMultiplier: klingsporResult.salesOrgMultiplier
        },
        scoreEkSelection: {
          paperVlies: klingsporResult.scoreEkPaperVlies,
          gewebe: klingsporResult.scoreEkGewebe,
          ls307xSpecial: klingsporResult.ls307xSpecialEk,
          selected: stueckEk,
          reason: type === 'LS 307 X' ? 'LS307X-Spezial' : `Backing: ${klingsporResult.backingType}`
        }
      }
    }

    return NextResponse.json({
      ok: true,
      result: response
    })

  } catch (error: any) {
    console.error('[Konfigurator] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Berechnung fehlgeschlagen'
    }, { status: 500 })
  }
}
