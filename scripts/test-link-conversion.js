/**
 * Teste die Link-Konvertierung
 */

// Simuliere die Konvertierung
let body = `Hallo,

ich bin auf Ihre Firma gestoßen und habe gesehen, dass Sie mit Stahl arbeiten.

Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr).
Ein paar Infos und auch ein Anfrageformular für Geschäftskunden finden Sie auch unter: https://score-schleifwerkzeuge.de/business

Viele Grüße`

console.log('VORHER:')
console.log(body)
console.log('\n' + '='.repeat(80) + '\n')

// Konvertiere Plain-Text-Link zu HTML-Link
if (body.includes('https://score-schleifwerkzeuge.de/business') && !body.includes('<a href=')) {
  body = body.replace(
    /https:\/\/score-schleifwerkzeuge\.de\/business/g,
    `<a href="https://score-schleifwerkzeuge.de/business">https://score-schleifwerkzeuge.de/business</a>`
  )
}

console.log('NACHHER (mit klickbarem Link):')
console.log(body)
console.log('\n✅ Link wurde erfolgreich konvertiert!')
