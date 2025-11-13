# Score Zentrale - Internes ERP & FIBU System

## 📋 Projektübersicht

**Score Zentrale** ist ein maßgeschneidertes ERP-System mit integriertem FIBU-Modul (Finanzbuchhaltung) für Score Schleifwerkzeuge. Das System wurde entwickelt, um Buchhaltungsprozesse zu automatisieren und eine vollständige Übersicht über alle finanziellen Transaktionen zu bieten – ähnlich wie Lexoffice, aber speziell angepasst an die Unternehmensanforderungen.

## 🎯 Hauptziele

- **Automatisierte Rechnungsverarbeitung**: KI-gestützte Extraktion von Lieferantenrechnungen aus PDFs
- **Zentrale Buchhaltungs-Übersicht**: Alle Eingangs- und Ausgangsrechnungen, Zahlungen und Gutschriften an einem Ort
- **Kreditor- & Debitor-Verwaltung**: Automatische Zuordnung nach Geschäftsregeln
- **Export-Funktionalität**: Nahtloser Export für externe Buchhaltungssysteme (10it-Format)
- **Bank-Integration**: Automatischer Import von Postbank-Kontoauszügen

## 🏗️ Technologie-Stack

- **Frontend**: Next.js 14 (App Router), React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes (TypeScript)
- **Datenbanken**: 
  - MongoDB (Geschäftsdaten, FIBU)
  - MSSQL (JTL-Warenwirtschaft, read-only)
- **AI/ML**: Gemini 2.0 Flash (via emergentintegrations)
- **Python**: Invoice Parsing Scripts

## 📁 Projekt-Struktur

```
/app
├── app/                          # Next.js App Directory
│   ├── api/fibu/                # FIBU API Routes
│   ├── fibu/                    # FIBU Frontend Pages
│   └── page.js                  # Main SPA Entry Point
├── components/                   # React Components
│   ├── FibuCompleteDashboard.js # Haupt-Dashboard
│   ├── KreditorZuordnung.js     # Kreditor-Zuordnung
│   ├── VKRechnungenView.js      # VK-Rechnungen Ansicht
│   ├── KontenplanView.js        # Kontenplan
│   └── BankImport.js            # Bank CSV Import
├── python_libs/                  # Python Parsing Scripts
│   └── emergent_gemini_parser.py # Gemini AI Parser
├── scripts/                      # Utility Scripts
│   ├── auto-match-kreditoren.js # Automatische Kreditor-Zuordnung
│   ├── apply-debitor-regeln.js  # Debitor-Zuordnung
│   └── reparse-invoices.js      # Re-Parsing nach Parser-Fixes
└── docs/                         # Dokumentation
```

## 🚀 Quick Start

Für detaillierte Setup-Anweisungen siehe [SETUP.md](./SETUP.md)

```bash
# Dependencies installieren
cd /app/app
yarn install

# Python-Dependencies
pip install -r /app/requirements.txt

# Services starten
sudo supervisorctl restart all

# App öffnen
# → http://localhost:3000
```

## 📚 Dokumentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technische Architektur und Datenflüsse
- **[FIBU_README.md](./FIBU_README.md)** - Detaillierte FIBU-Modul Dokumentation
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Alle API-Endpunkte mit Beispielen
- **[SETUP.md](./SETUP.md)** - Installation und Konfiguration
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Häufige Probleme und Lösungen
- **[PENDING_TASKS.md](./PENDING_TASKS.md)** - Offene Aufgaben und TODOs

## 🔑 Hauptfunktionalitäten

### 1. FIBU-Dashboard (`/fibu`)
- **Übersicht**: KPIs für EK/VK-Rechnungen, Zahlungen, offene Posten
- **EK-Rechnungen**: Lieferantenrechnungen mit Kreditor-Zuordnung
- **VK-Rechnungen**: Verkaufsrechnungen aus JTL + externe Quellen (Amazon)
- **Zahlungen**: Alle Zahlungsbewegungen nach Anbieter
- **Bank-Import**: CSV-Upload für Postbank-Kontoauszüge
- **Kontenplan**: Vollständiger SKR03-ähnlicher Kontenrahmen
- **Export**: Datenexport für externe Buchhaltungssoftware

### 2. Automatisierte Rechnungsverarbeitung

#### Hybrid-Parsing-System:
1. **Regelbasierte Parser** (Python): Für bekannte Lieferanten (schnell, präzise)
2. **Gemini AI Fallback**: Für unbekannte/neue Lieferanten (flexibel, robust)

