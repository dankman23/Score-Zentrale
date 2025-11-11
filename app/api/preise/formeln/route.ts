export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../lib/api'

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
        kosten_statisch: 25,
        mwst: 0.19,
        ebay_amazon: 0.19,
        paypal: 0.025,
        paypal_fix: 0.35,
        fixkosten_beitrag: 0.35,
        gewinn_regler_1a: 1.4,
        gewinn_regler_2c: 0,
        gewinn_regler_3e: 5,
        prozent_aufschlag: 0.94,
        aa_threshold: 0.08
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    {
      sheet: 'klingspor_fremdlager',
      name: 'Klingspor Fremdlager',
      warengruppen: [
        { id: 'klingspor_fremdlager', name: 'Klingspor Fremdlager' },
        { id: 'auktion_klingspor_fremdlager', name: 'Auktion Klingspor Fremdlager' },
        { id: 'starcke_fremdlager', name: 'Starcke Fremdlager' },
        { id: 'auktion_starcke_fremdlager', name: 'Auktion Starcke Fremdlager' },
        { id: 'vsm_fremdlager', name: 'VSM Fremdlager' },
        { id: 'auktion_vsm_fremdlager', name: 'Auktion VSM Fremdlager' },
        { id: 'lukas_fremdlager', name: 'Lukas Fremdlager' },
        { id: 'auktion_lukas_fremdlager', name: 'Auktion Lukas Fremdlager' },
        { id: 'norton_fremdlager', name: 'Norton Fremdlager' },
        { id: 'auktion_norton_fremdlager', name: 'Auktion Norton Fremdlager' },
        { id: 'sia_fremdlager', name: 'SIA Fremdlager' },
        { id: 'auktion_sia_fremdlager', name: 'Auktion Sia Fremdlager' },
        { id: 'sia_nicht_erhaeltlich', name: 'SIA nicht erhältlich' },
        { id: 'tyrolit_fremdlager', name: 'Tyrolit Fremdlager' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 32,
        mwst: 0.19,
        ebay_amazon: 0.19,
        paypal: 0.026,
        paypal_fix: 0.25,
        fixkosten_beitrag: 0.25,
        gewinn_regler_1a: 0.02,
        gewinn_regler_2c: 0.35,
        gewinn_regler_3e: 1.4,
        prozent_aufschlag: 19,
        aa_threshold: 0.08
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
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
        paypal: 0.026,
        paypal_fix: 0.19,
        fixkosten_beitrag: 0.19,
        gewinn_regler_1a: 0.25,
        gewinn_regler_2c: 0.02,
        gewinn_regler_3e: 0.35,
        prozent_aufschlag: 1.4,
        aa_threshold: 0.08
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
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
        paypal: 0.026,
        paypal_fix: 0.19,
        fixkosten_beitrag: 0.19,
        gewinn_regler_1a: 0.25,
        gewinn_regler_2c: 0.02,
        gewinn_regler_3e: 0.35,
        prozent_aufschlag: 1.4,
        aa_threshold: 0.08
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
    {
      sheet: 'pferd_fremdlager',
      name: 'Pferd Fremdlager',
      warengruppen: [
        { id: 'pferd_fremdlager', name: 'Pferd Fremdlager' },
        { id: 'auktion_pferd_fremdlager', name: 'Auktion Pferd Fremdlager' },
        { id: 'bosch_fremdlager', name: 'Bosch Fremdlager' }
      ],
      regler: {
        kosten_variabel: 0,
        kosten_statisch: 34,
        mwst: 0.19,
        ebay_amazon: 0.25,
        paypal: 0.026,
        paypal_fix: 0.19,
        fixkosten_beitrag: 0.19,
        gewinn_regler_1a: 0.25,
        gewinn_regler_2c: 0.02,
        gewinn_regler_3e: 0.35,
        prozent_aufschlag: 1.4,
        aa_threshold: 0.08
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
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
        paypal: 0.026,
        paypal_fix: 0.19,
        fixkosten_beitrag: 0.19,
        gewinn_regler_1a: 0.25,
        gewinn_regler_2c: 0.02,
        gewinn_regler_3e: 0.35,
        prozent_aufschlag: 1.4,
        aa_threshold: 0.08
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    },
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
        paypal: 0.026,
        paypal_fix: 0.19,
        fixkosten_beitrag: 0.19,
        gewinn_regler_1a: 0.25,
        gewinn_regler_2c: 0.02,
        gewinn_regler_3e: 0.35,
        prozent_aufschlag: 1.4,
        aa_threshold: 0.08
      },
      ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
    }
  ]
}
