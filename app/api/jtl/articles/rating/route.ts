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
      WITH DirectSales AS (
        SELECT 
          a.kArtikel,
          a.cArtNr,
          ab.cName,
          COALESCE(h.cName, '') as Hersteller,
          COALESCE(wg.cName, '') as Warengruppe,
          SUM(op.fAnzahl) as DirectMenge,
          SUM(op.fVKNetto * op.fAnzahl) as DirectUmsatz,
          SUM((op.fVKNetto - a.fEKNetto) * op.fAnzahl) as DirectMarge
        FROM Verkauf.tAuftragPosition op
        INNER JOIN Verkauf.tAuftrag o ON op.kAuftrag = o.kAuftrag
        INNER JOIN dbo.tArtikel a ON op.kArtikel = a.kArtikel
        LEFT JOIN dbo.tArtikelBeschreibung ab ON ab.kArtikel = a.kArtikel AND ab.kSprache = 1
        LEFT JOIN dbo.tHersteller h ON a.kHersteller = h.kHersteller
        LEFT JOIN dbo.tWarengruppe wg ON a.kWarengruppe = wg.kWarengruppe
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @dateFrom AND @dateTo
          AND (o.nStorno IS NULL OR o.nStorno = 0)
          AND o.nType = 1
        GROUP BY a.kArtikel, a.cArtNr, ab.cName, h.cName, wg.cName, ab.kArtikelBeschreibung
      ),
      
      StucklisteSales AS (
        SELECT 
          child.kArtikel,
          child.cArtNr,
          child_desc.cName,
          COALESCE(child_h.cName, '') as Hersteller,
          COALESCE(child_wg.cName, '') as Warengruppe,
          SUM(
            (child.fEKNetto * sl.fAnzahl) / NULLIF(parent_ek.total_ek, 0) * 
            (op.fVKNetto * op.fAnzahl)
          ) as StucklisteUmsatz,
          SUM(
            (child.fEKNetto * sl.fAnzahl) / NULLIF(parent_ek.total_ek, 0) * 
            ((op.fVKNetto - parent.fEKNetto) * op.fAnzahl)
          ) as StucklisteMarge,
          SUM(op.fAnzahl * sl.fAnzahl) as StucklisteMenge
        FROM Verkauf.tAuftragPosition op
        INNER JOIN Verkauf.tAuftrag o ON op.kAuftrag = o.kAuftrag
        INNER JOIN dbo.tArtikel parent ON op.kArtikel = parent.kArtikel
        INNER JOIN dbo.tStueckliste sl ON parent.kArtikel = sl.kVaterArtikel
        INNER JOIN dbo.tArtikel child ON sl.kArtikel = child.kArtikel
        LEFT JOIN dbo.tArtikelBeschreibung child_desc ON child_desc.kArtikel = child.kArtikel AND child_desc.kSprache = 1
        LEFT JOIN dbo.tHersteller child_h ON child.kHersteller = child_h.kHersteller
        LEFT JOIN dbo.tWarengruppe child_wg ON child.kWarengruppe = child_wg.kWarengruppe
        CROSS APPLY (
          SELECT SUM(a_child.fEKNetto * sl_inner.fAnzahl) as total_ek
          FROM dbo.tStueckliste sl_inner
          INNER JOIN dbo.tArtikel a_child ON sl_inner.kArtikel = a_child.kArtikel
          WHERE sl_inner.kVaterArtikel = parent.kArtikel
        ) parent_ek
        WHERE CAST(o.dErstellt AS DATE) BETWEEN @dateFrom AND @dateTo
          AND (o.nStorno IS NULL OR o.nStorno = 0)
          AND o.nType = 1
        GROUP BY child.kArtikel, child.cArtNr, child_desc.cName, child_h.cName, child_wg.cName
      ),
      
      PlatformCounts AS (
        SELECT 
          kArtikel,
          '' as plattform,
          0 as anzahl_angebote
        FROM DirectSales
        WHERE 1 = 0
      )
      
      SELECT 
        COALESCE(ds.kArtikel, ss.kArtikel) as kArtikel,
        COALESCE(ds.cArtNr, ss.cArtNr) as cArtNr,
        COALESCE(ds.cName, ss.cName) as cName,
        COALESCE(ds.Hersteller, ss.Hersteller) as Hersteller,
        COALESCE(ds.Warengruppe, ss.Warengruppe) as Warengruppe,
        COALESCE(ds.DirectMenge, 0) + COALESCE(ss.StucklisteMenge, 0) as totalMenge,
        COALESCE(ds.DirectUmsatz, 0) + COALESCE(ss.StucklisteUmsatz, 0) as totalUmsatz,
        COALESCE(ds.DirectMarge, 0) + COALESCE(ss.StucklisteMarge, 0) as totalMarge,
        (COALESCE(ds.DirectMarge, 0) + COALESCE(ss.StucklisteMarge, 0)) / @monthsFactor as margeProMonat,
        MAX(CASE WHEN pc.plattform LIKE '%eBay%' THEN pc.anzahl_angebote ELSE 0 END) as ebay_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%Amazon%' THEN pc.anzahl_angebote ELSE 0 END) as amazon_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%Shop%' OR pc.plattform LIKE '%JTL%' THEN pc.anzahl_angebote ELSE 0 END) as shop_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%Otto%' THEN pc.anzahl_angebote ELSE 0 END) as otto_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%OBI%' THEN pc.anzahl_angebote ELSE 0 END) as obi_angebote,
        (
          CASE WHEN MAX(CASE WHEN pc.plattform LIKE '%eBay%' THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END +
          CASE WHEN MAX(CASE WHEN pc.plattform LIKE '%Amazon%' THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END +
          CASE WHEN MAX(CASE WHEN pc.plattform LIKE '%Shop%' OR pc.plattform LIKE '%JTL%' THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END +
          CASE WHEN MAX(CASE WHEN pc.plattform LIKE '%Otto%' THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END +
          CASE WHEN MAX(CASE WHEN pc.plattform LIKE '%OBI%' THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END
        ) as anzahlPlattformen
        
      FROM DirectSales ds
      FULL OUTER JOIN StucklisteSales ss ON ds.kArtikel = ss.kArtikel
      LEFT JOIN PlatformCounts pc ON COALESCE(ds.kArtikel, ss.kArtikel) = pc.kArtikel
      GROUP BY 
        COALESCE(ds.kArtikel, ss.kArtikel),
        COALESCE(ds.cArtNr, ss.cArtNr),
        COALESCE(ds.cName, ss.cName),
        COALESCE(ds.Hersteller, ss.Hersteller),
        COALESCE(ds.Warengruppe, ss.Warengruppe),
        ds.DirectMenge,
        ds.DirectUmsatz,
        ds.DirectMarge,
        ss.StucklisteMenge,
        ss.StucklisteUmsatz,
        ss.StucklisteMarge
      HAVING (COALESCE(ds.DirectMarge, 0) + COALESCE(ss.StucklisteMarge, 0)) > 0
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
