export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/top-products
 * 
 * NEUE LOGIK: Stücklisten-Auflösung mit EK-basierter Umsatzaufteilung
 * 
 * Wenn ein Bundle verkauft wird, wird der Umsatz NICHT einfach durch die Anzahl
 * der Artikel geteilt, sondern nach dem EK-Anteil aufgeteilt.
 * 
 * Beispiel:
 * - Bundle verkauft für 100€
 * - Artikel A: 2 Stück x 5€ EK = 10€ EK (20% Anteil)
 * - Artikel B: 1 Stück x 40€ EK = 40€ EK (80% Anteil)
 * - Artikel A bekommt: 100€ * 20% = 20€
 * - Artikel B bekommt: 100€ * 80% = 80€
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10)
    const limit = parseInt(searchParams.get('limit') || '20')
    const hersteller = searchParams.get('hersteller') || null
    const warengruppe = searchParams.get('warengruppe') || null

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
    
    // Hersteller join
    const herstellerTable = 'dbo.tHersteller'
    const hasKHersteller = await hasColumn(pool, articleTable, 'kHersteller')
    const hasTHersteller = hasKHersteller ? await hasColumn(pool, herstellerTable, 'kHersteller') : false
    
    // Warengruppe join
    const warengruppeTable = 'dbo.tWarengruppe'
    const hasKWarengruppe = await hasColumn(pool, articleTable, 'kWarengruppe')
    const hasTWarengruppe = hasKWarengruppe ? await hasColumn(pool, warengruppeTable, 'kWarengruppe') : false
    
    // Build filter conditions
    let herstellerFilter = ''
    let warengruppeFilter = ''
    
    if (hersteller && hasTHersteller) {
      herstellerFilter = 'AND h.cName = @hersteller'
    }
    if (warengruppe && hasTWarengruppe) {
      warengruppeFilter = 'AND wg.cName = @warengruppe'
    }

    /**
     * Die Abfrage mit EK-basierter Umsatzaufteilung:
     * 
     * 1. StuecklistenMitEK: Für jeden Vater-Artikel die Kind-Artikel mit ihrem EK-Wert
     *    und dem Gesamt-EK der Stückliste (für Anteilsberechnung)
     * 
     * 2. AufgeloesteArtikel: 
     *    - Direkte Verkäufe → Umsatz 1:1
     *    - Bundle-Verkäufe → Umsatz * (Kind-EK-Anteil / Gesamt-EK)
     */
    const query = `
      ;WITH VerkaufsPositionen AS (
        -- Alle verkauften Positionen im Zeitraum
        SELECT 
          op.kArtikel AS verkaufter_artikel,
          op.${qtyField} AS menge,
          (op.${netField} * op.${qtyField}) AS umsatz_netto
        FROM ${orderTable} o
        INNER JOIN ${orderPosTable} op ON o.kAuftrag = op.kAuftrag
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
          ${stornoFilter}
          AND ${articleFilter}
          ${orderTypeFilter}
          AND op.kArtikel > 0
      ),
      
      StuecklistenMitEK AS (
        -- Für jeden Vater-Artikel: Kind-Artikel mit EK und Gesamt-EK
        SELECT 
          st.kVaterArtikel,
          st.kArtikel AS kKindArtikel,
          st.fAnzahl AS anzahl_im_set,
          COALESCE(a.fEKNetto, 0) AS ek_netto,
          st.fAnzahl * COALESCE(a.fEKNetto, 0) AS ek_anteil,
          -- Gesamt-EK der Stückliste (Summe aller Kind-EKs)
          SUM(st.fAnzahl * COALESCE(a.fEKNetto, 0)) OVER (PARTITION BY st.kVaterArtikel) AS gesamt_ek
        FROM ${stuecklisteTable} st
        INNER JOIN ${articleTable} a ON st.kArtikel = a.kArtikel
      ),
      
      AufgeloesteArtikel AS (
        -- Fall 1: Artikel hat KEINE Stückliste → direkt verwenden
        SELECT 
          vp.verkaufter_artikel AS echter_artikel,
          vp.menge,
          vp.umsatz_netto
        FROM VerkaufsPositionen vp
        WHERE NOT EXISTS (
          SELECT 1 FROM ${stuecklisteTable} st 
          WHERE st.kVaterArtikel = vp.verkaufter_artikel
        )
        
        UNION ALL
        
        -- Fall 2: Artikel HAT Stückliste → Kind-Artikel mit EK-anteiligem Umsatz
        SELECT 
          sek.kKindArtikel AS echter_artikel,
          vp.menge * sek.anzahl_im_set AS menge,
          -- Umsatz anteilig nach EK: (EK-Anteil / Gesamt-EK) * Umsatz
          CASE 
            WHEN sek.gesamt_ek > 0 THEN vp.umsatz_netto * (sek.ek_anteil / sek.gesamt_ek)
            ELSE vp.umsatz_netto / COUNT(*) OVER (PARTITION BY vp.verkaufter_artikel)  -- Fallback: gleichmäßig
          END AS umsatz_netto
        FROM VerkaufsPositionen vp
        INNER JOIN StuecklistenMitEK sek ON sek.kVaterArtikel = vp.verkaufter_artikel
      )
      
      -- Finale Aggregation nach echtem Artikel (nur nach Artikelnummer!)
      SELECT TOP ${limit}
        a.cArtNr AS sku,
        MAX(COALESCE(ab.cName, a.cArtNr)) AS name,
        ${hasTHersteller ? 'MAX(h.cName)' : 'NULL'} AS hersteller,
        SUM(aa.menge) AS quantity,
        SUM(aa.umsatz_netto) AS revenue
      FROM AufgeloesteArtikel aa
      INNER JOIN ${articleTable} a ON aa.echter_artikel = a.kArtikel
      LEFT JOIN dbo.tArtikelBeschreibung ab ON ab.kArtikel = a.kArtikel AND ab.kSprache = 1
      ${hasTHersteller ? `LEFT JOIN ${herstellerTable} h ON a.kHersteller = h.kHersteller` : ''}
      ${hasTWarengruppe ? `LEFT JOIN ${warengruppeTable} wg ON a.kWarengruppe = wg.kWarengruppe` : ''}
      WHERE 1=1
        ${herstellerFilter}
        ${warengruppeFilter}
      GROUP BY a.cArtNr
      ORDER BY SUM(aa.umsatz_netto) DESC
    `

    console.log('[Top-Products] Query with EK-based revenue allocation')

    const requestObj = pool.request()
      .input('from', sql.Date, from)
      .input('to', sql.Date, to)
    
    if (hersteller) {
      requestObj.input('hersteller', sql.NVarChar, hersteller)
    }
    if (warengruppe) {
      requestObj.input('warengruppe', sql.NVarChar, warengruppe)
    }
    
    const result = await requestObj.query(query)

    const rows = (result.recordset || []).map(r => ({
      sku: r.sku || 'N/A',
      name: r.name || 'Unbekannt',
      hersteller: r.hersteller || '-',
      quantity: parseFloat(r.quantity || 0).toFixed(2),
      revenue: parseFloat(r.revenue || 0).toFixed(2)
    }))

    return NextResponse.json({ 
      ok: true, 
      period: { from, to }, 
      rows,
      info: 'Umsätze auf Stücklisten-Artikel nach EK-Anteil aufgelöst'
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/top-products] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
