export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import OpenAI from 'openai'
import fs from 'fs'

/**
 * POST /api/produktberater/chat
 * ChatGPT-basierter Produktberater mit Katalog-Zugriff
 */
export async function POST(request: NextRequest) {
  try {
    const { message, conversation_history = [] } = await request.json()
    
    if (!message) {
      return NextResponse.json({
        ok: false,
        error: 'Keine Nachricht angegeben'
      }, { status: 400 })
    }

    console.log('[Produktberater] Anfrage:', message)

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const { db } = await connectToDatabase()
    const catalogsCollection = db.collection('manufacturer_catalogs')
    const shoppingFeedCollection = db.collection('shopping_feed')

    // Lade alle verfügbaren Kataloge
    const catalogs = await catalogsCollection.find({ status: 'active' }).toArray()
    
    const catalogInfo = catalogs.map(c => 
      `- ${c.manufacturer}: ${c.name} (${c.size_mb} MB)`
    ).join('\n')

    // System Prompt
    const systemPrompt = `Du bist ein Experte für Schleifwerkzeuge und Oberflächenbearbeitung. 

Verfügbare Hersteller-Kataloge:
${catalogInfo}

WICHTIG: Die Katalog-PDFs sind NICHT hochgeladen. Du musst basierend auf deinem Wissen über diese Hersteller antworten.

Deine Aufgabe:
1. Verstehe die Anforderung des Kunden (Material, Anwendung, Körnung, etc.)
2. Empfehle passende Produkte von den verfügbaren Herstellern
3. Nenne konkrete Produktnamen, EAN/MPN-Nummern wenn möglich
4. Erkläre kurz, warum das Produkt passt

Format für Produktempfehlungen:
**Produktname** (Hersteller)
- EAN/MPN: [falls bekannt]
- Anwendung: [Beschreibung]
- Warum: [Kurze Begründung]

Sei präzise, professionell und hilfreich!`

    // Baue Conversation History
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Füge bisherige Conversation hinzu
    for (const msg of conversation_history) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }

    // Füge neue User-Message hinzu
    messages.push({
      role: 'user',
      content: message
    })

    console.log('[Produktberater] Rufe ChatGPT auf...')

    // ChatGPT API Call
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1500
    })

    const assistantMessage = completion.choices[0]?.message?.content || 'Keine Antwort erhalten'

    console.log('[Produktberater] ChatGPT Antwort erhalten')

    // Extrahiere EAN/MPN aus der Antwort
    const eanPattern = /EAN[:\s]+([0-9]{8,13})/gi
    const mpnPattern = /MPN[:\s]+([A-Z0-9\-\.]+)/gi
    
    const eans: string[] = []
    const mpns: string[] = []
    
    let match
    while ((match = eanPattern.exec(assistantMessage)) !== null) {
      eans.push(match[1])
    }
    while ((match = mpnPattern.exec(assistantMessage)) !== null) {
      mpns.push(match[1])
    }

    // Suche matching Produkte in JTL
    const matchingProducts: any[] = []
    
    if (eans.length > 0 || mpns.length > 0) {
      console.log('[Produktberater] Suche Produkte:', { eans, mpns })
      
      const query: any = {
        $or: []
      }
      
      if (eans.length > 0) {
        query.$or.push({ cBarcode: { $in: eans } })
      }
      if (mpns.length > 0) {
        query.$or.push({ 'variations.cArtNr': { $in: mpns } })
      }

      if (query.$or.length > 0) {
        const products = await articlesCollection
          .find(query)
          .limit(10)
          .toArray()

        for (const product of products) {
          matchingProducts.push({
            kArtikel: product.kArtikel,
            cArtNr: product.cArtNr,
            cName: product.cName,
            cBarcode: product.cBarcode,
            cHerstellerName: product.cHerstellerName,
            fVKNetto: product.fVKNetto,
            // TODO: Produkt-Link generieren
            shop_url: `https://score-schleifwerkzeuge.de/artikel/${product.cArtNr}`
          })
        }
      }
    }

    console.log('[Produktberater] Gefundene Produkte:', matchingProducts.length)

    return NextResponse.json({
      ok: true,
      message: assistantMessage,
      products: matchingProducts,
      conversation_id: Date.now().toString(), // Einfache ID für diese Session
      model: 'gpt-4o',
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
        total_tokens: completion.usage?.total_tokens || 0
      }
    })

  } catch (error: any) {
    console.error('[Produktberater] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Fehler beim Verarbeiten der Anfrage'
    }, { status: 500 })
  }
}
