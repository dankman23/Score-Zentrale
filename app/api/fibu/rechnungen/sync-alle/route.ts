/**
 * POST /api/fibu/rechnungen/sync-alle
 * 
 * Befüllt fibu_rechnungen_alle aus funktionierenden Quellen:
 * 1. fibu_vk_rechnungen (aus JTL)
 * 2. Externe Rechnungen via /api/fibu/rechnungen/extern
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/mongodb'
import { getMssqlPool } from '@/lib/db/mssql'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from = '2025-10-01', to = '2025-10-31' } = body
    
    console.log(`[Sync Alle Rechnungen] Zeitraum: ${from} - ${to}`)
    
    const db = await getDb()
    const alleRechnungenColl = db.collection('fibu_rechnungen_alle')
    
    const stats = {
      vkGesamt: 0,
      vkGespeichert: 0,
      externGesamt: 0,
      externGespeichert: 0
    }
    
    // 1. VK-Rechnungen aus MongoDB
    console.log('[Sync] Lade VK-Rechnungen aus fibu_vk_rechnungen...')
    const vkColl = db.collection('fibu_vk_rechnungen')
    const vkRechnungen = await vkColl.find({
      rechnungsdatum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      }
    }).toArray()
    
    stats.vkGesamt = vkRechnungen.length
    console.log(`[Sync] Gefunden: ${vkRechnungen.length} VK-Rechnungen`)
    
    for (const r of vkRechnungen) {
      const uniqueId = `RECHNUNG_${r.kRechnung || r._id.toString()}`
      
      await alleRechnungenColl.updateOne(
        { uniqueId },
        {
          $set: {
            uniqueId,
            quelle: 'RECHNUNG',
            belegId: r.kRechnung || r._id.toString(),
            belegnummer: r.cRechnungsNr || r.rechnungsNr,
            belegdatum: r.rechnungsdatum,
            brutto: r.brutto || 0,
            netto: r.netto || 0,
            mwst: r.mwst || 0,
            kundenName: r.kundenName || 'Unbekannt',
            kundenLand: r.kundenLand || 'DE',
            kundenUstId: r.kundenUstId || '',
            zahlungsart: r.zahlungsart || 'Unbekannt',
            status: r.status || 'Offen',
            cBestellNr: r.cBestellNr || '',
            kBestellung: r.kBestellung,
            debitorKonto: r.debitorKonto,
            sachkonto: r.sachkonto,
            updated_at: new Date()
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
      stats.vkGespeichert++
    }
    
    console.log(`[Sync] ✅ ${stats.vkGespeichert} VK-Rechnungen gespeichert`)
    
    // 2. Externe Rechnungen direkt aus JTL MSSQL
    console.log('[Sync] Lade externe Rechnungen aus JTL...')
    const pool = await getMssqlPool()
    
    const externQuery = `
      SELECT 
        eb.kExternerBeleg,
        eb.cBelegnr AS rechnungsNr,
        eb.dBelegdatumUtc AS datum,
        eb.cRAName AS kunde,
        ISNULL(eb.cRALandISO, 'DE') AS kundenLand,
        ISNULL(eb.cKaeuferUstId, '') AS kundenUstId,
        eb.kZahlungsart,
        ISNULL(za.cName, 'Amazon Payment') AS zahlungsart,
        0 AS brutto,
        0 AS netto,
        0 AS mwst,
        ISNULL(eb.cHerkunft, 'VCS-Lite') AS herkunft,
        eb.nBelegtyp,
        eb.kKunde,
        NULL AS kBestellung,
        '' AS cBestellNr
      FROM Rechnung.tExternerBeleg eb
      LEFT JOIN dbo.tZahlungsart za ON eb.kZahlungsart = za.kZahlungsart
      WHERE eb.dBelegdatumUtc >= @from
        AND eb.dBelegdatumUtc < DATEADD(day, 1, @to)
        AND eb.nBelegtyp = 0
      ORDER BY eb.dBelegdatumUtc DESC
    `
    
    const externResult = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(externQuery)
    
    stats.externGesamt = externResult.recordset.length
    console.log(`[Sync] Gefunden: ${stats.externGesamt} externe Rechnungen`)
    
    for (const r of externResult.recordset) {
      const uniqueId = `EXTERN_${r.kExternerBeleg}`
      
      await alleRechnungenColl.updateOne(
        { uniqueId },
        {
          $set: {
            uniqueId,
            quelle: 'EXTERN',
            belegId: r.kExternerBeleg,
            belegnummer: r.rechnungsNr,
            belegdatum: r.datum,
            brutto: parseFloat(r.brutto || 0),
            netto: parseFloat(r.netto || 0),
            mwst: parseFloat(r.mwst || 0),
            kundenName: r.kunde || 'Unbekannt',
            kundenLand: r.kundenLand,
            kundenUstId: r.kundenUstId || '',
            zahlungsart: r.zahlungsart,
            status: 'Bezahlt',  // Externe Rechnungen sind meist bezahlt
            cBestellNr: r.cBestellNr || '',
            kBestellung: r.kBestellung,
            debitorKonto: null,
            sachkonto: '8400',  // Standard Erlöskonto
            herkunft: r.herkunft,
            updated_at: new Date()
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
      stats.externGespeichert++
    }
    
    console.log(`[Sync] ✅ ${stats.externGespeichert} externe Rechnungen gespeichert`)
    
    // Finale Statistik
    const totalInCollection = await alleRechnungenColl.countDocuments()
    const rechnungCount = await alleRechnungenColl.countDocuments({ quelle: 'RECHNUNG' })
    const externCount = await alleRechnungenColl.countDocuments({ quelle: 'EXTERN' })
    
    return NextResponse.json({
      ok: true,
      message: 'Sync erfolgreich',
      stats,
      collectionStats: {
        total: totalInCollection,
        rechnung: rechnungCount,
        extern: externCount
      },
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('[Sync Alle Rechnungen] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
