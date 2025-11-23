export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { ClaudeClient } from '../../../lib/claude-client'

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

    // PERFEKTER PROMPT basierend auf Kundenbeispiel
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
