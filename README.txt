=============================================================================
SCORE SCHLEIFWERKZEUGE - KALTAKQUISE AUTOPILOT SYSTEM
=============================================================================

VERSION: 2.0
LETZTES UPDATE: 19. November 2025
ENTWICKLER: Emergent AI

=============================================================================
1. ÜBERBLICK
=============================================================================

Das Kaltakquise Autopilot System ist eine vollautomatische B2B Lead-Generierungs-
und Outreach-Plattform für Score Schleifwerkzeuge.

HAUPTFUNKTIONEN:

  • Automatisches Finden von B2B-Prospects im DACH-Raum
  • KI-gestützte Website-Analyse und Lead-Scoring
  • Personalisierte E-Mail-Generierung mit ChatGPT
  • Automatischer E-Mail-Versand mit Follow-up-Sequenzen
  • Mail-Prompt-Management für A/B-Testing
  • Conversation-Rate-Tracking

=============================================================================
2. SYSTEM-ARCHITEKTUR
=============================================================================

TECHNOLOGIE-STACK:

  Frontend:        Next.js 14 (React, TypeScript)
  Backend:         Next.js API Routes (TypeScript)
  Datenbank:       MongoDB
  KI/LLM:          OpenAI GPT-4o-mini
  E-Mail:          Nodemailer (SMTP)
  Crawler:         Google Custom Search API

WICHTIGE KOMPONENTEN:

  /app/app/api/coldleads/
    ├── autopilot/
    │   ├── start/route.ts      - Autopilot starten
    │   ├── stop/route.ts       - Autopilot stoppen
    │   ├── tick/route.ts       - Hauptlogik (Crawl → Analyze → Email)
    │   └── status/route.ts     - Status abfragen
    ├── dach/crawl/route.ts     - DACH-Firmen suchen
    ├── analyze-deep/route.ts   - Website-Analyse mit KI
    ├── email-v3/send/route.ts  - E-Mail versenden
    └── prompts/route.ts        - Mail-Prompt-Verwaltung

  /app/services/coldleads/
    ├── dach-crawler.ts         - Google Search Integration
    ├── score-analyzer.ts       - Website-Crawling & Analyse
    ├── emailer-v3.ts           - E-Mail-Generierung
    └── search-strategy.ts      - Suchstrategie (Regionen, Branchen)

  /app/lib/
    ├── email-client.ts         - SMTP E-Mail-Versand
    ├── emergent-llm.ts         - OpenAI API Integration
    └── mongodb.ts              - MongoDB Connection

=============================================================================
3. AUTOPILOT-WORKFLOW
=============================================================================

Der Autopilot läuft vollautomatisch in dieser Reihenfolge:

SCHRITT 1: SUCHE ANALYSIERTE PROSPECTS
  → Durchsucht Datenbank nach bereits analysierten Prospects
  → Filtert nach gültigen E-Mail-Adressen
  → Überspringt bereits kontaktierte

SCHRITT 2: WENN KEINER GEFUNDEN → CRAWLE NEUE FIRMEN
  → Nutzt Google Custom Search API
  → Sucht nach Branchen in verschiedenen Regionen
  → Findet 5 neue Prospects pro Suchlauf
  → Speichert in Datenbank als "new"

SCHRITT 3: ANALYSIERE NEUE PROSPECTS
  → Crawlt Website-Content (Impressum, Kontakt, Homepage)
  → Extrahiert: Werkstoffe, Produkte, Anwendungen, Maschinen
  → Sucht E-Mail-Adressen
  → Erkennt Kontaktpersonen (wenn möglich)
  → Speichert als "analyzed"

SCHRITT 4: GENERIERE PERSONALISIERTE E-MAIL
  → Lädt aktiven Prompt aus Datenbank
  → Ersetzt Platzhalter mit Firmendaten
  → Ruft ChatGPT auf (gpt-4o-mini)
  → Generiert 3 E-Mails (Mail 1, Follow-up 1, Follow-up 2)
  → Speichert mit prompt_version für Tracking

SCHRITT 5: VERSENDE E-MAIL
  → Sendet an echten Empfänger (TO)
  → BCC an leismann@score-schleifwerkzeuge.de
  → Markiert Prospect als "contacted"
  → Plant Follow-ups (nach 5 und 10 Tagen)