#### Workflow:
```
PDF Rechnung → Email-Postfach → Parser-Erkennung → Datenextraktion → 
Kreditor-Zuordnung → MongoDB-Speicherung → Dashboard-Anzeige
```

### 3. Debitor-Logik (Sammelkonten)

**IGL-Kunden** (EU + USt-ID):
- Erhalten eigenen Debitor (10000-19999)
- USt-ID wird hinterlegt
- Wichtig für innergemeinschaftliche Lieferungen

**Standard-Kunden**:
- Werden in Sammelkonten gruppiert (69000-69999)
- Zuordnung nach Zahlungsart (PayPal, Amazon, Rechnung, etc.)
- Vereinfacht die Buchhaltung

### 4. Datenexport

- **Format**: CSV (10it-kompatibel)
- **Inhalte**: VK-Rechnungen, EK-Rechnungen, Zahlungen, Gutschriften
- **Filterung**: Nach Zeitraum und Typ

## 🔧 Konfiguration

### Umgebungsvariablen (`.env`)

```bash
# MongoDB
MONGO_URL=mongodb://localhost:27017

# MSSQL (JTL)
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=***
DB_NAME=eazybusiness

# AI Parsing
EMERGENT_LLM_KEY=***

# App URL
NEXT_PUBLIC_BASE_URL=https://ihre-domain.com
```

## 📊 Datenbank-Schema

### MongoDB Collections:

- `fibu_ek_rechnungen` - Eingangsrechnungen (Lieferanten)
- `fibu_vk_rechnungen` - Verkaufsrechnungen (JTL + manuell)
- `fibu_externe_rechnungen` - Externe Rechnungen (Amazon XRE)
- `fibu_zahlungen` - Zahlungsbewegungen
- `fibu_gutschriften` - Gutschriften
- `kreditoren` - Kreditorenstammdaten (70000-79999)
- `fibu_igl_debitoren` - IGL-Debitoren mit USt-ID
- `fibu_debitor_regeln` - Debitor-Zuordnungsregeln
- `kontenplan` - Vollständiger Kontenrahmen

### MSSQL (JTL) - Read-Only:

- `tRechnung` - Verkaufsrechnungen
- `tZahlungseingang` - Zahlungseingänge
- `tKunde` - Kundenstammdaten

## 🐛 Bekannte Probleme & Fixes

### ✅ GELÖST: Gemini Parser identifiziert Score als Lieferant

**Problem**: Der AI-Parser hat "Score Schleifwerkzeuge" (eigene Firma) als Lieferant erkannt bei 99 Rechnungen.

**Fix**: 
- Prompt wurde erweitert mit expliziter Anweisung
- 99 Rechnungen wurden erfolgreich neu geparst
- Script: `/app/scripts/reparse-invoices.js`

### ⏳ OFFEN: Performance-Optimierung

**Problem**: `/api/fibu/uebersicht/complete` ist langsam (5-15 Sek.)

**Grund**: Endpoint macht mehrere interne API-Calls statt direkter DB-Queries

**Lösung**: Refactoring auf direkte MongoDB/MSSQL Queries

### ⏳ OFFEN: Pferd-Parser

**Problem**: Parser für "August Rüggeberg" (Pferd) wirft Fehler

**Status**: Noch nicht gefixt

## 🤝 Entwickler-Hinweise

### Scripts ausführen:

```bash
# Debitor-Regeln anwenden
node /app/scripts/apply-debitor-regeln.js

# Rechnungen neu parsen
node /app/scripts/reparse-invoices.js

# Kreditoren auto-matchen
node /app/scripts/auto-match-kreditoren.js
```

### API Testen:

```bash
# FIBU Übersicht
curl http://localhost:3000/api/fibu/uebersicht/complete?from=2025-10-01&to=2025-11-30

# EK-Rechnungen
curl http://localhost:3000/api/fibu/rechnungen/ek?limit=100

# Kreditoren
curl http://localhost:3000/api/fibu/kreditoren
```

## 📝 Lizenz

Internes Projekt - Score Schleifwerkzeuge GmbH

## 📞 Support

Bei Fragen oder Problemen:
1. Siehe [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Prüfe Logs: `/var/log/supervisor/nextjs.out.log`
3. Kontaktiere den Entwickler

---

**Letzte Aktualisierung**: Januar 2025
**Version**: 1.0.0
**Status**: Produktiv