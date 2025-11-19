/**
 * SCORE E-Mail Generator
 * Erstellt personalisierte B2B-Anschreiben basierend auf Firmen-Analyse
 */

import { emergentChatCompletion } from '@/lib/emergent-llm'
import type { ScoreAnalyzerResult } from './score-analyzer'

export interface EmailTemplate {
  betreff: string
  text: string
  html: string
}

/**
 * Generiert eine personalisierte E-Mail basierend auf Firmen-Analyse
 */
export async function generatePersonalizedEmail(
  analysis: ScoreAnalyzerResult,
  kontaktperson?: { name: string; position: string; bereich: string }
): Promise<EmailTemplate> {
  
  // Wähle besten Kontakt falls nicht angegeben
  if (!kontaktperson && analysis.kontaktpersonen.length > 0) {
    // Priorisiere: Geschäftsführung > Einkauf > Produktion > Rest
    kontaktperson = analysis.kontaktpersonen.sort((a, b) => {
      const priority = { 'Geschäftsführung': 0, 'Einkauf': 1, 'Produktion': 2, 'Vertrieb': 3 }
      return (priority[a.bereich] || 99) - (priority[b.bereich] || 99)
    })[0]
  }
  
  // Extrahiere relevante Daten
  const firmenname = analysis.firmenname
  const werkstoffe = analysis.werkstoffe.map(w => w.name).join(', ')
  const anwendungen = analysis.anwendungen.slice(0, 3).join(', ')
  const produkte = analysis.potenzielle_produkte.slice(0, 3)
  
  // LLM-Prompt für professionelle E-Mail
  const prompt = `Erstelle eine professionelle B2B-E-Mail für die Kaltakquise im Schleifwerkzeuge-Vertrieb.

FIRMA: ${firmenname}
BRANCHE: ${analysis.branche}
KONTAKTPERSON: ${kontaktperson ? `${kontaktperson.name} (${kontaktperson.position})` : 'Sehr geehrte Damen und Herren'}
WERKSTOFFE: ${werkstoffe}
ANWENDUNGEN: ${anwendungen}

EMPFOHLENE PRODUKTE:
${produkte.map(p => `- ${p.kategorie} für ${p.für_werkstoff} (${p.für_anwendung})`).join('\n')}

STRUKTUR DER E-MAIL:

1. BETREFF:
- Kurz und spezifisch
- Bezug zu Werkstoffen oder Anwendung
- Beispiel: "Schleifwerkzeuge für Ihre Stahlbearbeitung"

2. ANREDE:
${kontaktperson ? `- "Sehr geehrter Herr/Frau ${kontaktperson.name.split(' ').pop()},"` : '- "Sehr geehrte Damen und Herren,"'}

3. EINSTIEG (1-2 Sätze):
- Wie wir auf die Firma aufmerksam wurden
- Bezug zu ihrer Branche/Anwendung/Werkstoffen
- Beispiel: "Auf der Suche nach innovativen Metallbau-Betrieben sind wir auf Ihr Unternehmen aufmerksam geworden. Ihre Spezialisierung auf Edelstahl-Verarbeitung passt hervorragend zu unserem Produktportfolio."

4. HAUPTTEIL (2-3 Sätze):
- Unser Angebot/USP
- WICHTIG: Erwähne dass wir mit allen relevanten Herstellern zusammenarbeiten
- Erwähne langjährige Erfahrung
- Erwähne schnelle Lieferung
- Konkret auf die empfohlenen Produkte eingehen

5. CALL-TO-ACTION (2 Optionen):
- Option 1: "Gerne können Sie uns Ihren Jahresbedarf zusenden"
- Option 2: "Oder wir vereinbaren ein unverbindliches Beratungsgespräch"

6. LINK:
- Erwähne Link zur B2B-Seite: https://score-schleifwerkzeuge.de/b2b

7. ABSCHLUSS:
- Professionelle Grußformel
- Unterschrift: "Mit freundlichen Grüßen, Ihr SCORE Team"

WICHTIG:
- Professionell aber nicht steif
- Konkret auf die Firma eingehen
- Nutze die spezifischen Werkstoffe und Anwendungen
- Zeige Verständnis für ihre Branche
- Maximal 150 Wörter
- Keine übertriebenen Versprechen

FORMAT:
Antworte im JSON-Format:
{
  "betreff": "...",
  "text": "..."
}

NUR JSON, kein zusätzlicher Text!`

  try {
    const llmResponse = await emergentChatCompletion({
      messages: [
        { role: 'system', content: 'Du bist ein professioneller B2B-Texter für technische Produkte. Du schreibst präzise, sachlich und überzeugend.' },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 800
    })
    
    const responseText = llmResponse.choices[0].message.content.trim()
    
    // Extrahiere JSON
    let jsonText = responseText
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim()
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim()
    }
    
    const result = JSON.parse(jsonText)
    
    // Konvertiere Text zu HTML (einfache Formatierung)
    const htmlText = result.text
      .split('\n\n')
      .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')
    
    // Füge B2B-Link hinzu falls nicht vorhanden
    let finalText = result.text
    let finalHtml = htmlText
    
    if (!finalText.includes('score-schleifwerkzeuge.de')) {
      finalText += '\n\nMehr über unser Sortiment: https://score-schleifwerkzeuge.de/b2b'
      finalHtml += '<p>Mehr über unser Sortiment: <a href="https://score-schleifwerkzeuge.de/b2b">https://score-schleifwerkzeuge.de/b2b</a></p>'
    }
    
    return {
      betreff: result.betreff,
      text: finalText,
      html: finalHtml
    }
    
  } catch (error) {
    console.error('[Email Generator] Fehler:', error)
    
    // Fallback: Template-basierte E-Mail
    return generateFallbackEmail(analysis, kontaktperson)
  }
}

