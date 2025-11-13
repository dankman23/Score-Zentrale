export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * ALLE Rechnungen aus JTL-Wawi laden
 * 
 * Kombiniert 3 Quellen:
 * 1. dbo.tRechnung - Normale Ausgangsrechnungen (RE2025-XXXXX)
 * 2. Rechnung.tExternerBeleg - Externe Rechnungen von Amazon VCS-Lite (XRE-XXXXX)
 * 3. dbo.tgutschrift - Gutschriften/Rechnungskorrekturen (GU2025-XXXXX)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '10000', 10)
    
    const pool = await getMssqlPool()
    
    /**
     * UNION Query für alle 3 Rechnungstypen
     */
    const query = `
      -- Teil 1: Normale Rechnungen aus dbo.tRechnung
      SELECT TOP ${Math.floor(limit / 3)}
        'RECHNUNG' AS quelle,
        r.kRechnung AS belegId,
        r.cRechnungsNr AS belegnummer,
        r.dErstellt AS belegdatum,
        ISNULL(rv.fGesamtBruttopreis, 0) AS brutto,
        ISNULL(rv.fGesamtNettopreis, 0) AS netto,
        (ISNULL(rv.fGesamtBruttopreis, 0) - ISNULL(rv.fGesamtNettopreis, 0)) AS mwst,
        CASE 
          WHEN ISNULL(rv.fGesamtNettopreis, 0) > 0 
          THEN ROUND((ISNULL(rv.fGesamtBruttopreis, 0) - ISNULL(rv.fGesamtNettopreis, 0)) / ISNULL(rv.fGesamtNettopreis, 0) * 100, 2)
          ELSE 0
        END AS mwstSatz,
        r.cStatus AS status,
        r.tBestellung_kBestellung AS kBestellung,
        b.cBestellNr,
        r.tKunde_kKunde AS kKunde,
        CASE 
          WHEN k.cFirma IS NOT NULL AND k.cFirma != '' THEN k.cFirma
          ELSE k.cVorname + ' ' + k.cNachname
        END AS kundenName,
        ISNULL(k.cLand, 'DE') AS kundenLand,
        '' AS kundenUstId,
        r.kZahlungsart,
        ISNULL(za.cName, 'Unbekannt') AS zahlungsart,
        CASE WHEN r.cStatus = 'Bezahlt' THEN 1 ELSE 0 END AS istBezahlt,
        0 AS istGutschrift,
        0 AS istExtern,
        NULL AS herkunft,
        '' AS debitorKonto,
        '' AS sachkonto
      FROM dbo.tRechnung r
      LEFT JOIN dbo.tBestellung b ON r.tBestellung_kBestellung = b.kBestellung
      LEFT JOIN dbo.tKunde k ON r.tKunde_kKunde = k.kKunde
      LEFT JOIN dbo.tZahlungsart za ON r.kZahlungsart = za.kZahlungsart
      LEFT JOIN Verkauf.lvRechnungsverwaltung rv ON r.kRechnung = rv.kRechnung
      WHERE r.dErstellt >= @from
        AND r.dErstellt < DATEADD(day, 1, @to)
      
      UNION ALL
      
      -- Teil 2: Externe Rechnungen (Amazon VCS-Lite)
      SELECT TOP ${Math.floor(limit / 3)}
        'EXTERN' AS quelle,
        eb.kExternerBeleg AS belegId,
        eb.cBelegnr AS belegnummer,
        eb.dBelegdatumUtc AS belegdatum,
        ISNULL(eck.fBrutto, 0) AS brutto,
        ISNULL(eck.fNetto, 0) AS netto,
        (ISNULL(eck.fBrutto, 0) - ISNULL(eck.fNetto, 0)) AS mwst,
        CASE 
          WHEN ISNULL(eck.fNetto, 0) > 0 
          THEN ROUND((ISNULL(eck.fBrutto, 0) - ISNULL(eck.fNetto, 0)) / ISNULL(eck.fNetto, 0) * 100, 2)
          ELSE 0
        END AS mwstSatz,
        CASE WHEN eb.nBelegtyp = 0 THEN 'Offen' ELSE 'Storniert' END AS status,
        NULL AS kBestellung,
        '' AS cBestellNr,
        eb.kKunde,
        eb.cRAName AS kundenName,
        ISNULL(eb.cRALandISO, 'DE') AS kundenLand,
        eb.cKaeuferUstId AS kundenUstId,
        eb.kZahlungsart,
        ISNULL(za.cName, 'Amazon Payment') AS zahlungsart,
        0 AS istBezahlt,
        0 AS istGutschrift,
        1 AS istExtern,
        eb.cHerkunft AS herkunft,
        '' AS debitorKonto,
        '' AS sachkonto
      FROM Rechnung.tExternerBeleg eb
      LEFT JOIN Rechnung.tExternerBelegEckdaten eck ON eb.kExternerBeleg = eck.kExternerBeleg
      LEFT JOIN dbo.tZahlungsart za ON eb.kZahlungsart = za.kZahlungsart
      WHERE eb.dBelegdatumUtc >= @from
        AND eb.dBelegdatumUtc < DATEADD(day, 1, @to)
        AND eb.nBelegtyp = 0  -- Nur Rechnungen, keine Korrekturen/Stornos
      
      UNION ALL
      
      -- Teil 3: Gutschriften (negative Rechnungen)
      SELECT TOP ${Math.floor(limit / 3)}
        'GUTSCHRIFT' AS quelle,
        g.kGutschrift AS belegId,
        g.cGutschriftNr AS belegnummer,
        g.dErstellt AS belegdatum,
        -1 * ISNULL(g.fPreis, 0) AS brutto,  -- Negativ für Gutschrift
        -1 * (ISNULL(g.fPreis, 0) - ISNULL(g.fMwSt, 0)) AS netto,
        -1 * ISNULL(g.fMwSt, 0) AS mwst,
        CASE 
          WHEN (ISNULL(g.fPreis, 0) - ISNULL(g.fMwSt, 0)) > 0 
          THEN ROUND(ISNULL(g.fMwSt, 0) / (ISNULL(g.fPreis, 0) - ISNULL(g.fMwSt, 0)) * 100, 2)
          ELSE 0
        END AS mwstSatz,
        CASE WHEN g.nStorno = 1 THEN 'Storniert' ELSE g.cStatus END AS status,
        NULL AS kBestellung,
        '' AS cBestellNr,
        g.kKunde,
        CASE 
          WHEN k.cFirma IS NOT NULL AND k.cFirma != '' THEN k.cFirma
          ELSE k.cVorname + ' ' + k.cNachname
        END AS kundenName,
        ISNULL(k.cLand, 'DE') AS kundenLand,
        '' AS kundenUstId,
        NULL AS kZahlungsart,
        'Gutschrift' AS zahlungsart,
        0 AS istBezahlt,
        1 AS istGutschrift,
        0 AS istExtern,
        NULL AS herkunft,
        '' AS debitorKonto,
        '' AS sachkonto
      FROM dbo.tgutschrift g
      LEFT JOIN dbo.tKunde k ON g.kKunde = k.kKunde
      WHERE g.dErstellt >= @from
        AND g.dErstellt < DATEADD(day, 1, @to)
      
      ORDER BY belegdatum DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    const rechnungen = result.recordset.map((r: any) => ({
      quelle: r.quelle,
      belegId: r.belegId,
      belegnummer: r.belegnummer,
      belegdatum: r.belegdatum,
      brutto: parseFloat(r.brutto || 0),
      netto: parseFloat(r.netto || 0),
      mwst: parseFloat(r.mwst || 0),
      mwstSatz: parseFloat(r.mwstSatz || 0),
      status: r.status || 'Offen',
      kBestellung: r.kBestellung,
      cBestellNr: r.cBestellNr || '',
      kKunde: r.kKunde,
      kundenName: r.kundenName || 'Unbekannt',
      kundenLand: r.kundenLand,
      kundenUstId: r.kundenUstId || '',
      kZahlungsart: r.kZahlungsart,
      zahlungsart: r.zahlungsart,
      istBezahlt: r.istBezahlt === 1,
      istGutschrift: r.istGutschrift === 1,
      istExtern: r.istExtern === 1,
      herkunft: r.herkunft,
      debitorKonto: r.debitorKonto,
      sachkonto: r.sachkonto
    }))
    
    // MongoDB speichern
    const db = await getDb()
    const collection = db.collection('fibu_rechnungen_alle')
    
    for (const rechnung of rechnungen) {
      const uniqueId = `${rechnung.quelle}_${rechnung.belegId}`
      
      await collection.updateOne(
        { uniqueId },
        { 
          $set: { 
            ...rechnung,
            uniqueId,
            updated_at: new Date() 
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
    }
    
    // Statistiken
    const stats = {
      gesamt: rechnungen.length,
      normale: rechnungen.filter(r => r.quelle === 'RECHNUNG').length,
      externe: rechnungen.filter(r => r.quelle === 'EXTERN').length,
      gutschriften: rechnungen.filter(r => r.quelle === 'GUTSCHRIFT').length,
      bezahlt: rechnungen.filter(r => r.istBezahlt).length,
      offen: rechnungen.filter(r => !r.istBezahlt && r.quelle !== 'GUTSCHRIFT').length
    }
    
    return NextResponse.json({
      ok: true,
      rechnungen,
      stats,
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('Fehler beim Laden aller Rechnungen:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
