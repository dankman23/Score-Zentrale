# FIBU-Accounting-Hub - Finanzbuchhaltungs-System

## 🎯 Projektbeschreibung

Das FIBU-Accounting-Hub ist ein maßgeschneidertes Finanzbuchhaltungs-System, das speziell für die Integration mit JTL-Wawi entwickelt wurde. Es vereint Daten aus verschiedenen Quellen (JTL-MSSQL, externe APIs, CSV-Importe) und bietet eine zentrale Plattform für:

- **Kontenplan-Verwaltung** (SKR04-basiert, 137 Konten)
- **Zahlungsmanagement** mit automatischer Zuordnung
- **Externe Rechnungen** (Amazon, eBay, Otto.de)
- **Bank-Import** (Postbank CSV, Commerzbank)
- **Kreditoren-/Debitorenverwaltung**

## 🚀 Quick Start

### Voraussetzungen

- Node.js 20.x
- MongoDB (läuft bereits in Docker)
- MSSQL Server (JTL-Datenbank)
- Yarn Package Manager

### Installation

```bash
# Dependencies installieren
cd /app
yarn install

# Environment-Variablen prüfen
cat .env

# Development starten
yarn dev

# Oder via Supervisor (Production)
sudo supervisorctl restart nextjs
```

### Zugriff

- **Frontend:** http://localhost:3000
- **FIBU-Modul:** http://localhost:3000/fibu

## 📁 Projekt-Struktur

```
/app/
├── app/                          # Next.js App Directory
│   ├── api/                      # API Routes
│   │   ├── fibu/                 # FIBU-spezifische APIs
│   │   │   ├── kontenplan/       # Kontenplan-Management
│   │   │   ├── zahlungen/        # Zahlungsmodul
│   │   │   │   └── amazon-settlements/  # Amazon Settlement Reports
│   │   │   ├── rechnungen/       # Rechnungsmanagement
│   │   │   └── kreditoren/       # Kreditorenverwaltung
│   │   └── jtl/                  # JTL-Datenbank-Zugriff
│   ├── fibu/                     # FIBU Frontend-Seiten
│   │   └── page.js               # Haupt-Dashboard
│   └── layout.js                 # Root Layout
├── components/                   # React-Komponenten
│   ├── FibuCompleteDashboard.js  # Haupt-Dashboard
│   ├── KontenplanView.js         # Kontenplan & Stammdaten
│   ├── ZahlungenView.js          # Zahlungsübersicht
│   ├── KreditorenManagement.js   # Kreditoren-UI
│   └── ZahlungsEinstellungen.js  # Zahlungskonto-Mappings
├── lib/                          # Utilities & Helper
│   └── db/                       # Datenbank-Verbindungen
│       ├── mongodb.ts            # MongoDB Client
│       └── mssql.ts              # MSSQL Client (JTL)
├── scripts/                      # Maintenance-Scripts
│   ├── import-kontenplan-skr04.js  # Kontenplan-Import
│   └── check-kontenplan.js       # Kontenplan-Validierung
└── docs/                         # Dokumentation
    ├── ARCHITECTURE.md           # System-Architektur
    ├── EXTERNE_RECHNUNGEN.md     # Externe Rechnungen
    ├── BANK_IMPORT.md            # Bank-Import-Prozess
    ├── KONTENPLAN.md             # Kontenplan-Details
    └── DEVELOPER_GUIDE.md        # Entwickler-Leitfaden
```

## 🔧 Technologie-Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- **Shadcn/ui** Komponenten

### Backend
- **Next.js API Routes** (Server-side)
- **MongoDB** (Finanzdaten, Cache)
- **MSSQL** (JTL-Wawi Datenbank)

### Externe Integrationen
- **Amazon Settlements** (aus JTL `pf_amazon_settlement`)
- **eBay Finances API** (in Vorbereitung)
- **PayPal Transaction Search API** (in Vorbereitung)
- **Postbank CSV Import**

## 🗄️ Datenbank-Schema

### MongoDB Collections

#### `fibu_kontenplan`
```javascript
{
  kontonummer: "1801",      // 4-stellig, SKR04
  bezeichnung: "PayPal",
  kontenklasse: 1,          // 0-9
  kontengruppe: "18",       // 2-stellig
  kontenuntergruppe: "180", // 3-stellig
  kontenklasseTyp: "aktiv", // aktiv/passiv/ertrag/aufwand
  istSystemkonto: true,
  istAktiv: true
}
```

