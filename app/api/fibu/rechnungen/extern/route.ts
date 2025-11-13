export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * Externe Rechnungen aus Rechnung.tExternerBeleg laden
 * Dies sind Amazon VCS-Lite Rechnungen (XRE-XXXXX)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '10000', 10)
    
    const pool = await getMssqlPool()
    
    const query = `
      SELECT TOP ${limit}
        eb.kExternerBeleg,
        eb.cBelegnr,
        eb.dBelegdatumUtc,
        eb.nBelegtyp,
        eb.cHerkunft,
        eb.kKunde,
        eb.cRAName,
        eb.cRALandISO,
        eb.cKaeuferUstId,
        eb.kZahlungsart,
        eb.cWaehrungISO,
        eck.fVkBrutto,
        eck.fVkNetto,
        za.cName AS zahlungsartName
      FROM Rechnung.tExternerBeleg eb
      LEFT JOIN Rechnung.tExternerBelegEckdaten eck ON eb.kExternerBeleg = eck.kExternerBeleg
      LEFT JOIN dbo.tZahlungsart za ON eb.kZahlungsart = za.kZahlungsart
      WHERE eb.dBelegdatumUtc >= @from
        AND eb.dBelegdatumUtc < DATEADD(day, 1, @to)
        AND eb.nBelegtyp = 0
      ORDER BY eb.dBelegdatumUtc DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    const rechnungen = result.recordset.map((r: any) => ({
      kExternerBeleg: r.kExternerBeleg,
      belegnummer: r.cBelegnr,
      belegdatum: r.dBelegdatumUtc,
      belegtyp: r.nBelegtyp,
      herkunft: r.cHerkunft,
      kKunde: r.kKunde,
      kundenName: r.cRAName || 'Unbekannt',
      kundenLand: r.cRALandISO || 'DE',
      kundenUstId: r.cKaeuferUstId || '',
      kZahlungsart: r.kZahlungsart,
      zahlungsart: r.zahlungsartName || 'Amazon Payment',
      waehrung: r.cWaehrungISO || 'EUR',
      brutto: parseFloat(r.fBrutto || 0),
      netto: parseFloat(r.fNetto || 0),
      steuer: parseFloat(r.fSteuer || 0),
      mwstSatz: r.fNetto > 0 ? parseFloat((r.fSteuer / r.fNetto * 100).toFixed(2)) : 0
    }))
    
    // MongoDB speichern
    const db = await getDb()
    const collection = db.collection('fibu_externe_rechnungen')
    
    for (const rechnung of rechnungen) {
      await collection.updateOne(
        { kExternerBeleg: rechnung.kExternerBeleg },
        { 
          $set: { 
            ...rechnung,
            updated_at: new Date() 
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
    }
    
    return NextResponse.json({
      ok: true,
      rechnungen,
      total: rechnungen.length,
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('Fehler beim Laden externer Rechnungen:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
