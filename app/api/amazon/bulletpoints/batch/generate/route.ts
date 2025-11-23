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
    const { kArtikel: kArtikelList, filter, limit, promptId } = body
    
    const db = await getDb()
    const articlesCollection = db.collection('articles')
    const bulletpointsCollection = db.collection('amazon_bulletpoints_generated')
    const promptsCollection = db.collection('amazon_bulletpoint_prompts')
    
    // Lade ausgewählten Prompt (by version number from promptId)
    const promptVersion = parseInt(promptId) || 2
    const selectedPrompt = await promptsCollection.findOne({ version: promptVersion, isActive: true })
    
    if (!selectedPrompt) {
      return NextResponse.json({
        ok: false,
        error: 'Prompt nicht gefunden'
      }, { status: 400 })
    }
    
    console.log(`[Batch Generate] Verwende Prompt v${selectedPrompt.version}: ${selectedPrompt.name}`)
    
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
        
        // 2. Lade Merkmale (sollten bereits in MongoDB sein)
        const merkmale = artikel.merkmale || []
        
        if (merkmale.length === 0) {
          console.log(`[Batch] WARNUNG: kArtikel=${kArtikel} hat keine Merkmale in MongoDB - bitte Artikel neu importieren`)
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
        const fullPrompt = selectedPrompt.userPromptTemplate.replace('{{PRODUCT_DATA}}', productInfo)

        // 6. Generiere Bulletpoints mit Claude Sonnet 4
        const claude = new ClaudeClient()
        const response = await claude.createMessage(
          [
            {
              role: 'user',
              content: fullPrompt
            }
          ],
          selectedPrompt.systemPrompt,
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
              promptId: selectedPrompt._id,
              promptName: selectedPrompt.name,
              promptVersion: selectedPrompt.version
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
