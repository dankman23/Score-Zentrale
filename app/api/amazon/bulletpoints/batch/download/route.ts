export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

/**
 * GET /api/amazon/bulletpoints/batch/download
 * CSV-Download aller generierten Bulletpoints
 * 
 * Query: ?kArtikel=123,456,789 (optional - sonst alle)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const kArtikelParam = searchParams.get('kArtikel')
    const herstellerParam = searchParams.get('hersteller')
    const warengruppeParam = searchParams.get('warengruppe')
    const searchParam = searchParams.get('search')
    const abpParam = searchParams.get('abp')
    
    const db = await getDb()
    const bulletpointsCollection = db.collection('amazon_bulletpoints_generated')
    const articlesCollection = db.collection('articles')
    
    // Filter: Spezifische Artikel ODER Filter-basierte Suche
    let kArtikelIds: number[] = []
    
    if (kArtikelParam) {
      // Direkte Artikel-IDs
      kArtikelIds = kArtikelParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    } else if (herstellerParam || warengruppeParam || searchParam || abpParam) {
      // Filter-basierte Suche in articles
      const articleQuery: any = {}
      
      if (herstellerParam) {
        articleQuery.cHerstellerName = herstellerParam
      }
      
      if (warengruppeParam) {
        articleQuery.cWarengruppenName = warengruppeParam
      }
      
      if (searchParam) {
        articleQuery.$or = [
          { cArtNr: { $regex: searchParam, $options: 'i' } },
          { cName: { $regex: searchParam, $options: 'i' } },
          { cBarcode: { $regex: searchParam, $options: 'i' } },
          { cHerstellerName: { $regex: searchParam, $options: 'i' } }
        ]
      }
      
      console.log(`[Batch Download] Filter-Query:`, articleQuery)
      
      // Hole Artikel-IDs
      const articles = await articlesCollection
        .find(articleQuery)
        .project({ kArtikel: 1 })
        .toArray()
      
      kArtikelIds = articles.map(a => a.kArtikel)
      
      console.log(`[Batch Download] ${kArtikelIds.length} Artikel gefunden mit Filter`)
    }
    
    // Query für Bulletpoints
    const query: any = {}
    
    if (kArtikelIds.length > 0) {
      query.kArtikel = { $in: kArtikelIds }
    }
    
    // ABP-Filter (mit/ohne Bulletpoints)
    if (abpParam === 'mit') {
      query.bullets = { $exists: true, $ne: null, $ne: [] }
    } else if (abpParam === 'ohne') {
      query.$or = [
        { bullets: { $exists: false } },
        { bullets: null },
        { bullets: [] }
      ]
    }
    
    console.log(`[Batch Download] Bulletpoints-Query:`, query)
    
    const bulletpoints = await bulletpointsCollection
      .find(query)
      .sort({ generatedAt: -1 })
      .toArray()
    
    if (bulletpoints.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Keine generierten Bulletpoints gefunden'
      }, { status: 404 })
    }
    
    console.log(`[Batch Download] Generiere CSV für ${bulletpoints.length} Artikel`)
    
    // CSV Header
    const header = 'kArtikel;cArtNr;cName;Bulletpoint 1;Bulletpoint 2;Bulletpoint 3;Bulletpoint 4;Bulletpoint 5;Generiert am\n'
    
    // CSV Zeilen
    const rows = bulletpoints.map(bp => {
      const bullets = bp.bullets || []
      
      // Fülle mit leeren Strings auf 5 Bulletpoints
      while (bullets.length < 5) {
        bullets.push('')
      }
      
      // Escape CSV-Werte (ersetze " mit "" und wrap in " wenn Semikolon enthalten)
      const escape = (val: string) => {
        if (!val) return ''
        const str = String(val).replace(/"/g, '""')
        if (str.includes(';') || str.includes('\n') || str.includes('"')) {
          return `"${str}"`
        }
        return str
      }
      
      return [
        bp.kArtikel,
        escape(bp.cArtNr || ''),
        escape(bp.cName || ''),
        escape(bullets[0]),
        escape(bullets[1]),
        escape(bullets[2]),
        escape(bullets[3]),
        escape(bullets[4]),
        bp.generatedAt ? new Date(bp.generatedAt).toLocaleString('de-DE') : ''
      ].join(';')
    }).join('\n')
    
    const csv = header + rows
    
    // UTF-8 BOM für Excel
    const bom = '\ufeff'
    const csvWithBom = bom + csv
    
    // Dateiname mit Timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `amazon_bulletpoints_${timestamp}.csv`
    
    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
    
  } catch (error: any) {
    console.error('[Batch Download] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