#### `fibu_kreditoren`
```javascript
{
  kreditorId: "KR-12345",
  name: "Shopware AG",
  email: "[email protected]",
  jtlLieferantId: 123,
  kontonummer: "70001",     // Zugewiesenes Kreditorenkonto
  status: "aktiv"
}
```

#### `fibu_bank_transaktionen`
```javascript
{
  datum: ISODate("2025-10-15"),
  betrag: 1234.56,
  auftraggeber: "Kunde GmbH",
  verwendungszweck: "RE2025-12345",
  quelle: "postbank",
  buchungstext: "SEPA-Überweisung",
  matchedRechnungNr: "RE2025-12345",  // Nach Zuordnung
  zugeordnetesKonto: "6850",          // Oder Buchungskonto
  zuordnungsArt: "rechnung"            // oder "konto"
}
```

### MSSQL (JTL) - Wichtigste Tabellen

- `tZahlung` - Zahlungen aus Aufträgen
- `tZahlungsabgleichUmsatz` - Bank-Abgleich (Commerzbank, PayPal)
- `pf_amazon_settlement` / `pf_amazon_settlementpos` - Amazon Settlements
- `tRechnung` - Rechnungen
- `tLieferant` - Lieferanten

## 🔑 Umgebungsvariablen

```bash
# .env Datei
MONGO_URL=mongodb://localhost:27017
NEXT_PUBLIC_BASE_URL=https://ihre-domain.de

# JTL MSSQL (bereits konfiguriert)
MSSQL_SERVER=localhost
MSSQL_DATABASE=eazybusiness
MSSQL_USER=SA
MSSQL_PASSWORD=***
```

⚠️ **WICHTIG:** Diese Werte NIEMALS ändern, da sie für das Deployment vorkonfiguriert sind!

## 📊 Wichtige Features

### 1. Kontenplan-Management
- **137 SKR04-Konten** vorinstalliert
- Manuelle Konten-Anlage mit automatischer SKR04-Klassifizierung
- Echtzeit-Validierung (4-stellig, numerisch)
- Live-Analyse der Kontenklasse beim Eingeben

### 2. Zahlungsmodul
- **7 Zahlungsquellen:**
  - Amazon Payment (mit Gebühren)
  - eBay (in Vorbereitung)
  - PayPal (in Vorbereitung)
  - Mollie
  - Commerzbank
  - Postbank (CSV)
  - Otto.de
- **Zuordnungs-System:**
  - Rechnung zuordnen
  - Buchungskonto zuordnen (z.B. 6850 Gebühren)
  - Manuelle Bearbeitung
- **Filter & Statistiken**

### 3. Amazon Settlement Reports
- **Vollständige Daten** aus JTL `pf_amazon_settlement`
- **319.109 Positionen** verfügbar
- **Automatische Kategorisierung:**
  - Erlöse (Artikel, Versand, Steuer)
  - Gebühren (Provision, FBA, Versand)
  - Rückerstattungen
  - Transfers

### 4. Bank-Import
- CSV-Import für Postbank
- Automatisches Matching mit Rechnungen
- Fuzzy-Matching-Algorithmus

## 🔐 Sicherheit

- Alle API-Routes sind server-side
- Keine sensiblen Daten im Frontend
- MongoDB-Verbindung über private Netzwerke
- MSSQL mit Authentifizierung

## 🧪 Testing

```bash
# Kontenplan prüfen
node scripts/check-kontenplan.js

# Kontenplan neu importieren
node scripts/import-kontenplan-skr04.js
```

## 📝 Weitere Dokumentation

Detaillierte Dokumentation finden Sie in `/app/docs/`:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System-Architektur
- [EXTERNE_RECHNUNGEN.md](docs/EXTERNE_RECHNUNGEN.md) - Externe Rechnungen
- [BANK_IMPORT.md](docs/BANK_IMPORT.md) - Bank-Import
- [KONTENPLAN.md](docs/KONTENPLAN.md) - Kontenplan-Details
- [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) - Entwickler-Leitfaden

## 🤝 Support

Bei Fragen oder Problemen:
1. Prüfen Sie die Dokumentation in `/app/docs/`
2. Schauen Sie in die Code-Kommentare
3. Kontaktieren Sie den ursprünglichen Entwickler

## 📜 Lizenz

Proprietary - Alle Rechte vorbehalten

---

**Version:** 1.0.0  
**Stand:** November 2025  
**Hauptmodule:** FIBU, Kontenplan, Zahlungen, Externe Rechnungen