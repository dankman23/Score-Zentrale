export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/../lib/api'

/**
 * GET /api/preise/formeln
 * Alle gespeicherten Preisformeln abrufen
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const formelnCollection = db.collection('preisformeln')

    const formeln = await formelnCollection.find({}).toArray()

    // Default-Formeln falls keine vorhanden
    if (formeln.length === 0) {
      const defaultFormeln = getDefaultFormeln()
      await formelnCollection.insertMany(defaultFormeln)
      return NextResponse.json({ ok: true, formeln: defaultFormeln })
    }

    return NextResponse.json({ ok: true, formeln })
  } catch (error: any) {
    console.error('[Preisformeln GET] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/preise/formeln
 * Preisformeln aktualisieren
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sheet, warengruppe, regler } = body

    if (!sheet || !warengruppe || !regler) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Sheet, Warengruppe und Regler erforderlich' 
      }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const formelnCollection = db.collection('preisformeln')

    // Update oder Insert
    await formelnCollection.updateOne(
      { sheet, warengruppe },
      { 
        $set: { 
          regler,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    )

    return NextResponse.json({ 
      ok: true, 
      message: 'Preisformel gespeichert' 
    })
  } catch (error: any) {
    console.error('[Preisformeln POST] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * Default-Preisformeln basierend auf der Excel-Analyse
 * Basierend auf: "Alte Preisberechnungsformeln Score je Warengruppe.xlsx"
 */
function getDefaultFormeln() {
  return [
    // Lagerware-Gruppe (kosten_statisch: 0)
    {
      sheet: 'lagerware',
      name: 'Lagerware',
      warengruppen: [
        { id: 'lagerware', name: 'Lagerware' },
        { id: 'ehemals_lagerware', name: 'ehemals Lagerware' },
        { id: 'lagerkandidaten', name: 'Lagerkandidaten' },
        { id: 'auktion_lagerware', name: 'Auktion Lagerware' },
        { id: 'auktion_lagerkandidaten', name: 'Auktion Lagerkandidaten' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 0,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.02,
        paypal_fix: 0.35,
        fixkosten_beitrag: 1.4,
        gewinn_regler_1a: 0.94,
        gewinn_regler_2c: 1.07,
        gewinn_regler_3e: 1,
        prozent_aufschlag: 0.08,
        aa_threshold: 18
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    // Klingspor Fremdlager (kosten_statisch: 32)
    {
      sheet: 'klingspor_fremdlager',
      name: 'Klingspor Fremdlager',
      warengruppen: [
        { id: 'klingspor_fremdlager', name: 'Klingspor Fremdlager' },
        { id: 'starcke_fremdlager', name: 'Starcke Fremdlager' },
        { id: 'vsm_fremdlager', name: 'VSM Fremdlager' },
        { id: 'lukas_fremdlager', name: 'Lukas Fremdlager' },
        { id: 'norton_fremdlager', name: 'Norton Fremdlager' },
        { id: 'sia_fremdlager', name: 'SIA Fremdlager' },
        { id: 'sia_nicht_erhaeltlich', name: 'SIA nicht erhältlich' },
        { id: 'tyrolit_fremdlager', name: 'Tyrolit Fremdlager' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 32,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.02,
        paypal_fix: 0.35,
        fixkosten_beitrag: 1.4,
        gewinn_regler_1a: 0.81,
        gewinn_regler_2c: 1.07,
        gewinn_regler_3e: 1,
        prozent_aufschlag: 0.08,
        aa_threshold: 18
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    // Abverkauf (kosten_statisch: 31)
    {
      sheet: 'abverkauf',
      name: 'Abverkauf',
      warengruppen: [
        { id: 'abverkauf', name: 'Abverkauf' },
        { id: 'auktion_abverkauf', name: 'Auktion Abverkauf' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 31,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.02,
        paypal_fix: 0.35,
        fixkosten_beitrag: 1.4,
        gewinn_regler_1a: 0.94,
        gewinn_regler_2c: 1.07,
        gewinn_regler_3e: 0.5,
        prozent_aufschlag: 0.08,
        aa_threshold: 18
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    // Lagerware günstiger EK (kosten_statisch: 33, EK wird verdoppelt)
    {
      sheet: 'lagerware_guenstiger_ek',
      name: 'Lagerware günstiger EK',
      warengruppen: [
        { id: 'lagerware_guenstiger_ek', name: 'Lagerware günstiger EK' },
        { id: 'auktion_lagerware_guenstiger_ek', name: 'Auktion Lagerware günstiger EK' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 33,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.02,
        paypal_fix: 0.35,
        fixkosten_beitrag: 1.4,
        gewinn_regler_1a: 0.94,
        gewinn_regler_2c: 1.07,
        gewinn_regler_3e: 2,  // EK-Multiplikator
        prozent_aufschlag: 0.08,
        aa_threshold: 18
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    // Pferd Fremdlager (kosten_statisch: 34)
    {
      sheet: 'pferd_fremdlager',
      name: 'Pferd Fremdlager',
      warengruppen: [
        { id: 'pferd_fremdlager', name: 'Pferd Fremdlager' },
        { id: 'auktion_pferd_fremdlager', name: 'Auktion Pferd Fremdlager' },
        { id: 'rhodius_fremdlager', name: 'Rhodius Fremdlager' },
        { id: 'bosch_fremdlager', name: 'Bosch Fremdlager' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 34,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.02,
        paypal_fix: 0.35,
        fixkosten_beitrag: 1.4,
        gewinn_regler_1a: 0.65,
        gewinn_regler_2c: 1.07,
        gewinn_regler_3e: 1,
        prozent_aufschlag: 0.08,
        aa_threshold: 18
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    // Plastimex Fremdlager (kosten_statisch: 35)
    {
      sheet: 'plastimex_fremdlager',
      name: 'Plastimex Fremdlager',
      warengruppen: [
        { id: 'plastimex_fremdlager', name: 'Plastimex Fremdlager' },
        { id: 'auktion_plastimex_fremdlager', name: 'Auktion Plastimex Fremdlager' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 35,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.02,
        paypal_fix: 0.35,
        fixkosten_beitrag: 1.4,
        gewinn_regler_1a: 0.65,
        gewinn_regler_2c: 1.07,
        gewinn_regler_3e: 1,
        prozent_aufschlag: 0.08,
        aa_threshold: 18
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    // Alle Konfektion (kosten_statisch: 37)
    {
      sheet: 'alle_konfektion',
      name: 'Alle Konfektion',
      warengruppen: [
        { id: 'alle_konfektion', name: 'Alle Konfektion' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 37,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.02,
        paypal_fix: 0.35,
        fixkosten_beitrag: 1.4,
        gewinn_regler_1a: 0.9,
        gewinn_regler_2c: 1.07,
        gewinn_regler_3e: 1,
        prozent_aufschlag: 0.08,
        aa_threshold: 18
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    }
  ]
}
