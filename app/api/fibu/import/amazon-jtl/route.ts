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
