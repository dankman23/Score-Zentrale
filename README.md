# SCORE Zentrale - Umfassendes Business Management System

## 🎯 Überblick

SCORE Zentrale ist eine vollständige Business-Management-Plattform mit Fokus auf:
- **FIBU (Finanzbuchhaltung)** - Automatisierte Buchhaltung mit KI-gestütztem PDF-Parsing
- **Sales Management** - Verkaufsanalysen und Reporting
- **Marketing Tools** - Kampagnen und Analytics
- **Outbound** - Kaltakquise, Warmakquise, Prospect Management
- **Produktverwaltung** - Schleifwerkzeuge-Katalog
- **Preismanagement** - Dynamische Preisgestaltung

## 🚀 Features

### FIBU-Modul (Hauptfeature)

**Automatische Rechnungsverarbeitung:**
- 🤖 **Hybrid PDF-Parsing**: Python-Skripte + Google Gemini AI
- 📊 **2.691 VK-Rechnungen** verwaltet
- 💶 **194 EK-Rechnungen** mit automatischer Kreditor-Zuordnung
- 🏦 **Bank-Import** für CSV-Dateien (Postbank, Commerzbank)

**Intelligente Zuordnungssysteme:**
- **Debitor-Sammelkonten** (69xxx) nach Zahlungsart
- **IGL-Ausnahme** für EU-Kunden mit USt-ID (10xxx)
- **Kreditor-Zuordnung** mit Bulk-Edit
- **Auto-Matching** von Zahlungen zu Rechnungen

**Export & Compliance:**
- ✅ 10it-Format Export für Tennet
- ✅ Separate VK/EK Exports
- ✅ Vollständiger Kontenplan (SKR03-ähnlich)
- ✅ USt-ID Verwaltung für IGL-Geschäfte

### Weitere Module

- **Sales Dashboard** - KPIs, Umsatzanalysen, Top-Produkte
- **Marketing** - Kampagnen-Tracking, ROI-Analysen
- **Outbound** - CRM mit Kalt-/Warmakquise
- **Glossar** - Produktwissen-Datenbank
- **Produkte** - Schleifmittel-Katalog mit Spezifikationen
- **Preise** - Preislisten-Management

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS** + **Bootstrap 4.6**
- **Shadcn/ui** Components

### Backend
- **Next.js API Routes** (Node.js)
- **MongoDB** (Hauptdatenbank)
- **MS SQL Server** (JTL-Integration)
- **Python 3** (PDF-Parsing, Gemini AI)

### AI & Automation
- **Google Gemini 2.0 Flash** (via Emergent LLM Key)
- **Emergent Integrations** Library
- Custom Python Parser (Klingspor, Starcke, VSM, etc.)

## 📦 Installation

### Voraussetzungen
```bash
# System
Node.js 20+
Yarn
MongoDB 7+
Python 3.10+
MS SQL Server (für JTL-Integration)
```

### Setup

```bash
# 1. Repository klonen
git clone <your-fork-url>
cd app

# 2. Dependencies installieren
yarn install
pip3 install -r requirements.txt

# 3. Environment Variables
cp .env.example .env
# Bearbeite .env mit deinen Credentials

# 4. MongoDB Setup
# MongoDB muss auf localhost:27017 laufen
# Database: score_zentrale

# 5. FIBU Setup (Optional)
node scripts/setup-debitor-sammelkonten.js
node scripts/apply-debitor-regeln.js

# 6. Development Server starten
yarn dev
```

## 🔑 Environment Variables

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017

# MS SQL (JTL)
MSSQL_SERVER=your-server.com
MSSQL_DATABASE=eazybusiness
MSSQL_USER=your-user
MSSQL_PASSWORD=your-password
MSSQL_ENCRYPT=true

# Emergent LLM (für Gemini AI)
EMERGENT_LLM_KEY=sk-emergent-xxxxx

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 📚 Dokumentation

Vollständige Dokumentation im `/docs` Verzeichnis:

