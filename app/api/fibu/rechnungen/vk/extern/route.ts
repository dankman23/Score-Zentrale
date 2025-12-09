export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'
import { getDb } from '@/../lib/db/mongodb'
import { getDebitorKonto, getSachkonto, isGutschrift } from '@/../lib/fibu-utils'

/**
 * GET /api/fibu/rechnungen/vk/extern
 * Lädt externe Rechnungen (Amazon, eBay, etc.) aus JTL-Wawi
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    
    const pool = await getMssqlPool()
    
    // Query für externe Rechnungen
    const query = `
      SELECT TOP ${limit}
        er.kExterneRechnung AS kRechnung,
        er.cRechnungsnummer AS cRechnungsNr,
        er.dErstellt AS rechnungsdatum,
        er.fBrutto AS brutto,
        ISNULL(er.cPlattform, 'Extern') AS plattform,
        ISNULL(er.cTransaktionstyp, 'Verkauf') AS transaktionstyp,
        0 AS kKunde
      FROM Verkauf.lvExterneRechnung er
      WHERE er.dErstellt >= @from 
        AND er.dErstellt < @to
      ORDER BY er.dErstellt DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    const rechnungen = []
    
    for (const r of result.recordset) {
      try {
        const brutto = parseFloat(r.brutto || 0)
        // Für externe Rechnungen: Schätzung von Netto (vereinfacht mit 19% MwSt)
        const netto = brutto / 1.19
        const mwst = brutto - netto
        const mwstSatz = 19
        
        // Plattform als Zahlungsart nutzen
        let zahlungsart = r.plattform
        let kZahlungsart = 0
        
        // Mapping für bekannte Plattformen
        if (r.plattform === 'Amazon') {
          kZahlungsart = 8 // Amazon Payment
          zahlungsart = 'Amazon Payment'
        } else if (r.plattform === 'eBay') {
          kZahlungsart = 7 // eBay Managed Payments
          zahlungsart = 'eBay Managed Payments'
        }
        
        rechnungen.push({
          kRechnung: r.kRechnung,
          cRechnungsNr: r.cRechnungsNr,
          rechnungsdatum: r.rechnungsdatum,
          brutto: parseFloat(brutto.toFixed(2)),
          netto: parseFloat(netto.toFixed(2)),
          mwst: parseFloat(mwst.toFixed(2)),
          mwstSatz: parseFloat(mwstSatz.toFixed(2)),
          status: 'Bezahlt', // Externe Rechnungen sind i.d.R. bereits bezahlt
          kKunde: 0,
          kundenName: r.plattform,
          kundenLand: 'DE',
          kundenUstId: null,
          zahlungsart,
          kZahlungsart,
          istGutschrift: isGutschrift(r.cRechnungsNr),
          istInnerg: false,
          istExtern: true,
          plattform: r.plattform,
          debitorKonto: getDebitorKonto(kZahlungsart, 'DE', false),
          sachkonto: getSachkonto('DE', false, mwstSatz)
        })
      } catch (err) {
        console.error(`Fehler bei externer Rechnung ${r.kRechnung}:`, err)
      }
    }
    
    // Speichere in MongoDB
    const db = await getDb()
    const collection = db.collection('fibu_vk_rechnungen_extern')
    
    for (const rechnung of rechnungen) {
      await collection.updateOne(
        { kRechnung: rechnung.kRechnung },
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
    console.error('[Externe Rechnungen] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
