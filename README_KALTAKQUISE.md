# 🚀 SCORE Kaltakquise-System

## Vollautomatisierte B2B Lead-Generierung & E-Mail-Kampagnen

### 📋 Übersicht

Dieses System automatisiert den kompletten Kaltakquise-Prozess für SCORE Schleifwerkzeuge:

1. **DACH-Crawler** - Findet B2B-Firmen in Deutschland, Österreich, Schweiz
2. **Deep-Analysis** - Analysiert Firmen mit KI (Werkstoffe, Kontakte, Produkte)
3. **E-Mail-Generator** - Erstellt personalisierte B2B-Anschreiben
4. **Autopilot** - Vollautomatischer Betrieb mit Daily-Limit

---

## 🎯 Features

### 1. DACH-Crawler
- ✅ Systematische Suche in DE/AT/CH
- ✅ 36 Branchen (Metallbau, Schreinerei, Maschinenbau, etc.)
- ✅ 50+ Regionen (alle deutschen Großstädte)
- ✅ **Intelligenter Filter** - Keine Schulen, Plattformen, Verzeichnisse
- ✅ Blacklist für unerwünschte Domains
- ✅ Validierung (Website muss existieren)
- ✅ Progress-Tracking (Region+Branche Kombinationen)

### 2. Deep-Analysis (KI-gestützt)
- ✅ **Werkstoffe** - Stahl, Edelstahl, Aluminium, Holz, etc.
- ✅ **Werkstücke** - Was wird produziert?
- ✅ **Anwendungen** - Schweißen, Schleifen, Polieren, etc.
- ✅ **Kontaktpersonen** - Name, Position, E-Mail, Telefon
- ✅ **Produktempfehlungen** - Passende SCORE-Produkte (Schleifbänder, Trennscheiben, etc.)
- ✅ **Firmenprofil** - Kurze Zusammenfassung
- ✅ **Qualitäts-Score** - 0-100% basierend auf Vollständigkeit

### 3. E-Mail-Generator (LLM-basiert)
- ✅ Personalisierte Ansprache (Herr/Frau Nachname)
- ✅ Bezug zu Branche & Werkstoffen
- ✅ Erwähnung konkreter Anwendungen
- ✅ Passgenaue Produktempfehlungen
- ✅ Call-to-Action (Jahresbedarf senden / Beratungsgespräch)
- ✅ Link zur B2B-Seite
- ✅ Professioneller Ton

### 4. E-Mail-Versand
- ✅ SMTP-Integration (mail.agenturserver.de)
- ✅ Absender: daniel@score-schleifwerkzeuge.de
- ✅ Reply-To: keyaccount@score-schleifwerkzeuge.de
- ✅ **BCC automatisch** an danki.leismann@gmx.de
- ✅ Fehlerbehandlung

### 5. Autopilot
- ✅ Vollautomatischer Betrieb (60s Takt)
- ✅ Daily Limit (z.B. 10 E-Mails/Tag)
- ✅ Rotation durch alle Branchen & Regionen
- ✅ Status-Tracking (idle/searching/analyzing/sending)
- ✅ Fehler-Logging
- ✅ Automatische Tages-Reset

---

## 🏗️ Architektur

### Backend (Next.js API Routes)
```
/app/app/api/coldleads/
├── dach/crawl/          → DACH-Crawler
├── analyze-deep/        → Deep-Analysis
├── generate-email/      → E-Mail-Generator & Versand
├── autopilot/
│   ├── start/           → Autopilot starten
│   ├── stop/            → Autopilot stoppen
│   ├── status/          → Status abfragen
│   └── tick/            → Verarbeitung (alle 60s)
└── ...
```

### Services
```
/app/app/services/coldleads/
├── dach-crawler.ts      → Crawler-Logik
├── score-analyzer.ts    → KI-Analyse
├── email-generator.ts   → E-Mail-Generierung
└── search-strategy.ts   → Rotations-Logik
```

### Frontend (React)
```
/app/app/page.js
- Kaltakquise-Sektion
- DACH-Crawler UI
- Firmen-Tabelle
- Detail-Ansicht
- E-Mail-Vorschau-Modal
- Autopilot-Steuerung
```

---

## 🚀 Quick Start

### 1. Manuelle Nutzung

```bash
# 1. Öffne App
http://localhost:3000/#coldleads

# 2. DACH-Crawler starten
- Land: Deutschland
- Region: Bayern
- Branche: Metallbau
- Limit: 5
→ Klick "Start Crawl"

# 3. Firma analysieren
→ Klick "Analysieren" Button
→ Warten (10-20 Sekunden)

# 4. E-Mail generieren & versenden
→ Details öffnen (Pfeil-Button)
→ "E-Mail generieren"
→ "Jetzt versenden (mit BCC)"
```

### 2. Autopilot

```bash
# 1. Daily Limit setzen
Autopilot-Box → Limit: 10

# 2. Starten
→ Klick "Autopilot starten"

# 3. Beobachten
Status: AKTIV (grün)
Phase: searching/analyzing/sending
Heute: 0/10 → 1/10 → 2/10 ...

# 4. Stoppen
→ Klick "Autopilot stoppen"
```

---

## 📊 Statistiken