SCHRITT 6: NÄCHSTER TICK
  → Zurück zu Schritt 1
  → Daily Limit beachten

=============================================================================
4. MAIL-PROMPT-SYSTEM
=============================================================================

Das System erlaubt A/B-Testing verschiedener E-Mail-Prompts.

FEATURES:

  • Mehrere Prompts parallel verwalten
  • Nur ein Prompt gleichzeitig aktiv
  • Conversion-Rate-Tracking pro Prompt
  • Einfaches Umschalten zwischen Prompts
  • Platzhalter-System für Personalisierung

VERFÜGBARE PLATZHALTER:

  {cleanedFirmenname}  - Bereinigter Firmenname
  {werkstoffe}         - Erkannte Werkstoffe (z.B. "Edelstahl, Aluminium")
  {werkstucke}         - Erkannte Produkte (z.B. "Geländer, Türen")
  {anwendungen}        - Erkannte Tätigkeiten (z.B. "Schweißen, Montage")
  {firmenname}         - Für Satzkonstruktionen

PROMPT-TRACKING:

  Jede versendete E-Mail speichert:
  • prompt_version (z.B. 1, 2, 3)
  • model (z.B. gpt-4o-mini)

  Statistiken pro Prompt:
  • Versendet: Anzahl versendeter E-Mails
  • Antworten: Anzahl erhaltener Antworten
  • Conversion Rate: (Antworten / Versendet) * 100

=============================================================================
5. E-MAIL-FORMAT
=============================================================================

JEDE E-MAIL ENTHÄLT:

1. ANREDE:
   - Personalisiert: "Hallo Herr Müller,"
   - Allgemein: "Guten Tag,"
   - Filter: "Herr Unbekannt" wird nicht verwendet

2. PERSONALISIERTER TEXT (120-180 Wörter):
   - Bezug auf Firma und deren Tätigkeiten
   - Bezug auf Werkstoffe (Edelstahl, Aluminium, etc.)
   - Bezug auf Produkte (Geländer, Türen, etc.)
   - Score's Angebot
   - Werkstoff-spezifische Produktempfehlungen

3. CALL-TO-ACTION:
   Einfach kurz antworten oder anrufen: 0221-25999901 (10–18 Uhr). 
   Ein paar Infos und auch ein Anfrageformular für Geschäftskunden 
   finden Sie auch unter https://score-schleifwerkzeuge.de/business.

4. PERSÖNLICHE SIGNATUR:
   Viele Grüße
   Daniel Leismann
   Score Schleifwerkzeuge
   📞 0221-25999901 (Mo-Fr 10-18 Uhr)
   📧 leismann@score-schleifwerkzeuge.de

5. RECHTLICHE SIGNATUR:
   Shop-Link + vollständiges Impressum
   Score Handels GmbH & Co. KG
   Alle rechtlichen Angaben

=============================================================================
6. DATENSCHUTZ & SICHERHEIT
=============================================================================

TEST-MODUS:

  Umgebungsvariable: EMAIL_TEST_MODE=true
  
  Wenn aktiviert:
  • E-Mails gehen NUR an BCC
  • Subject erhält [TEST]-Prefix
  • Gelber Banner in E-Mail
  • Kein echter Empfänger wird kontaktiert

LIVE-MODUS:

  Wenn EMAIL_TEST_MODE nicht gesetzt oder false:
  • E-Mails gehen an echte Empfänger
  • BCC an leismann@score-schleifwerkzeuge.de
  • Normaler Subject (kein [TEST])

DAILY LIMIT:

  • Standard: 50 E-Mails/Tag
  • Anpassbar über API
  • Verhindert Spam-Klassifizierung
  • Zähler wird täglich um Mitternacht zurückgesetzt

=============================================================================
7. DATENBANK-STRUKTUR
=============================================================================

