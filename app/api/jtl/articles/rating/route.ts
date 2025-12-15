export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import sql from 'mssql'

/**
 * GET /api/jtl/articles/rating
 * 
 * Artikel-Rating basierend auf Marge pro Monat
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom') || '2024-01-01'
    const dateTo = searchParams.get('dateTo') || new Date().toISOString().split('T')[0]
    const hersteller = searchParams.get('hersteller') || null
    const includeAvailability = searchParams.get('includeAvailability') === 'true'
    
    const pool = await getMssqlPool()
    
    // Berechne Monate
    const daysResult = await pool.request()
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .query(`SELECT DATEDIFF(day, @dateFrom, @dateTo) + 1 AS days`)
    
    const totalDays = daysResult.recordset[0].days
    const monthsFactor = totalDays / 30.0
    
    // Hauptquery
    const query = `
      WITH DirectSales AS (
        SELECT 
          a.kArtikel,
          a.cArtNr,
          a.cName,
          '' as Hersteller,
          SUM(ap.fAnzahl) as DirectMenge,
          SUM((ap.fVKNetto - a.fEKNetto) * ap.fAnzahl) as DirectMarge
        FROM Verkauf.tAuftragPosition ap
        INNER JOIN Verkauf.tAuftrag au ON ap.kAuftrag = au.kAuftrag
        INNER JOIN dbo.tArtikel a ON ap.kArtikel = a.kArtikel
        WHERE CAST(au.dErstellt AS DATE) BETWEEN @dateFrom AND @dateTo
          AND au.cStatus != 'Storno'
        GROUP BY a.kArtikel, a.cArtNr, a.cName
      ),
      
      StucklisteSales AS (
        SELECT 
          child.kArtikel,
          child.cArtNr,
          child.cName,
          child.cHersteller,
          SUM(
            (child.fEKNetto * sl.fAnzahl) / NULLIF(parent_ek.total_ek, 0) * 
            ((ap.fVKNetto - parent.fEKNetto) * ap.fAnzahl)
          ) as StucklisteMarge,
          SUM(ap.fAnzahl * sl.fAnzahl) as StucklisteMenge
        FROM Verkauf.tAuftragPosition ap
        INNER JOIN Verkauf.tAuftrag au ON ap.kAuftrag = au.kAuftrag
        INNER JOIN dbo.tArtikel parent ON ap.kArtikel = parent.kArtikel
        INNER JOIN dbo.tStueckliste sl ON parent.kArtikel = sl.kVaterArtikel
        INNER JOIN dbo.tArtikel child ON sl.kArtikel = child.kArtikel
        CROSS APPLY (
          SELECT SUM(a_child.fEKNetto * sl_inner.fAnzahl) as total_ek
          FROM dbo.tStueckliste sl_inner
          INNER JOIN dbo.tArtikel a_child ON sl_inner.kArtikel = a_child.kArtikel
          WHERE sl_inner.kVaterArtikel = parent.kArtikel
        ) parent_ek
        WHERE CAST(au.dErstellt AS DATE) BETWEEN @dateFrom AND @dateTo
          AND au.cStatus != 'Storno'
          ${hersteller ? "AND child.cHersteller = @hersteller" : ""}
        GROUP BY child.kArtikel, child.cArtNr, child.cName, child.cHersteller
      ),
      
      PlatformCounts AS (
        SELECT 
          ao.kArtikel,
          p.cName as plattform,
          COUNT(DISTINCT ao.kArtikelOnlineshop) as anzahl_angebote
        FROM dbo.tArtikelOnlineshop ao
        INNER JOIN dbo.tPlattform p ON ao.kPlattform = p.kPlattform
        WHERE ao.nAktiv = 1
        GROUP BY ao.kArtikel, p.cName
      )
      
      SELECT 
        COALESCE(ds.kArtikel, ss.kArtikel) as kArtikel,
        COALESCE(ds.cArtNr, ss.cArtNr) as cArtNr,
        COALESCE(ds.cName, ss.cName) as cName,
        COALESCE(ds.cHersteller, ss.cHersteller) as cHersteller,
        COALESCE(ds.DirectMenge, 0) + COALESCE(ss.StucklisteMenge, 0) as totalMenge,
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
        COALESCE(ds.cHersteller, ss.cHersteller),
        ds.DirectMenge,
        ds.DirectMarge,
        ss.StucklisteMenge,
        ss.StucklisteMarge
      HAVING (COALESCE(ds.DirectMarge, 0) + COALESCE(ss.StucklisteMarge, 0)) > 0
      ORDER BY margeProMonat DESC
    `
    
    const result = await pool.request()
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .input('monthsFactor', sql.Float, monthsFactor)
      .input('hersteller', sql.NVarChar, hersteller)
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
        cHersteller: row.cHersteller,
        totalMenge: Math.round(row.totalMenge || 0),
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
