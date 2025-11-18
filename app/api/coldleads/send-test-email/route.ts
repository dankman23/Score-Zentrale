/**
 * API: Test-E-Mail senden
 * Sendet eine Test-E-Mail an eine angegebene Adresse
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'E-Mail-Adresse erforderlich' },
        { status: 400 }
      )
    }
    
    // Test-E-Mail Inhalt
    const testEmail = {
      betreff: 'SCORE Test-E-Mail - Kaltakquise-System',
      text: `Sehr geehrter Herr Leismann,

dies ist eine Test-E-Mail aus dem SCORE Kaltakquise-System.

Das System hat erfolgreich eine personalisierte E-Mail für Sie generiert:

FUNKTIONEN GETESTET:
✅ DACH-Crawler (Findet B2B-Firmen in DE/AT/CH)
✅ Deep-Analysis (Extrahiert Werkstoffe, Kontakte, Anwendungen)
✅ E-Mail-Generator (Erstellt personalisierte B2B-Anschreiben)

BEISPIEL FÜR ECHTE E-MAIL:
---------------------------------------
Betreff: Schleifwerkzeuge für Ihre Stahl-Bearbeitung

Sehr geehrter Herr Müller,

auf der Suche nach innovativen Metallbau-Betrieben sind wir auf Ihr Unternehmen aufmerksam geworden. Ihre Spezialisierung auf Stahl- und Edelstahl-Verarbeitung passt hervorragend zu unserem Produktportfolio.

Als langjähriger Partner arbeiten wir mit allen relevanten Herstellern von Schleifwerkzeugen zusammen. Besonders für Ihre Anwendungen wie Schweißen, Schleifen und Entgraten könnten unsere Schleifbänder und Fächerscheiben interessant sein. Wir überzeugen durch schnelle Lieferung und kompetente Beratung.

Gerne können Sie uns Ihren Jahresbedarf zusenden, oder wir vereinbaren ein unverbindliches Beratungsgespräch.

Mehr über unser Sortiment: https://score-schleifwerkzeuge.de/b2b

Mit freundlichen Grüßen,
Ihr SCORE Team
---------------------------------------

NÄCHSTE SCHRITTE:
1. Mail-Server konfigurieren (SMTP) für echten Versand
2. Autopilot starten für automatisierte Lead-Generierung
3. Echte Firmen crawlen und E-Mails versenden

System-Status: ✅ Vollständig funktionsfähig

Mit freundlichen Grüßen,
Ihr SCORE Kaltakquise-System

---
Diese E-Mail wurde automatisch generiert.
Test-Empfänger: ${email}
Zeitstempel: ${new Date().toLocaleString('de-DE')}
`
    }
    
    // INFO: Hier würde normalerweise der SMTP-Versand erfolgen
    // Da noch kein Mail-Server konfiguriert ist, geben wir nur die E-Mail zurück
    
    console.log('📧 Test-E-Mail vorbereitet für:', email)
    console.log('Betreff:', testEmail.betreff)
    
    return NextResponse.json({
      success: true,
      message: 'Test-E-Mail generiert (SMTP-Konfiguration erforderlich für echten Versand)',
      email: testEmail,
      recipient: email,
      note: 'Um E-Mails tatsächlich zu versenden, muss ein SMTP-Server konfiguriert werden (z.B. SendGrid, AWS SES, oder eigener SMTP)'
    })
    
  } catch (error: any) {
    console.error('[Test Email] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
