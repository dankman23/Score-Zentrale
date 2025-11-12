export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * GET /api/fibu/rechnungen/ek?from=2025-10-01&to=2025-10-31
 * Lädt hochgeladene EK-Rechnungen
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    
    const db = await getDb()
    const rechnungen = await db.collection('fibu_ek_rechnungen')
      .find({
        rechnungsdatum: {
          $gte: new Date(from),
          $lte: new Date(to + 'T23:59:59')
        }
      })
      .sort({ rechnungsdatum: -1 })
      .toArray()
    
    return NextResponse.json({
      ok: true,
      rechnungen,
      count: rechnungen.length
    })
  } catch (error: any) {
    console.error('[EK-Rechnungen GET] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fibu/rechnungen/ek
 * Speichert EK-Rechnung (aus Upload/Parsing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lieferant,
      rechnungsnr,
      rechnungsdatum,
      eingangsdatum,
      brutto,
      netto,
      mwst,
      mwst_satz,
      positionen,
      pdf_base64,
      parsed_data
    } = body
    
    if (!lieferant || !rechnungsnr || !rechnungsdatum) {
      return NextResponse.json(
        { ok: false, error: 'Pflichtfelder fehlen' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const rechnung = {
      lieferant,
      rechnungsnr,
      rechnungsdatum: new Date(rechnungsdatum),
      eingangsdatum: eingangsdatum ? new Date(eingangsdatum) : new Date(),
      brutto: parseFloat(brutto) || 0,
      netto: parseFloat(netto) || 0,
      mwst: parseFloat(mwst) || 0,
      mwst_satz: parseFloat(mwst_satz) || 0.19,
      positionen: positionen || [],
      pdf_base64: pdf_base64 || null,
      parsed_data: parsed_data || null,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('fibu_ek_rechnungen').insertOne(rechnung)
    
    return NextResponse.json({
      ok: true,
      id: result.insertedId,
      message: 'EK-Rechnung gespeichert'
    })
  } catch (error: any) {
    console.error('[EK-Rechnungen POST] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
