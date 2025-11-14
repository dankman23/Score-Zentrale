export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { getJTLConnection } from '../../../../lib/db/mssql'

// Server-side Cache
let cachedData: any = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 Minuten Cache

/**
 * Vollständige FIBU-Übersicht
 * Zeigt ALLE nicht zugeordneten Datensätze für Oktober + November
 * Mit Server-Side Cache für schnellere Ladezeiten
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-11-30'
    const forceReload = searchParams.get('force') === 'true'
    
    const cacheKey = `${from}_${to}`
    const now = Date.now()
    
    // Check cache
    if (!forceReload && cachedData && cachedData.cacheKey === cacheKey && (now - cacheTimestamp) < CACHE_TTL) {
      console.log(`[FIBU Übersicht] ✅ Cache HIT: ${from} - ${to} (Alter: ${Math.round((now - cacheTimestamp) / 1000)}s)`)
      return NextResponse.json({
        ...cachedData.data,
        cached: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000)
      })
    }
    
    console.log(`[FIBU Übersicht] 🔄 Cache MISS: ${from} - ${to} - Lade neu...`)
    
    const mongoDb = await getDb()
    const mssqlPool = await getJTLConnection()
    
    // ========================================
    // 1. EK-RECHNUNGEN (Lieferanten)
    // ========================================
    const ekRechnungen = await mongoDb.collection('fibu_ek_rechnungen').find({
      rechnungsdatum: {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      }
    }).toArray()
    
    const ekStats = {
      total: ekRechnungen.length,
      mitBetrag: ekRechnungen.filter(r => r.gesamtBetrag > 0).length,
      ohneBetrag: ekRechnungen.filter(r => !r.gesamtBetrag || r.gesamtBetrag <= 0).length,
      ohneKreditor: ekRechnungen.filter(r => !r.kreditorKonto).length,
      ohneZahlung: ekRechnungen.filter(r => !r.zahlungId).length,
      gesamtBetrag: ekRechnungen.reduce((sum, r) => sum + (r.gesamtBetrag || 0), 0)
    }
    
    // ========================================
    // 2. VK-RECHNUNGEN (Verkauf aus JTL) - verwende existierende API
    // ========================================
    const vkResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fibu/rechnungen/vk?from=${from}&to=${to}&limit=5000`,
      { cache: 'no-store' }
    )
    const vkData = await vkResponse.json()
    const vkRechnungen = vkData.rechnungen || []
    
    const vkStats = {
      total: vkRechnungen.length,
      offen: vkRechnungen.filter((r: any) => r.status !== 'Bezahlt').length,
      bezahlt: vkRechnungen.filter((r: any) => r.status === 'Bezahlt').length,
      gesamtBetrag: vkRechnungen.reduce((sum: number, r: any) => sum + (r.brutto || 0), 0),
      offenerBetrag: vkRechnungen
        .filter((r: any) => r.status !== 'Bezahlt')
        .reduce((sum: number, r: any) => sum + (r.brutto || 0), 0)
    }
    
    // ========================================
    // 3. EXTERNE RECHNUNGEN (Amazon XRE, etc.) - verwende API
    // ========================================
    const externResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fibu/rechnungen/extern?from=${from}&to=${to}`,
      { cache: 'no-store' }
    )
    const externData = await externResponse.json()
    const externeRechnungen = externData.rechnungen || []
    
    const externStats = {
      total: externeRechnungen.length,
      gesamtBetrag: externeRechnungen.reduce((sum: number, r: any) => sum + (r.betrag || 0), 0)
    }
    
    // ========================================
    // 4. ZAHLUNGEN (JTL - alle Konten) - verwende API
    // ========================================
    const zahlungenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fibu/zahlungen?from=${from}&to=${to}&limit=5000`,
      { cache: 'no-store' }
    )
    const zahlungenData = await zahlungenResponse.json()
    const zahlungen = zahlungenData.zahlungen || []
    
    // Kategorisiere Zahlungen
    const zahlungStats = {
      total: zahlungen.length,
      positiv: zahlungen.filter((z: any) => z.betrag > 0).length,
      negativ: zahlungen.filter((z: any) => z.betrag < 0).length,
      positiverBetrag: zahlungen.filter((z: any) => z.betrag > 0).reduce((sum: number, z: any) => sum + z.betrag, 0),
      negativerBetrag: zahlungen.filter((z: any) => z.betrag < 0).reduce((sum: number, z: any) => sum + z.betrag, 0)
    }
    
    // Nach Zahlungsanbieter gruppieren
    const byAnbieter: any = {}
    zahlungen.forEach((z: any) => {
      const anbieter = z.zahlungsanbieter || 'Unbekannt'
      if (!byAnbieter[anbieter]) {
        byAnbieter[anbieter] = { count: 0, betrag: 0 }
      }
      byAnbieter[anbieter].count++
      byAnbieter[anbieter].betrag += z.betrag
    })
    
    zahlungStats.byAnbieter = byAnbieter
    
    // ========================================
    // 5. GUTSCHRIFTEN - verwende API
    // ========================================
    const gutschriftenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fibu/gutschriften?from=${from}&to=${to}`,
      { cache: 'no-store' }
    )
    const gutschriftenData = await gutschriftenResponse.json()
    const gutschriften = gutschriftenData.gutschriften || []
    
    const gutschriftStats = {
      total: gutschriften.length,
      gesamtBetrag: gutschriften.reduce((sum: number, g: any) => sum + (g.betrag || 0), 0)
    }
    
    // ========================================
    // ZUSAMMENFASSUNG
    // ========================================
    const summary = {
      zeitraum: { from, to },
      ekRechnungen: ekStats,
      vkRechnungen: vkStats,
      externeRechnungen: externStats,
      zahlungen: zahlungStats,
      gutschriften: gutschriftStats,
      
      // Kritische Issues
      issues: {
        ekOhneBetrag: ekStats.ohneBetrag,
        ekOhneKreditor: ekStats.ohneKreditor,
        ekOhneZahlung: ekStats.ohneZahlung,
        vkOffen: vkStats.offen,
        zahlungenNegativOhneZuordnung: zahlungStats.negativ  // Diese müssen alle zugeordnet werden
      }
    }
    
    // ========================================
    // DETAIL-LISTEN (Top 20 jeweils)
    // ========================================
    const details = {
      ekRechnungen: ekRechnungen.map(r => ({
        _id: r._id,
        lieferant: r.lieferantName,
        rechnungsNr: r.rechnungsNummer,
        datum: r.rechnungsdatum,
        betrag: r.gesamtBetrag || 0,
        kreditorKonto: r.kreditorKonto || null,
        zahlungId: r.zahlungId || null
      })),
      
      ekOhneBetrag: ekRechnungen
        .filter(r => !r.gesamtBetrag || r.gesamtBetrag <= 0)
        .slice(0, 20)
        .map(r => ({
          _id: r._id,
          lieferant: r.lieferantName,
          rechnungsNr: r.rechnungsNummer,
          datum: r.rechnungsdatum,
          grund: 'Kein Betrag extrahiert'
        })),
      
      ekOhneKreditor: ekRechnungen
        .filter(r => !r.kreditorKonto && r.gesamtBetrag > 0)
        .slice(0, 20)
        .map(r => ({
          _id: r._id,
          lieferant: r.lieferantName,
          rechnungsNr: r.rechnungsNummer,
          betrag: r.gesamtBetrag,
          datum: r.rechnungsdatum,
          grund: 'Kein Kreditor zugeordnet'
        })),
      
      vkOffen: vkRechnungen
        .filter((r: any) => r.status !== 'Bezahlt')
        .slice(0, 20)
        .map((r: any) => ({
          rechnungsNr: r.cRechnungsNr,
          kunde: r.kundenName,
          betrag: r.brutto,
          datum: r.rechnungsdatum,
          status: r.status
        })),
      
      zahlungenNegativ: zahlungen
        .filter((z: any) => z.betrag < 0)
        .slice(0, 30)
        .map((z: any) => ({
          id: z.id,
          betrag: z.betrag,
          datum: z.datum,
          anbieter: z.zahlungsanbieter,
          hinweis: z.hinweis,
          typ: 'Ausgabe - muss Konto zugeordnet werden'
        }))
    }
    
    return NextResponse.json({
      ok: true,
      summary,
      details,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[FIBU Übersicht] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