### DACH-Crawler Stats
- **Kombinationen** - Gesamt Region×Branche Jobs
- **Abgeschlossen** - Vollständig durchsucht
- **Firmen gefunden** - Alle Crawls
- **In Datenbank** - Bereit für Kontakt

### Zuordnungs-Stats
- **Zugeordnet** - Firmen mit E-Mail-Adresse
- **Nicht zugeordnet** - Keine E-Mail gefunden

---

## 🔧 Konfiguration

### Umgebungsvariablen (.env)

```bash
# SMTP (E-Mail-Versand)
SMTP_HOST=mail.agenturserver.de
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=daniel@score-schleifwerkzeuge.de
SMTP_PASSWORD=***
SMTP_FROM=daniel@score-schleifwerkzeuge.de
SMTP_FROM_NAME=Daniel Leismann - Score Schleifwerkzeuge
SMTP_REPLY_TO=keyaccount@score-schleifwerkzeuge.de
SMTP_BCC=danki.leismann@gmx.de  # BCC für alle E-Mails

# MongoDB
MONGO_URL=mongodb://localhost:27017/score_zentrale

# Next.js
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Autopilot Konfiguration

**Daily Limit anpassen:**
```javascript
// In Frontend: Autopilot-Box → Limit-Feld
// Oder in API:
POST /api/coldleads/autopilot/start
{ "dailyLimit": 50 }
```

**Branchen & Regionen anpassen:**
```typescript
// /app/services/coldleads/search-strategy.ts
export const TARGET_INDUSTRIES = [
  'Metallbau',
  'Stahlbau',
  // ... weitere hinzufügen
]

export const TARGET_REGIONS = [
  'München',
  'Berlin',
  // ... weitere hinzufügen
]
```

---

## 📈 Performance

### Durchsatz
- **DACH-Crawler:** 5 Firmen in ~5-10 Sekunden
- **Deep-Analysis:** 1 Firma in ~10-20 Sekunden
- **E-Mail-Generator:** 1 E-Mail in ~5-10 Sekunden
- **E-Mail-Versand:** Sofort (SMTP)

### Autopilot (bei 10 E-Mails/Tag)
- **Tick-Rate:** 60 Sekunden
- **Laufzeit:** ~10 Minuten für 10 E-Mails
- **Täglicher Durchsatz:** 10 E-Mails (konfigurierbar)

---

## 🐛 Troubleshooting

### Problem: Keine E-Mail-Adresse gefunden
**Lösung:** Das ist normal. Nicht alle Firmen haben E-Mails auf der Website. Filter nutzen:
```javascript
// Status: "Analysiert" → Nur Firmen mit erfolgreicher Analyse
// Manuell prüfen ob Kontakt vorhanden
```

### Problem: E-Mail-Versand fehlgeschlagen
**Lösung:** SMTP-Credentials prüfen:
```bash
# .env prüfen
cat /app/.env | grep SMTP

# Logs checken
tail -f /var/log/supervisor/nextjs.out.log | grep "[Emailer]"
```

### Problem: Autopilot sendet nicht
**Lösung:** Status prüfen:
```bash
# API direkt aufrufen
curl http://localhost:3000/api/coldleads/autopilot/status | jq

# Phase checken:
# - idle: Wartet
# - searching: Sucht Firmen
# - error: Fehler aufgetreten
```

### Problem: Analyse-Qualität zu niedrig
**Lösung:** Das ist normal bei schlechten Websites. Filter nutzen:
```javascript
// Qualitäts-Badge beachten:
// Grün: ≥70% → Gut
// Gelb: ≥50% → OK
// Grau: <50% → Schlecht (nicht verwenden)
```

---

## 🔐 Sicherheit

### SMTP-Credentials
- ✅ Nur in .env gespeichert (nicht in Git)
- ✅ Server-seitig verwendet
- ✅ Nicht im Frontend sichtbar

### E-Mail-Versand
- ✅ BCC automatisch an Test-Adresse
- ✅ Reply-To auf key-account@ gesetzt
- ✅ STARTTLS Verschlüsselung

### API-Sicherheit
- ⚠️ TODO: API-Keys für externe Zugriffe
- ⚠️ TODO: Rate-Limiting implementieren

---

## 📝 Changelog

### Version 1.0 (18.11.2024)
- ✅ DACH-Crawler mit intelligenten Filtern
- ✅ Deep-Analysis mit KI (GPT-4o-mini)
- ✅ E-Mail-Generator mit Personalisierung
- ✅ E-Mail-Versand mit BCC
- ✅ Autopilot mit Daily-Limit
- ✅ Frontend-Integration
- ✅ FIBU-Modul: 100% Auto-Zuordnung (Amazon, PayPal)

---

## 📚 Weitere Dokumentation

- **ÜBERGABE.md** - Detaillierte Übergabe-Dokumentation
- **API.md** - API-Referenz
- **FIBU_RELEASE_NOTES.md** - FIBU-Änderungen

---

## 👥 Team

**Entwickelt für:** SCORE Schleifwerkzeuge  
**Kontakt:** danki.leismann@gmx.de  
**Datum:** November 2024

---

## 📄 Lizenz

Proprietär - SCORE Schleifwerkzeuge  
Alle Rechte vorbehalten.
