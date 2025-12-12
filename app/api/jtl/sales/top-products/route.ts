export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import { hasColumn, pickFirstExisting } from '@/lib/sql/utils'
import sql from 'mssql'

/**
 * GET /api/jtl/sales/top-products
 * 
 * NEUE LOGIK: Stücklisten-Auflösung
 * 
 * Wenn ein verkaufter Artikel (Auktion) eine Stückliste hat, wird der Umsatz
 * auf die eigentlichen Artikel (Kind-Artikel) anteilig aufgeteilt.
 * 
 * Beispiel:
 * - Bundle "5x Schleifscheiben Set" verkauft für 100€
 * - Stückliste enthält 3 verschiedene Artikel
 * - Jeder Artikel bekommt 100€ / 3 = 33,33€ zugerechnet
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

    // Filter: Only count "Aufträge" (AU...), not "Angebote" (AN...)
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
     * Die Abfrage funktioniert so:
     * 
     * 1. VerkaufsPositionen (CTE): Alle verkauften Positionen im Zeitraum
     * 
     * 2. StuecklistenInfo (CTE): Für jeden Vater-Artikel die Anzahl der Kind-Artikel
     *    (um den Umsatz anteilig aufzuteilen)
     * 
     * 3. AufgeloesteArtikel (CTE): 
     *    - Wenn Artikel KEINE Stückliste hat → direkt verwenden
     *    - Wenn Artikel Stückliste hat → Kind-Artikel mit anteiligem Umsatz
     * 
     * 4. Finale Aggregation nach echtem Artikel (kArtikel)
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
      
      StuecklistenInfo AS (
        -- Anzahl der Kind-Artikel pro Vater-Artikel (für anteilige Aufteilung)
        SELECT 
          kVaterArtikel,
          COUNT(DISTINCT kArtikel) AS anzahl_kind_artikel
        FROM ${stuecklisteTable}
        GROUP BY kVaterArtikel
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
        
        -- Fall 2: Artikel HAT Stückliste → Kind-Artikel mit anteiligem Umsatz
        SELECT 
          st.kArtikel AS echter_artikel,
          vp.menge * st.fAnzahl AS menge,  -- Menge * Anzahl pro Stückliste
          vp.umsatz_netto / si.anzahl_kind_artikel AS umsatz_netto  -- Umsatz anteilig
        FROM VerkaufsPositionen vp
        INNER JOIN ${stuecklisteTable} st ON st.kVaterArtikel = vp.verkaufter_artikel
        INNER JOIN StuecklistenInfo si ON si.kVaterArtikel = vp.verkaufter_artikel
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

    console.log('[Top-Products] Query with Stücklisten-Auflösung')

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
      info: 'Umsätze auf Stücklisten-Artikel aufgelöst (anteilig bei mehreren Kind-Artikeln)'
    })
  } catch (error: any) {
    console.error('[/api/jtl/sales/top-products] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
