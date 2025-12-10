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
    const articlesCollection = db.collection('articles')

    // Lade alle verfügbaren Kataloge
    const catalogs = await catalogsCollection.find({ status: 'active' }).toArray()
    
    const catalogInfo = catalogs.map(c => 
      `- ${c.manufacturer}: ${c.name} (${c.size_mb} MB)`
    ).join('\n')

    // Zähle Klingspor Dokumente
    const klingsporCount = catalogs.filter(c => c.manufacturer === 'Klingspor').length
    
    // System Prompt
    const systemPrompt = `Du bist ein Experte für Schleifwerkzeuge und Oberflächenbearbeitung. 

Verfügbare Hersteller-Kataloge:
${catalogInfo}

🌟 BESONDERS: ${klingsporCount} Klingspor Dokumente verfügbar (Hauptkatalog + Grundwissen + 425 Datenblätter) - Klingspor ist unser Premium-Partner!

WICHTIG: Die Katalog-PDFs sind NICHT hochgeladen. Du musst basierend auf deinem Wissen über diese Hersteller antworten.

Deine Aufgabe:
1. Verstehe die Anforderung des Kunden (Material, Anwendung, Körnung, etc.)
2. Empfehle passende Produkte von den verfügbaren Herstellern
3. **BEVORZUGE Klingspor-Produkte** wenn sie zur Anforderung passen (Premium-Partner!)
4. Nenne konkrete Produktnamen/Typen (z.B. "CS 411 X", "PS 22 K", "KL 361 JF")
5. Erkläre kurz, warum das Produkt passt

Format für Produktempfehlungen:
**Produktname/Typ** (Hersteller)
- Anwendung: [Beschreibung]
- Warum: [Kurze Begründung]

WICHTIG: Nenne die genauen Produkttyp-Bezeichnungen (z.B. CS 411 X, nicht nur "Schleifband"), damit wir die Produkte in unserem Shop finden können!

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

    // Suche matching Produkte im Shopping Feed
    const matchingProducts: any[] = []
    
    if (eans.length > 0 || mpns.length > 0) {
      console.log('[Produktberater] Suche Produkte:', { eans, mpns })
      
      const query: any = {
        $or: []
      }
      
      if (eans.length > 0) {
        query.$or.push({ gtin: { $in: eans } })
      }
      if (mpns.length > 0) {
        // MPN kann verschiedene Formate haben
        const mpnVariations = mpns.flatMap(mpn => [
          mpn,
          mpn.toUpperCase(),
          mpn.toLowerCase(),
          `score-${mpn}`,
          mpn.replace(/[^a-zA-Z0-9]/g, '')
        ])
        query.$or.push({ mpn: { $in: mpnVariations } })
      }

      if (query.$or.length > 0) {
        const products = await shoppingFeedCollection
          .find(query)
          .limit(10)
          .toArray()

        for (const product of products) {
          matchingProducts.push({
            product_id: product.product_id,
            title: product.title,
            brand: product.brand,
            mpn: product.mpn,
            gtin: product.gtin,
            price: product.price,
            image_link: product.image_link,
            shop_url: product.link,
            availability: product.availability
          })
        }
      }
    }
    
    // Fallback: Textsuche wenn keine EAN/MPN gefunden
    if (matchingProducts.length === 0 && assistantMessage) {
      console.log('[Produktberater] Keine EAN/MPN, versuche Textsuche...')
      
      // Extrahiere Produktnamen/Keywords aus der Antwort
      const keywords = assistantMessage
        .match(/\*\*([^*]+)\*\*/g)
        ?.map(k => k.replace(/\*\*/g, '').trim())
        .slice(0, 3) || []
      
      if (keywords.length > 0) {
        console.log('[Produktberater] Suche nach Keywords:', keywords)
        
        // Versuche zuerst shopping_feed
        let textProducts = await shoppingFeedCollection
          .find({
            $or: keywords.map(kw => ({
              $or: [
                { title: { $regex: kw, $options: 'i' } },
                { description: { $regex: kw, $options: 'i' } }
              ]
            }))
          })
          .limit(6)
          .toArray()
        
        // Fallback auf articles collection wenn shopping_feed leer ist
        if (textProducts.length === 0) {
          console.log('[Produktberater] Shopping feed leer, suche in articles...')
          textProducts = await articlesCollection
            .find({
              $and: [
                { cAktiv: true },
                {
                  $or: keywords.map(kw => ({
                    $or: [
                      { cName: { $regex: kw, $options: 'i' } },
                      { cKurzBeschreibung: { $regex: kw, $options: 'i' } },
                      { cHerstellerName: { $regex: kw, $options: 'i' } }
                    ]
                  }))
                }
              ]
            })
            .sort({ fLagerbestand: -1 }) // Sortiere nach Lagerbestand (verfügbar zuerst)
            .limit(20) // Mehr Produkte holen für Diversität
            .toArray()
        }
        
        // Diversifizierung: Hole verschiedene Hersteller
        const herstellerMap = new Map()
        const diversifiedProducts = []
        
        for (const product of textProducts) {
          const hersteller = product.brand || product.cHerstellerName || 'Unbekannt'
          
          if (!herstellerMap.has(hersteller)) {
            herstellerMap.set(hersteller, [])
          }
          herstellerMap.get(hersteller).push(product)
        }
        
        // Nimm max 2 Produkte pro Hersteller für Diversität
        const manufacturers = Array.from(herstellerMap.keys())
        console.log('[Produktberater] Gefundene Hersteller:', manufacturers)
        
        for (const manufacturer of manufacturers) {
          const productsFromManufacturer = herstellerMap.get(manufacturer)
          // Sortiere nach Verfügbarkeit
          const sorted = productsFromManufacturer.sort((a: any, b: any) => {
            const aStock = a.fLagerbestand || a.quantity || 0
            const bStock = b.fLagerbestand || b.quantity || 0
            return bStock - aStock
          })
          diversifiedProducts.push(...sorted.slice(0, 2)) // Max 2 pro Hersteller
        }
        
        textProducts = diversifiedProducts.slice(0, 6)
        
        for (const product of textProducts) {
          // Handle both shopping_feed and articles format
          if (product.product_id) {
            // shopping_feed format
            matchingProducts.push({
              product_id: product.product_id,
              title: product.title,
              brand: product.brand,
              mpn: product.mpn,
              gtin: product.gtin,
              price: product.price,
              image_link: product.image_link,
              shop_url: product.link,
              availability: product.availability
            })
          } else {
            // articles format
            // Baue Shop-URL korrekt
            const shopUrl = product.cSeo 
              ? `https://score-schleifwerkzeuge.de/${product.cSeo}` 
              : `https://score-schleifwerkzeuge.de/artikel/${product.kArtikel}`
            
            // Versuche Bild-URL zu konstruieren
            const imageUrl = product.cBildpfad 
              ? `https://score-schleifwerkzeuge.de/media/image/${product.cBildpfad}` 
              : (product.cVorschaubildURL || null)
            
            matchingProducts.push({
              product_id: product.kArtikel?.toString() || product._id,
              title: product.cName,
              brand: product.cHerstellerName,
              mpn: product.cArtNr,
              gtin: product.cBarcode || null,
              price: product.fVKNetto ? `${product.fVKNetto.toFixed(2)} EUR` : null,
              image_link: imageUrl,
              shop_url: shopUrl,
              availability: product.fLagerbestand > 0 ? 'in stock' : 'out of stock',
              stock: product.fLagerbestand || 0
            })
          }
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