COLLECTION: prospects

  {
    _id: ObjectId,
    company_name: String,
    website: String,                    // Normalisiert (nur Hauptdomain)
    website_original: String,           // Original-URL mit Pfad
    status: String,                     // 'new', 'analyzed', 'contacted'
    industry: String,
    region: String,
    country: String,
    source: String,
    
    analysis_v3: {
      company_info: {
        name: String,
        products: [String],
        services: [String]
      },
      contact_person: {
        name: String,
        role: String,
        email: String
      },
      materials: [{ term: String, evidence: String }],
      workpieces: [{ term: String, evidence: String }],
      applications: [{ term: String, evidence: String }],
      needs_assessment: {
        score: Number,
        potential_products: [String],
        reasoning: String
      }
    },
    
    email_sequence: {
      mail_1: {
        subject: String,
        body: String,
        word_count: Number,
        prompt_version: Number,
        model: String
      },
      mail_2: { ... },
      mail_3: { ... }
    },
    
    followup_schedule: {
      mail_1_sent: Boolean,
      mail_1_sent_at: Date,
      mail_2_scheduled: Date,
      mail_3_scheduled: Date
    },
    
    hasReply: Boolean,
    lastReplyAt: Date,
    autopilot_skip: Boolean,
    
    created_at: Date,
    updated_at: Date
  }

COLLECTION: email_prompts

  {
    _id: ObjectId,
    version: Number,                    // 1, 2, 3, ...
    name: String,                       // "Prompt 1 (Original)"
    model: String,                      // "gpt-4o-mini"
    prompt: String,                     // Vollständiger Prompt-Text
    active: Boolean,                    // Nur einer kann aktiv sein
    created_at: Date,
    updated_at: Date
  }

COLLECTION: autopilot_state

  {
    _id: ObjectId,
    id: String,                         // "kaltakquise"
    running: Boolean,
    currentPhase: String,               // 'crawling', 'analyzing', 'emailing'
    dailyLimit: Number,
    dailyCount: Number,
    lastReset: String,                  // ISO-Date
    totalProcessed: Number
  }

=============================================================================
8. API-ENDPUNKTE
=============================================================================

AUTOPILOT:

  POST /api/coldleads/autopilot/start
    Body: { dailyLimit: 50 }
    Response: { ok: true, message: "Autopilot gestartet..." }

  POST /api/coldleads/autopilot/stop
    Response: { ok: true, message: "Autopilot gestoppt" }

  POST /api/coldleads/autopilot/tick
    Response: { 
      ok: true, 
      action: "email_sent" | "crawling" | "analyzing" | "skip",
      prospect: { ... },
      dailyCount: Number,
      duration: Number
    }

  GET /api/coldleads/autopilot/status
    Response: { 
      ok: true, 
      state: { running, dailyLimit, dailyCount, ... }
    }

PROMPTS:

  GET /api/coldleads/prompts
    Response: { 
      ok: true, 
      prompts: [{
        version, name, model, prompt, active,
        stats: { versendet, antworten, conversionRate }
      }]
    }

  POST /api/coldleads/prompts
    Body: { action: "activate", version: 1 }
    Oder: { action: "create", name, model, prompt }

  PUT /api/coldleads/prompts
    Body: { version, name, model, prompt }

PROSPECTS:

  GET /api/coldleads/stats
    Response: { total, stats: { new, analyzed, contacted, replied } }

  GET /api/coldleads/search?status=all&limit=1000
    Response: { ok: true, prospects: [...] }

  POST /api/coldleads/analyze-deep
    Body: { website, firmenname, branche }

  POST /api/coldleads/email-v3/send
    Body: { prospect_id }

=============================================================================
9. UMGEBUNGSVARIABLEN
=============================================================================

ERFORDERLICH:

  MONGO_URL                - MongoDB Connection String
  OPENAI_API_KEY          - OpenAI API Key für GPT
  
  SMTP_HOST               - SMTP Server
  SMTP_PORT               - SMTP Port
  SMTP_USER               - SMTP Benutzername
  SMTP_PASS               - SMTP Passwort
  EMAIL_FROM              - Absender-Adresse

  GOOGLE_API_KEY          - Google Custom Search API Key
  GOOGLE_SEARCH_ENGINE_ID - Google Search Engine ID

OPTIONAL:

  EMAIL_TEST_MODE=true    - Test-Modus (E-Mails nur an BCC)
  EMERGENT_LLM_KEY        - Alternative zu OPENAI_API_KEY

=============================================================================
10. VERWENDUNG
=============================================================================

AUTOPILOT STARTEN:

  1. Öffnen Sie das Dashboard
  2. Gehen Sie zu "Outbound" → "Kaltakquise"
  3. Klicken Sie auf "Autopilot starten"
  4. Setzen Sie Daily Limit (z.B. 50)
  5. Der Autopilot läuft automatisch

