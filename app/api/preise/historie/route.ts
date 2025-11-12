export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../lib/db/mssql'

/**
 * GET /api/preise/historie?sku=122112
 * Lädt Preis-Historie mit Erfolgsmetriken
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sku = searchParams.get('sku') || '122112'
    
    const pool = await getMssqlPool()
    
    // 1. Finde Artikel
    const artikel = await pool.request()
      .input('sku', sku)
      .query(`
        SELECT TOP 1 *
        FROM dbo.tArtikel
        WHERE cArtNr = @sku
      `)
    
    if (artikel.recordset.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Artikel nicht gefunden'
      })
    }
    
    const kArtikel = artikel.recordset[0].kArtikel
    const artikelInfo = artikel.recordset[0]
    
    // 2. Preis-Historie aus Score.tPreisChangeLog
    let preisHistorie = []
    try {
      const historie = await pool.request().query(`
        SELECT TOP 100 *
        FROM Score.tPreisChangeLog
        WHERE kArtikel = ${kArtikel}
        ORDER BY dChanged DESC
      `)
      preisHistorie = historie.recordset
    } catch (e: any) {
      console.log('Score.tPreisChangeLog nicht verfügbar:', e.message)
    }
    
    // Fallback: tArtikelHistory
    if (preisHistorie.length === 0) {
      try {
        const historie = await pool.request().query(`
          SELECT TOP 100 *
          FROM dbo.tArtikelHistory
          WHERE kArtikel = ${kArtikel}
          ORDER BY dErstellt DESC
        `)
        preisHistorie = historie.recordset
      } catch (e: any) {
        console.log('tArtikelHistory nicht verfügbar:', e.message)
      }
    }
    
    // 3. Aktuelle Preise aus tPreis
    const aktuellePreise = await pool.request().query(`
      SELECT *
      FROM dbo.tPreis
      WHERE kArtikel = ${kArtikel}
    `)
    
    // 4. Verkaufsdaten für Erfolgsmetrik (letzte 12 Monate)
    const verkaufsdaten = await pool.request().query(`
      SELECT 
        op.fVKNetto as vk_netto,
        op.fEKNetto as ek_netto,
        op.nAnzahl as menge,
        o.dErstellt as datum,
        DATEDIFF(day, o.dErstellt, GETDATE()) as tage_alt
      FROM dbo.tBestellposition op
      INNER JOIN dbo.tBestellung o ON op.tBestellung_kBestellung = o.kBestellung
      WHERE op.kArtikel = ${kArtikel}
        AND o.dErstellt >= DATEADD(month, -12, GETDATE())
        AND o.cStatus NOT IN ('storniert', 'abgelehnt')
      ORDER BY o.dErstellt DESC
    `)
    
    // 5. Berechne Erfolgsmetriken für jeden Preis-Zeitraum
    const historieWithMetrics = preisHistorie.map((preis, idx) => {
      const naechsterPreis = preisHistorie[idx + 1]
      const vonDatum = naechsterPreis ? new Date(naechsterPreis.dChanged || naechsterPreis.dErstellt) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const bisDatum = new Date(preis.dChanged || preis.dErstellt)
      
      // Finde Verkäufe in diesem Zeitraum
      const verkaufeInPeriode = verkaufsdaten.recordset.filter(v => {
        const vDatum = new Date(v.datum)
        return vDatum >= vonDatum && vDatum <= bisDatum
      })
      
      // Berechne Metriken
      const anzahlVerkaufe = verkaufeInPeriode.reduce((sum, v) => sum + (v.menge || 0), 0)
      const umsatz = verkaufeInPeriode.reduce((sum, v) => sum + (v.vk_netto * v.menge), 0)
      const einkauf = verkaufeInPeriode.reduce((sum, v) => sum + (v.ek_netto * v.menge), 0)
      const rohertrag = umsatz - einkauf
      const durchschnittEK = anzahlVerkaufe > 0 ? einkauf / anzahlVerkaufe : 0
      
      // Zeitraum in Tagen
      const tage = Math.max(1, Math.ceil((bisDatum.getTime() - vonDatum.getTime()) / (1000 * 60 * 60 * 24)))
      
      // Erfolgsmetrik: Rohertrag pro Tag
      const rohertragProTag = tage > 0 ? rohertrag / tage : 0
      
      return {
        vk_netto: preis.fVKNetto || preis.fPreisNetto || 0,
        durchschnitt_ek: durchschnittEK,
        von_datum: vonDatum.toISOString(),
        bis_datum: bisDatum.toISOString(),
        tage_aktiv: tage,
        anzahl_verkaufe: anzahlVerkaufe,
        umsatz,
        rohertrag,
        rohertrag_pro_tag: rohertragProTag,
        marge_prozent: umsatz > 0 ? (rohertrag / umsatz * 100) : 0
      }
    })
    
    return NextResponse.json({
      ok: true,
      artikel: artikelInfo,
      aktuelle_preise: aktuellePreise.recordset,
      historie: historieWithMetrics,
      rohdaten: {
        preis_historie_count: preisHistorie.length,
        verkaufe_count: verkaufsdaten.recordset.length
      }
    })
  } catch (error: any) {
    console.error('[Preis-Historie] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