- **[INDEX.md](docs/INDEX.md)** - Übersicht aller Docs
- **[FIBU_README.md](docs/FIBU_README.md)** - FIBU-Modul Anleitung
- **[API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** - API Reference
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System-Architektur
- **[QUICKSTART.md](docs/QUICKSTART.md)** - Schnellstart-Guide

## 🚦 Wichtige Scripts

### FIBU-Related
```bash
# Datenqualitäts-Check
node scripts/fibu-datenqualitaet-check.js

# Debitor-Sammelkonten einrichten
node scripts/setup-debitor-sammelkonten.js

# Debitor-Regeln anwenden
node scripts/apply-debitor-regeln.js

# Auto-Matching Kreditoren
node scripts/auto-match-kreditoren.js

# Smart Suggestions
node scripts/kreditor-smart-suggestions.js

# Batch-Processing mit Gemini
node scripts/batch-process-with-gemini-fallback.js
```

## 🏗️ Projektstruktur

```
/app
├── app/
│   ├── api/              # Next.js API Routes
│   │   └── fibu/         # FIBU APIs
│   ├── fibu/             # FIBU Dashboard Page
│   └── layout.js         # Root Layout mit Navigation
├── components/
│   ├── FibuCompleteDashboard.js  # Haupt-FIBU Dashboard
│   ├── VKRechnungenView.js       # VK-Rechnungen mit Filter
│   ├── KreditorZuordnung.js      # Bulk-Kreditor-Zuordnung
│   ├── KontenplanView.js         # Kontenplan-Ansicht
│   └── ui/                       # Shadcn Components
├── lib/
│   └── db/
│       ├── mongodb.ts    # MongoDB Connection
│       └── mssql.ts      # MS SQL Connection
├── python_libs/
│   ├── emergent_gemini_parser.py  # Gemini AI Parser
│   ├── fibu_invoice_parser.py     # Python Parser Wrapper
│   └── invoice_parsers/           # Supplier-spezifische Parser
├── scripts/              # Automation & Setup Scripts
└── docs/                 # Dokumentation
```

## 🔐 Sicherheit

- **Environment Variables** niemals committen
- **API Keys** nur in `.env` speichern
- **MongoDB** sollte authentifiziert sein (in Production)
- **MSSQL** mit Encryption (encrypt=true)

## 🤝 Contributing

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Changes committen (`git commit -m 'Add AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request öffnen

## 📝 Lizenz

Proprietary - Score Schleifwerkzeuge

## 🆘 Support

Bei Fragen oder Problemen:
- Siehe [QUICKSTART.md](docs/QUICKSTART.md)
- Siehe [FIBU_README.md](docs/FIBU_README.md)

## 🎓 Wichtige Konzepte

### FIBU-Debitor-System

**Regel 1: Sammelkonten (Standard)**
- Alle Normal-Kunden → Sammelkonto nach Zahlungsart (69xxx)
- Beispiel: PayPal → 69012, Kreditkarte → 69008

**Regel 2: IGL-Ausnahme**
- EU-Kunden + USt-ID + MwSt=0% → Eigener Debitor (10xxx)
- Grund: USt-ID muss hinterlegt werden (steuerliche Pflicht)

### Hybrid PDF-Parsing

**Tier 1: Python-Parser** (für bekannte Lieferanten)
- Klingspor, Starcke, VSM, Pferd, etc.
- Regel-basiert, schnell, zuverlässig

**Tier 2: Gemini AI** (Fallback)
- Für unbekannte/neue Lieferanten
- KI-gestützt, flexibel
- Nutzt Emergent LLM Key

## 🌟 Status

✅ Production Ready
✅ 2.691 VK-Rechnungen verwaltet
✅ 194 EK-Rechnungen mit Kreditor-Zuordnung
✅ 127 Kreditoren angelegt
✅ Datenqualität: 78/100 (GUT)

---

**Made with ❤️ for Score Schleifwerkzeuge**