MAIL PROMPTS VERWALTEN:

  1. Klicken Sie auf Tab "Mail Prompts"
  2. Sehen Sie alle Prompts mit Statistiken
  3. Bearbeiten: Klick auf Stift-Symbol
  4. Neuer Prompt: Klick auf "Neuer Prompt"
  5. Aktivieren: Klick auf Aktivieren-Button

STATISTIKEN VERFOLGEN:

  • Dashboard zeigt Live-Zahlen
  • Neu gefunden / Analysiert / Kontaktiert
  • Autopilot Status (AKTIV / INAKTIV)
  • Conversion Rates pro Prompt

=============================================================================
11. BESONDERHEITEN
=============================================================================

FIRMENNAMEN-BEREINIGUNG:

  Automatische Entfernung von:
  • "Impressum - "
  • "Kontakt - "
  • "Startseite | "
  • "UNTERNEHMEN: "
  Etc.

WEBSITE-NORMALISIERUNG:

  Alle URLs werden zu Hauptdomains normalisiert:
  • https://example.de/impressum/ → https://example.de
  • https://www.example.de/kontakt → https://www.example.de

DUPLIKAT-VERMEIDUNG:

  • Prospects werden per Website dedupliziert
  • Nur eine E-Mail pro Empfänger-Adresse
  • Status-Tracking verhindert Mehrfachversand

WERKSTOFF-SPEZIFISCHE EMPFEHLUNGEN:

  Das System empfiehlt automatisch die richtigen Produkte:
  • Edelstahl → Fächerscheiben, INOX-Trennscheiben
  • Aluminium → Anti-Clog-Scheiben, Alu-Trennscheiben
  • Stahl → Trennscheiben, Schruppscheiben

=============================================================================
12. WARTUNG & SCRIPTS
=============================================================================

NÜTZLICHE SCRIPTS:

  node /app/scripts/clean-company-names.js
    → Bereinigt Firmennamen in Datenbank

  node /app/scripts/fix-duplicate-prospects.js
    → Normalisiert URLs und entfernt Duplikate

  node /app/scripts/init-prompt-1.js
    → Initialisiert Prompt 1 in Datenbank

SERVICE-BEFEHLE:

  sudo supervisorctl restart nextjs
    → Neustart nach .env-Änderungen

  sudo supervisorctl status
    → Status aller Services

LOGS PRÜFEN:

  tail -f /var/log/supervisor/nextjs.out.log
    → Live-Logs ansehen

  tail -n 200 /var/log/supervisor/nextjs.out.log | grep "Email"
    → E-Mail-Versand-Logs

=============================================================================
13. TROUBLESHOOTING
=============================================================================

PROBLEM: Autopilot sendet keine E-Mails

  Prüfen:
  1. Ist Autopilot aktiv? (GET /api/coldleads/autopilot/status)
  2. Gibt es analysierte Prospects mit E-Mail?
  3. Ist Daily Limit erreicht?
  4. SMTP-Konfiguration korrekt?

PROBLEM: E-Mails haben falsche Subjects

  Prüfen:
  1. Firmennamen-Bereinigung laufen lassen
  2. Script: node /app/scripts/clean-company-names.js

PROBLEM: ChatGPT-API funktioniert nicht

  Prüfen:
  1. OPENAI_API_KEY in .env gesetzt?
  2. API-Key gültig?
  3. Fallback-Template wird automatisch verwendet

PROBLEM: Duplikate in Datenbank

  Lösung:
  node /app/scripts/fix-duplicate-prospects.js

=============================================================================
14. SUPPORT & KONTAKT
=============================================================================

DOKUMENTATION:
  • README.txt (diese Datei)
  • SETUP.txt (Installation & Konfiguration)
  • API.txt (Detaillierte API-Dokumentation)
  • AUTOPILOT.txt (Autopilot-Details)
  • MAIL_PROMPTS.txt (Prompt-Management)

ENTWICKLER:
  Emergent AI
  https://emergentagent.com

PROJEKT:
  Score Schleifwerkzeuge - Kaltakquise Autopilot
  Version 2.0 - November 2025

=============================================================================