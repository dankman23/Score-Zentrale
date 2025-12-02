export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { 
  fetchAmazonSettlementsFromJTL, 
  aggregateAmazonSettlements,
  berechneZuordnungsStatus,
  AmazonBuchung 
} from '../../../../lib/fibu/amazon-import-v2'

/**
 * Amazon-Import aus JTL-SQL
 * 
 * Holt Amazon-Settlement-Daten aus der JTL-Datenbank und speichert sie
 * aggregiert in MongoDB (fibu_amazon_settlements)
 * 
 * Query-Parameter:
 * - from: Start-Datum (YYYY-MM-DD)
 * - to: End-Datum (YYYY-MM-DD)
 * - force: true = bestehende Daten überschreiben
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    const force = searchParams.get('force') === 'true'
    
    console.log(`[Amazon JTL Import] Starte Import für ${from} bis ${to}`)
    
    const db = await getDb()
    
    // 1. Hole Roh-Daten aus JTL-SQL
    console.log('[Amazon JTL Import] Hole Daten aus JTL-SQL...')
    const rawData = await fetchAmazonSettlementsFromJTL(from, to)
    console.log(`[Amazon JTL Import] ${rawData.length} Roh-Zeilen gefunden`)
    
    if (rawData.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Keine Amazon-Daten im angegebenen Zeitraum gefunden',
        imported: 0,
        aggregated: 0
      })
    }
    
    // 2. Lade VK-Rechnungen für Zuordnung
    console.log('[Amazon JTL Import] Lade VK-Rechnungen...')
    const vkRechnungen = await db.collection('fibu_vk_rechnungen').find({}).toArray()
    const rechnungenMap = new Map()
    vkRechnungen.forEach(r => {
      if (r.cBestellNr) rechnungenMap.set(r.cBestellNr, r)
      if (r.cRechnungsNr) rechnungenMap.set(r.cRechnungsNr, r)
    })
    console.log(`[Amazon JTL Import] ${rechnungenMap.size} Rechnungen geladen`)
    
    // 3. Aggregiere Daten nach Jera-Logik
    console.log('[Amazon JTL Import] Aggregiere Daten...')
    const buchungen = aggregateAmazonSettlements(rawData, rechnungenMap)
    console.log(`[Amazon JTL Import] ${buchungen.length} aggregierte Buchungen erstellt`)
    
    // 4. Berechne Zuordnungsstatus für jede Buchung
    console.log('[Amazon JTL Import] Berechne Zuordnungsstatus...')
    for (const buchung of buchungen) {
      buchung.zuordnungs_status = await berechneZuordnungsStatus(buchung, db)
    }
    
    // 5. Speichere in MongoDB
    console.log('[Amazon JTL Import] Speichere in MongoDB...')
    const collection = db.collection('fibu_amazon_settlements')
    
    // Lösche alte Daten für den Zeitraum (wenn force=true)
    if (force) {
      const deleteResult = await collection.deleteMany({
        datum: {
          $gte: from,
          $lte: to
        }
      })
      console.log(`[Amazon JTL Import] ${deleteResult.deletedCount} alte Einträge gelöscht`)
    }
    
    // Speichere neue Daten
    const insertDocs = buchungen.map(b => ({
      ...b,
      datumDate: new Date(b.datum),
      importedAt: new Date(),
      source: 'jtl_sql_import'
    }))
    
    if (insertDocs.length > 0) {
      await collection.insertMany(insertDocs)
    }
    
    // 6. Statistiken berechnen
    const stats = {
      gesamt: buchungen.length,
      nach_konto: {} as Record<string, { anzahl: number, summe: number }>
    }
    
    for (const buchung of buchungen) {
      const konto = buchung.gegenkonto_konto_nr
      if (!stats.nach_konto[konto]) {
        stats.nach_konto[konto] = { anzahl: 0, summe: 0 }
      }
      stats.nach_konto[konto].anzahl++
      stats.nach_konto[konto].summe += buchung.betrag
    }
    
    console.log('[Amazon JTL Import] Import erfolgreich abgeschlossen')
    console.log(`  Roh-Daten: ${rawData.length}`)
    console.log(`  Aggregiert: ${buchungen.length}`)
    console.log(`  Konten:`, stats.nach_konto)
    
    return NextResponse.json({
      ok: true,
      message: 'Amazon-Daten erfolgreich importiert',
      zeitraum: { from, to },
      roh_daten: rawData.length,
      aggregierte_buchungen: buchungen.length,
      stats
    })
    
  } catch (err: any) {
    console.error('[Amazon JTL Import] Fehler:', err.message)
    console.error(err.stack)
    return NextResponse.json({
      ok: false,
      error: err.message,
      stack: err.stack
    }, { status: 500 })
  }
}
