export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { getJTLConnection } from '../../../../lib/db/mssql'

/**
 * Vollständige FIBU-Übersicht
 * Zeigt ALLE nicht zugeordneten Datensätze für Oktober + November
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-11-30'
    
    const mongoDb = await getDb()
    const mssqlPool = await getJTLConnection()
    
    console.log(`[FIBU Übersicht] Zeitraum: ${from} - ${to}`)
    
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
    // 4. ZAHLUNGEN (JTL - alle Konten)
    // ========================================
    const zahlungenQuery = `
      SELECT 
        kZahlung,
        cHinweis,
        fBetrag,
        dErstellt,
        cZahlungsanbieter,
        cISO
      FROM (
        SELECT 
          kZahlung,
          cHinweis,
          fBetrag,
          dErstellt,
          cZahlungsanbieter,
          cISO
        FROM dbo.tZahlung
        WHERE dErstellt >= @from
          AND dErstellt <= @to
        
        UNION ALL
        
        SELECT 
          kZahlungsabgleichUmsatz as kZahlung,
          cHinweis,
          fBetrag,
          dErstellt,
          'Commerzbank' as cZahlungsanbieter,
          'EUR' as cISO
        FROM dbo.tZahlungsabgleichUmsatz
        WHERE dErstellt >= @from
          AND dErstellt <= @to
      ) AS AlleZahlungen
      ORDER BY dErstellt DESC
    `
    
    const zahlungenResult = await mssqlPool.request()
      .input('from', from)
      .input('to', to + ' 23:59:59')
      .query(zahlungenQuery)
    
    const zahlungen = zahlungenResult.recordset
    
    // Kategorisiere Zahlungen
    const zahlungStats = {
      total: zahlungen.length,
      positiv: zahlungen.filter(z => z.fBetrag > 0).length,
      negativ: zahlungen.filter(z => z.fBetrag < 0).length,
      positiverBetrag: zahlungen.filter(z => z.fBetrag > 0).reduce((sum, z) => sum + z.fBetrag, 0),
      negativerBetrag: zahlungen.filter(z => z.fBetrag < 0).reduce((sum, z) => sum + z.fBetrag, 0)
    }
    
    // Nach Zahlungsanbieter gruppieren
    const byAnbieter: any = {}
    zahlungen.forEach(z => {
      const anbieter = z.cZahlungsanbieter || 'Unbekannt'
      if (!byAnbieter[anbieter]) {
        byAnbieter[anbieter] = { count: 0, betrag: 0 }
      }
      byAnbieter[anbieter].count++
      byAnbieter[anbieter].betrag += z.fBetrag
    })
    
    zahlungStats.byAnbieter = byAnbieter
    
    // ========================================
    // 5. GUTSCHRIFTEN
    // ========================================
    const gutschriftenQuery = `
      SELECT 
        kRechnung,
        cRechnungNr,
        dErstellt,
        fGesamtsumme,
        cFirma
      FROM dbo.tRechnung
      WHERE dErstellt >= @from
        AND dErstellt <= @to
        AND cType = 'Gutschrift'
      ORDER BY dErstellt DESC
    `
    
    const gutschriftenResult = await mssqlPool.request()
      .input('from', from)
      .input('to', to + ' 23:59:59')
      .query(gutschriftenQuery)
    
    const gutschriften = gutschriftenResult.recordset
    
    const gutschriftStats = {
      total: gutschriften.length,
      gesamtBetrag: gutschriften.reduce((sum, g) => sum + (g.fGesamtsumme || 0), 0)
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
        .filter(r => r.cStatus !== 'Bezahlt')
        .slice(0, 20)
        .map(r => ({
          rechnungsNr: r.cRechnungNr,
          kunde: r.cFirma,
          betrag: r.fGesamtsumme,
          datum: r.dErstellt,
          status: r.cStatus
        })),
      
      zahlungenNegativ: zahlungen
        .filter(z => z.fBetrag < 0)
        .slice(0, 30)
        .map(z => ({
          kZahlung: z.kZahlung,
          betrag: z.fBetrag,
          datum: z.dErstellt,
          anbieter: z.cZahlungsanbieter,
          hinweis: z.cHinweis,
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
