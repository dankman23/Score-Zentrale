export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../../lib/db/mongodb'
import { getMssqlPool } from '@/lib/db/mssql'
import { ClaudeClient } from '@/lib/claude-client'

/**
 * POST /api/amazon/bulletpoints/batch/generate
 * Generiert Amazon Bulletpoints für mehrere Artikel auf einmal
 * 
 * Body: { kArtikel: number[] } oder { filter: {...}, limit?: number }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { kArtikel: kArtikelList, filter, limit } = body
    
    const db = await getDb()
    const articlesCollection = db.collection('articles')
    const bulletpointsCollection = db.collection('amazon_bulletpoints_generated')
    
    let artikelIds: number[] = []
    
    // Fall 1: Direkte Artikel-ID Liste
    if (kArtikelList && Array.isArray(kArtikelList)) {
      artikelIds = kArtikelList
    }
    // Fall 2: Filter-basierte Auswahl
    else if (filter) {
      const query: any = {}
      
      if (filter.search) {
        query.$or = [
          { cArtNr: { $regex: filter.search, $options: 'i' } },
          { cName: { $regex: filter.search, $options: 'i' } },
          { cBarcode: { $regex: filter.search, $options: 'i' } },
          { cHerstellerName: { $regex: filter.search, $options: 'i' } }
        ]
      }
      
      if (filter.hersteller && filter.hersteller !== 'all') {
        query.cHerstellerName = filter.hersteller
      }
      
      if (filter.warengruppe && filter.warengruppe !== 'all') {
        query.cWarengruppenName = filter.warengruppe
      }
      
      const articles = await articlesCollection
        .find(query)
        .limit(limit || 1000)
        .project({ kArtikel: 1 })
        .toArray()
      
      artikelIds = articles.map(a => a.kArtikel)
    }
    else {
      return NextResponse.json({
        ok: false,
        error: 'Bitte kArtikel Array oder filter angeben'
      }, { status: 400 })
    }
    
    if (artikelIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Artikel gefunden'
      }, { status: 400 })
    }
    
    console.log(`[Batch Generate] Starte Verarbeitung von ${artikelIds.length} Artikeln`)
    
    const results: any[] = []
    let succeeded = 0
    let failed = 0
    
    // Lade MSSQL Pool nur einmal
    let mssqlPool: any = null
    try {
      mssqlPool = await getMssqlPool()
    } catch (e) {
      console.log('[Batch Generate] MSSQL Pool nicht verfügbar, nutze nur MongoDB')
    }
    
    // Verarbeite Artikel sequenziell
    for (let i = 0; i < artikelIds.length; i++) {
      const kArtikel = artikelIds[i]
      
      try {
        console.log(`[Batch Generate] Artikel ${i + 1}/${artikelIds.length}: kArtikel=${kArtikel}`)
        
        // 1. Lade Artikel-Details aus MongoDB
        const artikel = await articlesCollection.findOne({ kArtikel })
        
        if (!artikel) {
          results.push({
            kArtikel,
            success: false,
            error: 'Artikel nicht in MongoDB gefunden'
          })
          failed++
          continue
        }
        
        // 2. Lade Merkmale (aus MongoDB oder MSSQL)
        let merkmale = artikel.merkmale || []
        
        if (merkmale.length === 0 && mssqlPool) {
          try {
            const merkmaleResult = await mssqlPool.request()
              .input('kArtikel', kArtikel)
              .query(`
                SELECT 
                  m.cName as name,
                  mw.cWert as wert
                FROM tArtikelMerkmal am
                INNER JOIN tMerkmal m ON am.kMerkmal = m.kMerkmal
                LEFT JOIN tMerkmalWert mw ON am.kMerkmalWert = mw.kMerkmalWert
                WHERE am.kArtikel = @kArtikel
                ORDER BY m.nSort, m.cName
              `)
            
            merkmale = merkmaleResult.recordset.map((m: any) => ({
              name: m.name,
              wert: m.wert || ''
            }))
          } catch (e) {
            console.log(`[Batch] Konnte Merkmale nicht laden für kArtikel=${kArtikel}`)
          }
        }
        
        // 3. Formatiere Merkmale-Text
        const merkmaleText = merkmale
          .map(m => `${m.name}: ${m.wert}`)
          .join('\n')
        
        // 4. Bereite Produktinfo vor
        const productInfo = `
ARTIKELNUMMER: ${artikel.cArtNr || 'N/A'}
PRODUKTNAME: ${artikel.cName || 'N/A'}

KURZBESCHREIBUNG:
${artikel.cKurzBeschreibung || 'Keine Angabe'}

BESCHREIBUNG:
${artikel.cBeschreibung || 'Keine Angabe'}

TECHNISCHE MERKMALE:
${merkmaleText || 'Keine Angabe'}
`

        // 5. Generiere Bulletpoints mit GPT-4o
        const fullPrompt = `Du bist ein Experte für Amazon-Produktbeschreibungen. Erstelle GENAU 5 Bulletpoints nach diesem EXAKTEN Format und Stil:

PRODUKTINFORMATIONEN:
${productInfo}

BEISPIEL für korrekten Stil (Artikel 426625):
Robuster keramischer Schleifstift (Industriequalität) für präzise Metallbearbeitung, selbst an schwer zugänglichen Stellen. Ideal zum Entgraten, Anfasen und Kantenbrechen an Stahloberflächen.;Langlebig und effizient: Keramische Bindung (V-Bindung) mit rosafarbenem Edelkorund (Aluminiumoxid 88A), Körnung 60 (mittelfein) – sorgt für hohe Abtragsleistung und hervorragende Standzeit.;Härtegrad P (universeller Einsatz) gewährleistet optimale Balance zwischen Materialabtrag und Oberflächenqualität.;Praktisches Format: Schleifkopf-Ø 20 x 63 mm, Schaft Ø 6 x 40 mm – passend für alle gängigen Geradschleifer.;Tyrolit Premium-Qualität: Hochleistungs-Schleifstift für Profis und anspruchsvolle Heimwerker. Entwickelt für maximale Effizienz und lange Standzeit bei intensiver Metallbearbeitung.

STRUKTUR (EXAKT einhalten!):
1. BP1: Hauptvorteil + (Qualifikation in Klammern) + Anwendungsgebiet
2. BP2: "Langlebig und effizient:" + technische Details (in Klammern) + Nutzen mit Bindestrich
3. BP3: Technisches Merkmal + konkrete Vorteile ("gewährleistet", "sorgt für")
4. BP4: "Praktisches Format:" + Maße mit Ø-Zeichen + "passend für..."
5. BP5: "Tyrolit Premium-Qualität:" + Zielgruppe + Zusammenfassung

WICHTIGE REGELN:
- ALLE technischen Merkmale verwenden (Maße, Körnung, Bindung, Härte, Material)
- Klammern für Spezifikationen nutzen: (Industriequalität), (V-Bindung), (mittelfein)
- Ø-Zeichen für Durchmesser verwenden
- Doppelpunkte nach Einleitungen: "Langlebig und effizient:", "Praktisches Format:"
- Aktive Verben: "gewährleistet", "sorgt für", "passend für", "entwickelt für"
- Professioneller, technischer aber verständlicher Stil
- Jeder Bulletpoint 150-250 Zeichen
- SEMIKOLON als Trennzeichen zwischen Bulletpoints (NICHT Bullet-Zeichen!)

AUSGABE: Gib NUR die 5 Bulletpoints mit Semikolon getrennt zurück, KEINE weiteren Erklärungen!

Format: [BP1];[BP2];[BP3];[BP4];[BP5]`

        // Claude Sonnet 4 API Call
        const claude = new ClaudeClient()
        const response = await claude.createMessage(
          [
            {
              role: 'user',
              content: fullPrompt
            }
          ],
          'Du bist ein Experte für Amazon-Produktbeschreibungen und SEO-optimierte Bulletpoints.',
          2000
        )
        
        const bulletpointsRaw = response.content[0]?.text || ''
        const bullets = bulletpointsRaw.split(';').map(b => b.trim()).filter(b => b.length > 0)
        
        console.log(`[Batch] kArtikel=${kArtikel} - Generiert: ${bullets.length} Bulletpoints`)
        
        // 6. Speichere in Datenbank
        await bulletpointsCollection.updateOne(
          { kArtikel },
          {
            $set: {
              kArtikel,
              cArtNr: artikel.cArtNr,
              cName: artikel.cName,
              bulletpoints: bulletpointsRaw,
              bullets: bullets,
              generatedAt: new Date(),
              prompt_version: 1
            }
          },
          { upsert: true }
        )
        
        results.push({
          kArtikel,
          cArtNr: artikel.cArtNr,
          cName: artikel.cName,
          success: true,
          bulletpoints: bulletpointsRaw,
          bullets: bullets
        })
        
        succeeded++
        
      } catch (error: any) {
        console.error(`[Batch] Fehler bei kArtikel=${kArtikel}:`, error.message)
        
        results.push({
          kArtikel,
          success: false,
          error: error.message
        })
        
        failed++
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log(`[Batch Generate] Abgeschlossen in ${duration}s: ${succeeded} erfolgreich, ${failed} fehlgeschlagen`)
    
    return NextResponse.json({
      ok: true,
      processed: artikelIds.length,
      succeeded,
      failed,
      duration: `${duration}s`,
      results
    })
    
  } catch (error: any) {
    console.error('[Batch Generate] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
