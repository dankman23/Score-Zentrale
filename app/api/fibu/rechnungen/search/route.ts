/**
 * GET /api/fibu/rechnungen/search
 * 
 * Sucht Rechnungen nach verschiedenen Kriterien
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const auNummer = searchParams.get('auNummer')
    const reNummer = searchParams.get('reNummer')
    const betrag = searchParams.get('betrag')
    const datum = searchParams.get('datum')
    
    const db = await getDb()
    const collection = db.collection('fibu_rechnungen_alle')
    
    let query: any = {}
    
    // Suche nach AU-Nummer
    if (auNummer) {
      query.cBestellNr = { $regex: auNummer, $options: 'i' }
    }
    
    // Suche nach RE-Nummer
    if (reNummer) {
      query.$or = [
        { belegnummer: { $regex: reNummer, $options: 'i' } },
        { cRechnungsNr: { $regex: reNummer, $options: 'i' } }
      ]
    }
    
    // Suche nach Betrag
    if (betrag) {
      const betragNum = parseFloat(betrag)
      query.brutto = {
        $gte: betragNum - 0.50,
        $lte: betragNum + 0.50
      }
    }
    
    // Suche nach Datum (±7 Tage)
    if (datum) {
      const datumDate = new Date(datum)
      const before = new Date(datumDate)
      before.setDate(before.getDate() - 7)
      const after = new Date(datumDate)
      after.setDate(after.getDate() + 3)
      
      query.rechnungsdatum = {
        $gte: before,
        $lte: after
      }
    }
    
    const rechnungen = await collection.find(query).limit(20).toArray()
    
    return NextResponse.json({
      ok: true,
      count: rechnungen.length,
      rechnungen: rechnungen.map(r => ({
        _id: r._id.toString(),
        belegnummer: r.belegnummer,
        cBestellNr: r.cBestellNr,
        cRechnungsNr: r.cRechnungsNr,
        brutto: r.brutto,
        rechnungsdatum: r.rechnungsdatum,
        quelle: r.quelle
      }))
    })
    
  } catch (error: any) {
    console.error('[Rechnungen Search] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
