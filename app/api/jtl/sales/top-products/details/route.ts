export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/top-products/details
 * 
 * Liefert die Summanden (einzelne Verkäufe) für einen bestimmten Artikel.
 * Zeigt welche Auktionen/Bundles zu dem Umsatz beigetragen haben.
 * 
 * NEU: 
 * - Plattform (Amazon, eBay, etc.) wird angezeigt
 * - Bei Stücklisten wird der Umsatz nach EK-Anteil aufgeteilt
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const artikelNr = searchParams.get('artikelNr')
    
    if (!artikelNr) {
      return NextResponse.json({ ok: false, error: 'artikelNr parameter required' }, { status: 400 })
    }

    const pool = await getMssqlPool()
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragPosition'
    const articleTable = 'dbo.tArtikel'
    const stuecklisteTable = 'dbo.tStueckliste'
    const plattformTable = 'dbo.tPlattform'

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? '(op.nPosTyp = 1 OR op.nPosTyp = 3)' : '1=1'

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''
    
    // Check for platform
    const hasKPlattform = await hasColumn(pool, orderTable, 'kPlattform')

    // Finde zuerst den kArtikel für die ArtikelNr
    const artikelResult = await pool.request()
      .input('artikelNr', sql.NVarChar, artikelNr)
      .query(`SELECT kArtikel FROM ${articleTable} WHERE cArtNr = @artikelNr`)
    
    if (!artikelResult.recordset || artikelResult.recordset.length === 0) {
      return NextResponse.json({ ok: true, details: [], summe: { menge: 0, umsatz: 0 } })
    }
    
    const kArtikel = artikelResult.recordset[0].kArtikel

    /**
     * Abfrage mit EK-basierter Umsatzaufteilung und Plattform
     */
    const query = `
      ;WITH StuecklistenMitEK AS (
        -- Für jeden Vater-Artikel: Kind-Artikel mit EK und Gesamt-EK
        SELECT 
          st.kVaterArtikel,
          st.kArtikel AS kKindArtikel,
          st.fAnzahl AS anzahl_im_set,
          COALESCE(a.fEKNetto, 0) AS ek_netto,
          st.fAnzahl * COALESCE(a.fEKNetto, 0) AS ek_anteil,
          SUM(st.fAnzahl * COALESCE(a.fEKNetto, 0)) OVER (PARTITION BY st.kVaterArtikel) AS gesamt_ek,
          COUNT(*) OVER (PARTITION BY st.kVaterArtikel) AS anzahl_kind_artikel
        FROM ${stuecklisteTable} st
        INNER JOIN ${articleTable} a ON st.kArtikel = a.kArtikel
      )
      
      -- Fall 1: Direktverkäufe
      SELECT 
        'Direkt' AS typ,
        o.cAuftragsNr AS auftrag,
        CAST(o.dErstellt AS DATE) AS datum,
        ${hasKPlattform ? 'COALESCE(p.cName, \'Unbekannt\')' : '\'Unbekannt\''} AS plattform,
        a_verkauft.cArtNr AS verkauft_als,
        COALESCE(ab_verkauft.cName, a_verkauft.cArtNr) AS verkauft_name,
        op.${qtyField} AS menge,
        (op.${netField} * op.${qtyField}) AS umsatz,
        1 AS anzahl_artikel_im_bundle,
        NULL AS ek_anteil_prozent
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      INNER JOIN ${articleTable} a_verkauft ON op.kArtikel = a_verkauft.kArtikel
      LEFT JOIN dbo.tArtikelBeschreibung ab_verkauft ON ab_verkauft.kArtikel = a_verkauft.kArtikel AND ab_verkauft.kSprache = 1
      ${hasKPlattform ? `LEFT JOIN ${plattformTable} p ON o.kPlattform = p.nPlattform` : ''}
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND ${articleFilter}
        ${orderTypeFilter}
        AND a_verkauft.cArtNr = @artikelNr
        -- Nur wenn KEIN Vater-Artikel (keine Stückliste)
        AND NOT EXISTS (
          SELECT 1 FROM ${stuecklisteTable} st WHERE st.kVaterArtikel = op.kArtikel
        )
      
      UNION ALL
      
      -- Fall 2: Als Teil eines Bundles verkauft (mit EK-Anteil)
      SELECT 
        'Bundle' AS typ,
        o.cAuftragsNr AS auftrag,
        CAST(o.dErstellt AS DATE) AS datum,
        ${hasKPlattform ? 'COALESCE(p.cName, \'Unbekannt\')' : '\'Unbekannt\''} AS plattform,
        a_vater.cArtNr AS verkauft_als,
        COALESCE(ab_vater.cName, a_vater.cArtNr) AS verkauft_name,
        op.${qtyField} * sek.anzahl_im_set AS menge,
        -- Umsatz nach EK-Anteil
        CASE 
          WHEN sek.gesamt_ek > 0 THEN (op.${netField} * op.${qtyField}) * (sek.ek_anteil / sek.gesamt_ek)
          ELSE (op.${netField} * op.${qtyField}) / sek.anzahl_kind_artikel
        END AS umsatz,
        sek.anzahl_kind_artikel,
        -- EK-Anteil in Prozent anzeigen
        CASE 
          WHEN sek.gesamt_ek > 0 THEN ROUND((sek.ek_anteil / sek.gesamt_ek) * 100, 1)
          ELSE ROUND(100.0 / sek.anzahl_kind_artikel, 1)
        END AS ek_anteil_prozent
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      INNER JOIN StuecklistenMitEK sek ON sek.kVaterArtikel = op.kArtikel
      INNER JOIN ${articleTable} a_kind ON sek.kKindArtikel = a_kind.kArtikel
      INNER JOIN ${articleTable} a_vater ON op.kArtikel = a_vater.kArtikel
      LEFT JOIN dbo.tArtikelBeschreibung ab_vater ON ab_vater.kArtikel = a_vater.kArtikel AND ab_vater.kSprache = 1
      ${hasKPlattform ? `LEFT JOIN ${plattformTable} p ON o.kPlattform = p.nPlattform` : ''}
      WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
        ${stornoFilter}
        AND ${articleFilter}
        ${orderTypeFilter}
        AND a_kind.cArtNr = @artikelNr
      
      ORDER BY datum DESC, auftrag
    `

    const result = await pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
      .input('artikelNr', sql.NVarChar, artikelNr)
      .query(query)

    const details = (result.recordset || []).map(r => ({
      typ: r.typ,
      auftrag: r.auftrag,
      datum: r.datum,
      plattform: r.plattform,
      verkauftAls: r.verkauft_als,
      verkauftName: r.verkauft_name,
      menge: parseFloat(r.menge || 0),
      umsatz: parseFloat(r.umsatz || 0),
      anzahlImBundle: r.anzahl_artikel_im_bundle,
      ekAnteilProzent: r.ek_anteil_prozent ? parseFloat(r.ek_anteil_prozent) : null
    }))

    // Summe berechnen
    const summe = details.reduce((acc, d) => ({
      menge: acc.menge + d.menge,
      umsatz: acc.umsatz + d.umsatz
    }), { menge: 0, umsatz: 0 })

    return NextResponse.json({ 
      ok: true, 
      artikelNr,
      details,
      summe: {
        menge: summe.menge.toFixed(2),
        umsatz: summe.umsatz.toFixed(2)
      }
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/top-products/details] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
