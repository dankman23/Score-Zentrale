export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'
import sql from 'mssql'

/**
 * GET /api/jtl/articles/rating
 * 
 * Artikel-Rating basierend auf Marge pro Monat
 * - Nur Basis-Artikel (keine Stücklisten)
 * - Verkäufe über Stücklisten werden anteilig zugerechnet
 * - Verfügbarkeit auf Plattformen als optionaler Faktor
 * 
 * Query:
 * - dateFrom: YYYY-MM-DD
 * - dateTo: YYYY-MM-DD
 * - hersteller: Filter (optional)
 * - warengruppe: Filter (optional)
 * - includeAvailability: true/false (Verfügbarkeits-Faktor)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom') || '2024-01-01'
    const dateTo = searchParams.get('dateTo') || new Date().toISOString().split('T')[0]
    const hersteller = searchParams.get('hersteller') || null
    const warengruppe = searchParams.get('warengruppe') || null
    const includeAvailability = searchParams.get('includeAvailability') === 'true'
    
    console.log('[Article Rating] Fetching pool...')
    const pool = await getMssqlPool()
    console.log('[Article Rating] Pool ready')
    
    const orderTable = 'Verkauf.tAuftrag'
    const orderPosTable = 'Verkauf.tAuftragsposition'
    const articleTable = 'dbo.tArtikel'
    const stuecklisteTable = 'dbo.tStueckliste'
    
    // Berechne Anzahl Tage für Normalisierung
    const daysQuery = `
      SELECT DATEDIFF(day, @dateFrom, @dateTo) + 1 AS days
    `
    const daysResult = await pool.request()
      .input('dateFrom', sql.Date, dateFrom)
      .input('dateTo', sql.Date, dateTo)
      .query(daysQuery)
    
    const totalDays = daysResult.recordset[0].days
    const monthsFactor = totalDays / 30.0 // Für "Marge pro Monat"
    
    // Haupt-Query: Artikel-Rating mit Plattform-Verfügbarkeit
    const query = `
      WITH DirectSales AS (
        -- Direkte Verkäufe (Artikel ohne Stückliste oder direkt verkauft)
        SELECT 
          a.kArtikel,
          a.cArtNr,
          a.cName,
          a.cHersteller,
          SUM(ap.fAnzahl) as DirectMenge,
          SUM((ap.fVKNetto - a.fEKNetto) * ap.fAnzahl) as DirectMarge
        FROM Verkauf.tAuftragsPosition ap
        INNER JOIN Verkauf.tAuftrag au ON ap.kAuftrag = au.kAuftrag
        INNER JOIN dbo.tArtikel a ON ap.kArtikel = a.kArtikel
        WHERE au.dErstellt >= @dateFrom 
          AND au.dErstellt < DATEADD(day, 1, @dateTo)
          AND au.cStatus != 'Storno'
          ${hersteller ? "AND a.cHersteller = @hersteller" : ""}
        GROUP BY a.kArtikel, a.cArtNr, a.cName, a.cHersteller
      ),
      
      StucklisteSales AS (
        -- Verkäufe über Stücklisten (anteilig nach EK)
        SELECT 
          child.kArtikel,
          child.cArtNr,
          child.cName,
          child.cHersteller,
          SUM(
            -- Anteil des Child-Artikels am Gesamt-EK der Stückliste
            (child.fEKNetto * sl.fAnzahl) / NULLIF(parent_ek.total_ek, 0) * 
            -- Marge des Parents
            ((ap.fVKNetto - parent.fEKNetto) * ap.fAnzahl)
          ) as StucklisteMarge,
          SUM(ap.fAnzahl * sl.fAnzahl) as StucklisteMenge
        FROM Verkauf.tAuftragsPosition ap
        INNER JOIN Verkauf.tAuftrag au ON ap.kAuftrag = au.kAuftrag
        INNER JOIN dbo.tArtikel parent ON ap.kArtikel = parent.kArtikel
        INNER JOIN dbo.tStueckliste sl ON parent.kArtikel = sl.kVaterArtikel
        INNER JOIN dbo.tArtikel child ON sl.kArtikel = child.kArtikel
        CROSS APPLY (
          -- Berechne Gesamt-EK der Stückliste
          SELECT SUM(a_child.fEKNetto * sl_inner.fAnzahl) as total_ek
          FROM dbo.tStueckliste sl_inner
          INNER JOIN dbo.tArtikel a_child ON sl_inner.kArtikel = a_child.kArtikel
          WHERE sl_inner.kVaterArtikel = parent.kArtikel
        ) parent_ek
        WHERE au.dErstellt >= @dateFrom 
          AND au.dErstellt < DATEADD(day, 1, @dateTo)
          AND au.cStatus != 'Storno'
          ${hersteller ? "AND child.cHersteller = @hersteller" : ""}
        GROUP BY child.kArtikel, child.cArtNr, child.cName, child.cHersteller
      ),
      
      PlatformCounts AS (
        -- Anzahl Angebote pro Plattform pro Artikel
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
        
        -- Verkaufte Menge
        COALESCE(ds.DirectMenge, 0) + COALESCE(ss.StucklisteMenge, 0) as totalMenge,
        
        -- Gesamt-Marge
        COALESCE(ds.DirectMarge, 0) + COALESCE(ss.StucklisteMarge, 0) as totalMarge,
        
        -- Marge pro Monat
        (COALESCE(ds.DirectMarge, 0) + COALESCE(ss.StucklisteMarge, 0)) / @monthsFactor as margeProMonat,
        
        -- Plattform-Angebote
        MAX(CASE WHEN pc.plattform LIKE '%eBay%' THEN pc.anzahl_angebote ELSE 0 END) as ebay_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%Amazon%' THEN pc.anzahl_angebote ELSE 0 END) as amazon_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%Shop%' OR pc.plattform LIKE '%JTL%' THEN pc.anzahl_angebote ELSE 0 END) as shop_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%Otto%' THEN pc.anzahl_angebote ELSE 0 END) as otto_angebote,
        MAX(CASE WHEN pc.plattform LIKE '%OBI%' THEN pc.anzahl_angebote ELSE 0 END) as obi_angebote,
        
        -- Verfügbarkeits-Score (Anzahl Plattformen mit Angeboten)
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
