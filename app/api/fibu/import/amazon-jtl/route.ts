export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { 
  importAndAggregateAmazonJtlData
} from '../../../../lib/fibu/amazon-import-v2'

/**
 * Amazon-Import aus JTL-SQL (NEU: mit Geldtransit!)
 * 
 * Holt Amazon-Settlement-Daten UND Auszahlungs-Daten aus der JTL-Datenbank
 * und speichert sie aggregiert in MongoDB (zahlungen)
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
    
    console.log(`[Amazon JTL Import] Starte Import für ${from} bis ${to}`)
    
    const db = await getDb()
    
    // Verwende die neue, vereinheitlichte Import-Funktion
    const result = await importAndAggregateAmazonJtlData(db, from, to)
    
    if (!result.success) {
      return NextResponse.json({
        ok: false,
        message: result.message,
        stats: result.stats
      }, { status: 500 })
    }
    
    // Berechne detaillierte Statistiken
    const collection = db.collection('zahlungen')
    const allBuchungen = await collection.find({
      anbieter: 'Amazon',
      datum: { $gte: from, $lt: to }
    }).toArray()
    
    // Gruppiere nach Gegenkonto
    const nachKonto = new Map<string, { anzahl: number; summe: number }>()
    allBuchungen.forEach(b => {
      const konto = b.gegenkonto_konto_nr
      if (!nachKonto.has(konto)) {
        nachKonto.set(konto, { anzahl: 0, summe: 0 })
      }
      const stats = nachKonto.get(konto)!
      stats.anzahl++
      stats.summe += b.betrag
    })
    
    const gesamt_summe = allBuchungen.reduce((sum, b) => sum + b.betrag, 0)
    const positive_summe = allBuchungen.filter(b => b.betrag > 0).reduce((sum, b) => sum + b.betrag, 0)
    const negative_summe = allBuchungen.filter(b => b.betrag < 0).reduce((sum, b) => sum + b.betrag, 0)
    
    console.log('\n📊 Import-Statistiken:')
    console.log(`  Roh-Daten: ${result.stats.total}`)
    console.log(`  Aggregierte Buchungen: ${allBuchungen.length}`)
    console.log(`  Gesamt-Summe: ${gesamt_summe.toFixed(2)} EUR`)
    console.log(`  Positive Summe: ${positive_summe.toFixed(2)} EUR`)
    console.log(`  Negative Summe: ${negative_summe.toFixed(2)} EUR`)
    console.log(`  Konten:`)
    for (const [konto, stats] of nachKonto.entries()) {
      console.log(`    ${konto}: ${stats.anzahl} Buchungen, ${stats.summe.toFixed(2)} EUR`)
    }
    
    return NextResponse.json({
      ok: true,
      message: result.message,
      zeitraum: { from, to },
      stats: {
        roh_daten: result.stats.total,
        gesamt_buchungen: allBuchungen.length,
        gesamt_summe: gesamt_summe,
        positive_summe: positive_summe,
        negative_summe: negative_summe,
        nach_konto: Object.fromEntries(nachKonto.entries())
      }
    })
    
  } catch (error: any) {
    console.error('[Amazon JTL Import] Fehler:', error)
    return NextResponse.json({
      ok: false,
      message: `Fehler beim Import: ${error.message}`,
      stack: error.stack
    }, { status: 500 })
  }
}

// Alte Implementierung entfernt - verwende jetzt importAndAggregateAmazonJtlData()
    
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
      gesamt_buchungen: buchungen.length,
      gesamt_summe: 0,
      positive_summe: 0,
      negative_summe: 0,
      nach_konto: {} as Record<string, { anzahl: number, summe: number }>
    }
    
    for (const buchung of buchungen) {
      const konto = buchung.gegenkonto_konto_nr
      if (!stats.nach_konto[konto]) {
        stats.nach_konto[konto] = { anzahl: 0, summe: 0 }
      }
      stats.nach_konto[konto].anzahl++
      stats.nach_konto[konto].summe += buchung.betrag
      
      stats.gesamt_summe += buchung.betrag
      if (buchung.betrag > 0) {
        stats.positive_summe += buchung.betrag
      } else {
        stats.negative_summe += buchung.betrag
      }
    }
    
    // Runde Summen auf 2 Dezimalstellen
    stats.gesamt_summe = Math.round(stats.gesamt_summe * 100) / 100
    stats.positive_summe = Math.round(stats.positive_summe * 100) / 100
    stats.negative_summe = Math.round(stats.negative_summe * 100) / 100
    
    for (const konto in stats.nach_konto) {
      stats.nach_konto[konto].summe = Math.round(stats.nach_konto[konto].summe * 100) / 100
    }
    
    console.log('[Amazon JTL Import] Import erfolgreich abgeschlossen')
    console.log(`  Roh-Daten: ${rawData.length}`)
    console.log(`  Aggregierte Buchungen: ${buchungen.length}`)
    console.log(`  Gesamt-Summe: ${stats.gesamt_summe} EUR`)
    console.log(`  Positive Summe: ${stats.positive_summe} EUR`)
    console.log(`  Negative Summe: ${stats.negative_summe} EUR`)
    console.log(`  Konten:`)
    for (const konto in stats.nach_konto) {
      console.log(`    ${konto}: ${stats.nach_konto[konto].anzahl} Buchungen, ${stats.nach_konto[konto].summe} EUR`)
    }
    
    return NextResponse.json({
      ok: true,
      message: 'Amazon-Daten erfolgreich importiert',
      zeitraum: { from, to },
      roh_daten: rawData.length,
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
