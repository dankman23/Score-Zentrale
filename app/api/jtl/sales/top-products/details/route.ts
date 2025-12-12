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

    const hasNStorno = await hasColumn(pool, orderTable, 'nStorno')
    const stornoFilter = hasNStorno ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' : ''

    const hasNPosTyp = await hasColumn(pool, orderPosTable, 'nPosTyp')
    const articleFilter = hasNPosTyp ? '(op.nPosTyp = 1 OR op.nPosTyp = 3)' : '1=1'

    const qtyField = await pickFirstExisting(pool, orderPosTable, ['fAnzahl', 'nAnzahl', 'fMenge']) || 'fAnzahl'
    const netField = await pickFirstExisting(pool, orderPosTable, ['fVKNetto', 'fPreis']) || 'fVKNetto'

    const hasCauftragsNr = await hasColumn(pool, orderTable, 'cAuftragsNr')
    const orderTypeFilter = hasCauftragsNr ? `AND o.cAuftragsNr LIKE 'AU%'` : ''

    // Finde zuerst den kArtikel für die ArtikelNr
    const artikelResult = await pool.request()
      .input('artikelNr', sql.NVarChar, artikelNr)
      .query(`SELECT kArtikel FROM ${articleTable} WHERE cArtNr = @artikelNr`)
    
    if (!artikelResult.recordset || artikelResult.recordset.length === 0) {
      return NextResponse.json({ ok: true, details: [], summe: { menge: 0, umsatz: 0 } })
    }
    
    const kArtikel = artikelResult.recordset[0].kArtikel

    /**
     * Abfrage: Finde alle Verkäufe die zu diesem Artikel beitragen
     * 
     * 1. Direktverkäufe: Artikel wurde direkt verkauft (nicht als Teil eines Bundles)
     * 2. Bundle-Verkäufe: Artikel ist Teil einer Stückliste die verkauft wurde
     */
    const query = `
      ;WITH StuecklistenInfo AS (
        -- Anzahl der Kind-Artikel pro Vater-Artikel (für anteilige Aufteilung)
        SELECT 
          kVaterArtikel,
          COUNT(DISTINCT kArtikel) AS anzahl_kind_artikel
        FROM ${stuecklisteTable}
        GROUP BY kVaterArtikel
      )
      
      -- Fall 1: Direktverkäufe
      SELECT 
        'Direkt' AS typ,
        o.cAuftragsNr AS auftrag,
        CAST(o.dErstellt AS DATE) AS datum,
        a_verkauft.cArtNr AS verkauft_als,
        COALESCE(ab_verkauft.cName, a_verkauft.cArtNr) AS verkauft_name,
        op.${qtyField} AS menge,
        (op.${netField} * op.${qtyField}) AS umsatz,
        1 AS anzahl_artikel_im_bundle
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      INNER JOIN ${articleTable} a_verkauft ON op.kArtikel = a_verkauft.kArtikel
      LEFT JOIN dbo.tArtikelBeschreibung ab_verkauft ON ab_verkauft.kArtikel = a_verkauft.kArtikel AND ab_verkauft.kSprache = 1
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
      
      -- Fall 2: Als Teil eines Bundles verkauft
      SELECT 
        'Bundle' AS typ,
        o.cAuftragsNr AS auftrag,
        CAST(o.dErstellt AS DATE) AS datum,
        a_vater.cArtNr AS verkauft_als,
        COALESCE(ab_vater.cName, a_vater.cArtNr) AS verkauft_name,
        op.${qtyField} * st.fAnzahl AS menge,
        (op.${netField} * op.${qtyField}) / si.anzahl_kind_artikel AS umsatz,
        si.anzahl_kind_artikel
      FROM ${orderTable} o
      INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
      INNER JOIN ${stuecklisteTable} st ON st.kVaterArtikel = op.kArtikel
      INNER JOIN StuecklistenInfo si ON si.kVaterArtikel = op.kArtikel
      INNER JOIN ${articleTable} a_kind ON st.kArtikel = a_kind.kArtikel
      INNER JOIN ${articleTable} a_vater ON op.kArtikel = a_vater.kArtikel
      LEFT JOIN dbo.tArtikelBeschreibung ab_vater ON ab_vater.kArtikel = a_vater.kArtikel AND ab_vater.kSprache = 1
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
      verkauftAls: r.verkauft_als,
      verkauftName: r.verkauft_name,
      menge: parseFloat(r.menge || 0),
      umsatz: parseFloat(r.umsatz || 0),
      anzahlImBundle: r.anzahl_artikel_im_bundle
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
