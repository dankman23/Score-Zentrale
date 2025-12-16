export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import sql from 'mssql'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom') || '2024-01-01'
    const dateTo = searchParams.get('dateTo') || new Date().toISOString().split('T')[0]
    const includeAvailability = searchParams.get('includeAvailability') === 'true'
    
    const pool = await getMssqlPool()
    
    // Berechne Monate
    const daysResult = await pool.request()
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .query(`SELECT DATEDIFF(day, @dateFrom, @dateTo) + 1 AS days`)
    
    const totalDays = daysResult.recordset[0].days
    const monthsFactor = totalDays / 30.0
    
    const query = `
      WITH VerkaufsPositionen AS (
        -- Alle verkauften Positionen im Zeitraum
        SELECT 
          op.kArtikel AS verkaufter_artikel,
          op.fAnzahl AS menge,
          (op.fVKNetto * op.fAnzahl) AS umsatz_netto,
          op.fVKNetto AS vk_netto
        FROM Verkauf.tAuftrag o
        INNER JOIN Verkauf.tAuftragPosition op ON o.kAuftrag = op.kAuftrag
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @dateFrom AND @dateTo
          AND (o.nStorno IS NULL OR o.nStorno = 0)
          AND o.nType = 1
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
          SUM(st.fAnzahl * COALESCE(a.fEKNetto, 0)) OVER (PARTITION BY st.kVaterArtikel) AS gesamt_ek
        FROM dbo.tStueckliste st
        INNER JOIN dbo.tArtikel a ON st.kArtikel = a.kArtikel
      ),
      
      AufgeloesteArtikel AS (
        -- Fall 1: Artikel hat KEINE Stückliste → direkt verwenden
        SELECT 
          vp.verkaufter_artikel AS echter_artikel,
          vp.menge,
          vp.umsatz_netto,
          vp.vk_netto
        FROM VerkaufsPositionen vp
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.tStueckliste st 
          WHERE st.kVaterArtikel = vp.verkaufter_artikel
        )
        
        UNION ALL
        
        -- Fall 2: Artikel HAT Stückliste → Kind-Artikel mit EK-anteiligem Umsatz
        SELECT 
          sek.kKindArtikel AS echter_artikel,
          vp.menge * sek.anzahl_im_set AS menge,
          CASE 
            WHEN sek.gesamt_ek > 0 THEN vp.umsatz_netto * (sek.ek_anteil / sek.gesamt_ek)
            ELSE vp.umsatz_netto / COUNT(*) OVER (PARTITION BY vp.verkaufter_artikel)
          END AS umsatz_netto,
          vp.vk_netto AS vk_netto
        FROM VerkaufsPositionen vp
        INNER JOIN StuecklistenMitEK sek ON sek.kVaterArtikel = vp.verkaufter_artikel
      ),
      
      PlatformCounts AS (
        SELECT 
          kArtikel,
          '' as plattform,
          0 as anzahl_angebote
        FROM DirectSales
        WHERE 1 = 0
      )
      
      ArtikelAggregation AS (
        -- Finale Aggregation nach echtem Artikel
        SELECT 
          a.kArtikel,
          a.cArtNr,
          MAX(COALESCE(ab.cName, a.cArtNr)) AS cName,
          MAX(COALESCE(h.cName, '')) AS Hersteller,
          MAX(COALESCE(wg.cName, '')) AS Warengruppe,
          SUM(aa.menge) AS totalMenge,
          SUM(aa.umsatz_netto) AS totalUmsatz,
          SUM((aa.vk_netto - a.fEKNetto) * aa.menge) AS totalMarge
        FROM AufgeloesteArtikel aa
        INNER JOIN dbo.tArtikel a ON aa.echter_artikel = a.kArtikel
        LEFT JOIN dbo.tArtikelBeschreibung ab ON ab.kArtikel = a.kArtikel AND ab.kSprache = 1
        LEFT JOIN dbo.tHersteller h ON a.kHersteller = h.kHersteller
        LEFT JOIN dbo.tWarengruppe wg ON a.kWarengruppe = wg.kWarengruppe
        GROUP BY a.kArtikel, a.cArtNr
      )
      
      SELECT 
        kArtikel,
        cArtNr,
        cName,
        Hersteller,
        Warengruppe,
        totalMenge,
        totalUmsatz,
        totalMarge,
        totalMarge / @monthsFactor as margeProMonat,
        0 as ebay_angebote,
        0 as amazon_angebote,
        0 as shop_angebote,
        0 as otto_angebote,
        0 as obi_angebote,
        0 as anzahlPlattformen
        
      FROM ArtikelAggregation
      WHERE totalMarge > 0
      ORDER BY margeProMonat DESC
    `
    
    const result = await pool.request()
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .input('monthsFactor', sql.Float, monthsFactor)
      .query(query)
    
    const articles = result.recordset.map((row: any) => {
      const baseScore = row.margeProMonat || 0
      const availabilityFactor = includeAvailability 
        ? (row.anzahlPlattformen || 1)
        : 1
      
      return {
        kArtikel: row.kArtikel,
        cArtNr: row.cArtNr,
        cName: row.cName,
        cHersteller: row.Hersteller || '',
        cWarengruppe: row.Warengruppe || '',
        totalMenge: Math.round(row.totalMenge || 0),
        totalUmsatz: parseFloat((row.totalUmsatz || 0).toFixed(2)),
        totalMarge: parseFloat((row.totalMarge || 0).toFixed(2)),
        margeProMonat: parseFloat(baseScore.toFixed(2)),
        ratingScore: parseFloat((baseScore * availabilityFactor).toFixed(2)),
        plattformen: {
          ebay: row.ebay_angebote || 0,
          amazon: row.amazon_angebote || 0,
          shop: row.shop_angebote || 0,
          otto: row.otto_angebote || 0,
          obi: row.obi_angebote || 0
        },
        anzahlPlattformen: row.anzahlPlattformen || 0
      }
    })
    
    return NextResponse.json({
      ok: true,
      articles,
      dateFrom,
      dateTo,
      totalDays,
      includeAvailability
    })
    
  } catch (error: any) {
    console.error('[Article Rating] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
