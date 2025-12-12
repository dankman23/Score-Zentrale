export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Reduziert auf 60 Sekunden um Nginx-Timeout zu vermeiden

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { getMssqlPool } from '@/lib/db/mssql'
import { ClaudeClient } from '@/lib/claude-client'

/**
 * POST /api/amazon/bulletpoints/batch/generate
 * Generiert Amazon Bulletpoints für mehrere Artikel auf einmal
 * OPTIMIERT: Besseres Error Handling, robuste MongoDB-Verbindung
 * 
 * Body: { kArtikel: number[] } oder { filter: {...}, limit?: number }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { kArtikel: kArtikelList, filter, limit, promptId } = body
    
    console.log('[Batch Generate] Start - Request:', { 
      artikelCount: kArtikelList?.length, 
      hasFilter: !!filter, 
      limit, 
      promptId 
    })
    
    const { db } = await connectToDatabase()
    const articlesCollection = db.collection('articles')
    const bulletpointsCollection = db.collection('amazon_bulletpoints_generated')
    const promptsCollection = db.collection('amazon_bulletpoint_prompts')
    
    // Lade ausgewählten Prompt (by version number from promptId)
    const promptVersion = parseInt(promptId) || 2
    // Suche nach Prompt ohne isActive-Filter, damit auch inaktive Prompts verwendet werden können
    const selectedPrompt = await promptsCollection.findOne({ version: promptVersion })
    
    if (!selectedPrompt) {
      return NextResponse.json({
        ok: false,
        error: `Prompt mit Version ${promptVersion} nicht gefunden`
      }, { status: 400 })
    }
    
    console.log(`[Batch Generate] Verwende Prompt v${selectedPrompt.version}: ${selectedPrompt.name} (${selectedPrompt.isActive ? 'aktiv' : 'inaktiv'})`)
    
    let artikelIds: number[] = []
    
    // Fall 1: Direkte Artikel-ID Liste (max 50)
    if (kArtikelList && Array.isArray(kArtikelList)) {
      const maxLimit = 50
      artikelIds = kArtikelList.slice(0, maxLimit)
      
      if (kArtikelList.length > maxLimit) {
        console.log(`[Batch Generate] Artikel-Liste von ${kArtikelList.length} auf ${maxLimit} begrenzt`)
      }
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
      
      // Limit auf max 50 Artikel um Timeout zu vermeiden
      const maxLimit = 50
      const effectiveLimit = Math.min(limit || 50, maxLimit)
      
      const articles = await articlesCollection
        .find(query)
        .limit(effectiveLimit)
        .project({ kArtikel: 1 })
        .toArray()
      
      artikelIds = articles.map(a => a.kArtikel)
      
      if (limit && limit > maxLimit) {
        console.log(`[Batch Generate] Limit von ${limit} auf ${maxLimit} reduziert um Timeout zu vermeiden`)
      }
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
        
        // 2. Lade Merkmale (aus MongoDB oder MSSQL nachladen)
        let merkmale = artikel.merkmale || []
        
        if (merkmale.length === 0 && mssqlPool) {
          console.log(`[Batch] Lade Merkmale für kArtikel=${kArtikel} aus MSSQL...`)
          try {
            const pool = mssqlPool
            
            // Korrekte Query mit tMerkmalSprache für Namen und tMerkmalWertSprache für Werte
            const merkmalResult = await pool.request()
              .input('kArtikel', kArtikel)
              .query(`
                SELECT 
                  ms.cName AS MerkmalName,
                  mws.cWert AS MerkmalWert
                FROM 
                  tArtikelMerkmal am
                JOIN 
                  tMerkmalSprache ms ON am.kMerkmal = ms.kMerkmal
                JOIN 
                  tMerkmalWertSprache mws ON am.kMerkmalWert = mws.kMerkmalWert
                WHERE 
                  am.kArtikel = @kArtikel
                  AND ms.kSprache = 1
                  AND mws.kSprache = 1
              `)
            
            if (merkmalResult.recordset.length > 0) {
              merkmale = merkmalResult.recordset.map(row => ({
                name: row.MerkmalName,
                wert: row.MerkmalWert
              }))
              
              console.log(`[Batch] Erfolgreich ${merkmale.length} Merkmale für kArtikel=${kArtikel} geladen:`, merkmale)
              
              // Optional: In MongoDB cachen
              await articlesCollection.updateOne(
                { kArtikel },
                { $set: { merkmale } }
              )
            } else {
              console.log(`[Batch] Keine Merkmale gefunden für kArtikel=${kArtikel}`)
            }
          } catch (e: any) {
            console.log(`[Batch] Fehler beim Laden der Merkmale für kArtikel=${kArtikel}:`, e.message)
          }
        } else if (merkmale.length === 0) {
          console.log(`[Batch] WARNUNG: kArtikel=${kArtikel} hat keine Merkmale und MSSQL nicht verfügbar`)
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

        // 5. Bereite Prompt vor (Template mit Produktdaten befüllen)
        const fullPrompt = selectedPrompt.prompt.replace('{{PRODUKTINFO}}', productInfo)

        // 6. Generiere Bulletpoints mit Claude Sonnet 4
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
        
        console.log(`[Batch] kArtikel=${kArtikel} - Generiert: ${bullets.length} Bulletpoints mit Prompt: ${selectedPrompt.name}`)
        
        // 7. Speichere in Datenbank
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
              promptVersion: selectedPrompt.version,
              promptName: selectedPrompt.name
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
        failed++
        results.push({
          kArtikel,
          success: false,
          error: error.message
        })
      }
    }
    
    // Ende der Schleife
    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(`[Batch Generate] Abgeschlossen in ${duration}s: ${succeeded} erfolgreich, ${failed} fehlgeschlagen`)
    
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
    console.error('[Batch Generate] Critical Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unbekannter Fehler bei der Bulletpoint-Generierung',
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 })
  }
}
