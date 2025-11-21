export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * POST /api/amazon/bulletpoints/generate
 * Generiert Amazon Bulletpoints mit GPT-4o
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      artikelnummer,
      artikelname,
      beschreibung,
      kurzbeschreibung,
      merkmale,
      userPrompt
    } = body
    
    if (!artikelname) {
      return NextResponse.json({
        ok: false,
        error: 'Artikelname fehlt'
      }, { status: 400 })
    }
    
    const productInfo = `
ARTIKELNUMMER: ${artikelnummer || 'N/A'}
PRODUKTNAME: ${artikelname}

KURZBESCHREIBUNG:
${kurzbeschreibung || 'Keine Angabe'}

BESCHREIBUNG:
${beschreibung || 'Keine Angabe'}

TECHNISCHE MERKMALE:
${merkmale || 'Keine Angabe'}
`

    const fullPrompt = `${userPrompt ||'Erstelle 5 hochwertige Bulletpoints für Amazon'}

Hier sind die Produktinformationen für EINEN Artikel:
${productInfo}

WICHTIG: Die TECHNISCHEN MERKMALE oben enthalten ALLE relevanten Spezifikationen. 
Bitte verwende ALLE diese technischen Daten in den Bulletpoints!

Bitte erstelle GENAU 5 Bulletpoints für Amazon. Jeder Bulletpoint sollte:
- Maximal 200-250 Zeichen lang sein (Amazon-Richtlinien)
- Mit einem Großbuchstaben beginnen
- Die wichtigsten Produktvorteile hervorheben
- SEO-Keywords enthalten
- ALLE technischen Details aus den TECHNISCHEN MERKMALEN einbeziehen
- Keine Informationen weglassen - besonders nicht aus den technischen Merkmalen!
- Maße, Körnung, Bindung, Härte, Typ, Schaftmaße etc. MÜSSEN erwähnt werden

Format:
• [Bulletpoint 1]
• [Bulletpoint 2]
• [Bulletpoint 3]
• [Bulletpoint 4]
• [Bulletpoint 5]

Antworte NUR mit den 5 Bulletpoints, keine zusätzlichen Erklärungen.`

    console.log(`[Bulletpoints] Generating for: ${artikelname}`)
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für Amazon-Produktbeschreibungen und SEO-optimierte Bulletpoints.'
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    })
    
    const bulletpoints = completion.choices[0]?.message?.content || ''
    
    console.log(`[Bulletpoints] Generated ${bulletpoints.length} characters`)
    
    return NextResponse.json({
      ok: true,
      artikelnummer,
      bulletpoints,
      usage: completion.usage
    })
    
  } catch (error: any) {
    console.error('[Bulletpoints] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