/**
 * Fallback: Einfache Template-basierte E-Mail
 */
function generateFallbackEmail(
  analysis: ScoreAnalyzerResult,
  kontaktperson?: { name: string; position: string; bereich: string }
): EmailTemplate {
  
  const anrede = kontaktperson 
    ? `Sehr geehrter Herr/Frau ${kontaktperson.name.split(' ').pop()}`
    : 'Sehr geehrte Damen und Herren'
  
  const werkstoffe = analysis.werkstoffe.map(w => w.name).slice(0, 2).join(' und ')
  const produkte = analysis.potenzielle_produkte.slice(0, 2).map(p => p.kategorie).join(' und ')
  
  const text = `${anrede},

auf der Suche nach innovativen ${analysis.branche}-Betrieben sind wir auf Ihr Unternehmen aufmerksam geworden. Ihre Arbeit mit ${werkstoffe || 'verschiedenen Werkstoffen'} passt hervorragend zu unserem Produktportfolio.

Als langjähriger Partner arbeiten wir mit allen relevanten Herstellern von Schleifwerkzeugen zusammen. Besonders für Ihre Anwendungen könnten ${produkte || 'unsere Schleifwerkzeuge'} interessant sein. Wir überzeugen durch schnelle Lieferung und kompetente Beratung.

Gerne können Sie uns Ihren Jahresbedarf zusenden, oder wir vereinbaren ein unverbindliches Beratungsgespräch.

Mehr über unser Sortiment: https://score-schleifwerkzeuge.de/b2b

Mit freundlichen Grüßen,
Ihr SCORE Team`

  const html = text
    .split('\n\n')
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
    .replace('https://score-schleifwerkzeuge.de/b2b', '<a href="https://score-schleifwerkzeuge.de/b2b">https://score-schleifwerkzeuge.de/b2b</a>')
  
  return {
    betreff: `Schleifwerkzeuge für Ihre ${werkstoffe || analysis.branche}-Bearbeitung`,
    text,
    html
  }
}

/**
 * Generiert E-Mail-Sequenz (Follow-ups)
 */
export async function generateEmailSequence(
  analysis: ScoreAnalyzerResult,
  kontaktperson?: { name: string; position: string; bereich: string }
): Promise<EmailTemplate[]> {
  
  const emails: EmailTemplate[] = []
  
  // Erste E-Mail
  const firstEmail = await generatePersonalizedEmail(analysis, kontaktperson)
  emails.push(firstEmail)
  
  // Follow-up 1 (nach 5 Tagen) - TODO: Implementieren wenn gewünscht
  // Follow-up 2 (nach 10 Tagen) - TODO: Implementieren wenn gewünscht
  
  return emails
}
