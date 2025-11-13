export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'
import { getDb } from '../../../lib/db/mongodb'

/**
 * Gutschriften aus dbo.tgutschrift laden
 * Dies sind Rechnungskorrekturen (GU2025-XXXXX)
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
        g.kGutschrift,
        g.cGutschriftNr,
        g.dErstellt,
        g.kRechnung,
        g.kKunde,
        g.fPreis,
        g.fMwSt,
        g.cWaehrung,
        g.cStatus,
        g.nStorno,
        r.cRechnungsNr
      FROM dbo.tgutschrift g
      LEFT JOIN dbo.tRechnung r ON g.kRechnung = r.kRechnung
      WHERE g.dErstellt >= @from
        AND g.dErstellt < DATEADD(day, 1, @to)
      ORDER BY g.dErstellt DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    const gutschriften = result.recordset.map((g: any) => ({
      kGutschrift: g.kGutschrift,
      belegnummer: g.cGutschriftNr,
      belegdatum: g.dErstellt,
      kRechnung: g.kRechnung,
      originalRechnungNr: g.cRechnungsNr || '',
      kKunde: g.kKunde,
      kundenName: `Kunde #${g.kKunde}`,
      kundenLand: 'DE',
      brutto: -1 * parseFloat(g.fPreis || 0), // Negativ für Gutschrift
      mwst: -1 * parseFloat(g.fMwSt || 0),
      netto: -1 * (parseFloat(g.fPreis || 0) - parseFloat(g.fMwSt || 0)),
      mwstSatz: (g.fPreis - g.fMwSt) > 0 ? parseFloat((g.fMwSt / (g.fPreis - g.fMwSt) * 100).toFixed(2)) : 0,
      waehrung: g.cWaehrung || 'EUR',
      status: g.nStorno ? 'Storniert' : (g.cStatus || 'Offen'),
      istStorniert: g.nStorno === 1
    }))
    
    // MongoDB speichern
    const db = await getDb()
    const collection = db.collection('fibu_gutschriften')
    
    for (const gutschrift of gutschriften) {
      await collection.updateOne(
        { kGutschrift: gutschrift.kGutschrift },
        { 
          $set: { 
            ...gutschrift,
            updated_at: new Date() 
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
    }
    
    return NextResponse.json({
      ok: true,
      gutschriften,
      total: gutschriften.length,
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('Fehler beim Laden der Gutschriften:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
