# FIBU Manager - Integriertes Finanzbuchhaltungssystem

## 📋 Überblick

Der FIBU Manager ist eine spezialisierte Buchhaltungslösung für E-Commerce-Unternehmen, die JTL-Wawi nutzen. Das System integriert Finanzdaten aus JTL (MSSQL) und erweitert diese um moderne Buchhaltungsfunktionen in MongoDB.

## 🎯 Hauptfunktionen

### 1. Externe Rechnungen & Zahlungszuordnung
- Automatische Erkennung von Amazon-Rechnungen (XRE-*)
- Intelligente Zuordnung von Rechnungen zu Zahlungen
- Matching nach Betrag und Datum
- Automatische Statusaktualisierung auf "Bezahlt"

### 2. Bank-Transaktionen Import
- CSV-Import für Postbank-Kontoauszüge
- Automatisches Parsing von Soll/Haben-Spalten
- Integration in die Hauptzahlungsübersicht
- Filterbare und durchsuchbare Transaktionsliste

### 3. Kontenplan-Verwaltung (SKR04)
- Vollständiger SKR04-Kontenrahmen (137+ Konten)
- CRUD-Funktionalität für alle Konten
- Hierarchische Darstellung (Klasse → Gruppe → Untergruppe → Konto)
- Multi-Tab-Navigation für verschiedene Stammdatenbereiche

### 4. Kreditoren-Management
- Verwaltung von 117+ Lieferanten
- Kategorisierung nach Lieferantentypen
- Zuordnung zu Buchungskonten
- Filterbare Übersicht

### 5. Zahlungseinstellungen
- Konfiguration von Sammel-Debitorenkonten
- Zuordnung Zahlungsart → Debitor → Bankkonto
- Gebührenkonto-Verwaltung
- Beispiel-Buchungssätze für besseres Verständnis

## 🏗️ Technologie-Stack

### Frontend
- **Next.js 14+** - React-Framework mit SSR
- **React** - UI-Komponenten
- **Tailwind CSS** - Styling

### Backend
- **Next.js API Routes** - RESTful API
- **Node.js** - Runtime

### Datenbanken
- **JTL MSSQL** - Bestehende Geschäftsdaten (read-only)
- **MongoDB** - Neue FIBU-Daten (read/write)

### Zusätzliche Tools
- **mssql** - MSSQL-Datenbankverbindung
- **mongodb** - MongoDB-Treiber

## 📁 Projektstruktur

```
/app/
├── app/
│   ├── api/              # Backend API Routes
│   │   └── fibu/
│   │       ├── bank-import/route.ts          # CSV-Import
│   │       ├── kontenplan/route.ts           # Konten CRUD
│   │       ├── kreditoren/route.ts           # Lieferanten
│   │       ├── rechnungen/extern/route.ts    # Externe Rechnungen
│   │       ├── zahlungen/route.ts            # Zahlungsübersicht
│   │       └── zahlungseinstellungen/route.ts
│   └── fibu/
│       └── page.js        # FIBU Dashboard
├── components/
│   ├── BankImport.js                # CSV-Import UI
│   ├── FibuCompleteDashboard.js     # Haupt-Dashboard
│   ├── KontenplanView.js            # Kontenplan-Verwaltung
│   ├── KreditorenManagement.js      # Lieferanten-UI
│   ├── ZahlungsEinstellungen.js     # Einstellungen
│   └── ZahlungenView.js             # Zahlungen
├── docs/
│   ├── ARCHITECTURE.md              # Architektur-Dokumentation
│   ├── CRITICAL_APIS_DO_NOT_BREAK.md
│   ├── EXTERNE_RECHNUNGEN.md        # Rechnungs-Matching
│   ├── BANK_IMPORT.md               # CSV-Import
│   ├── KONTENPLAN.md                # SKR04-Details
│   ├── ZAHLUNGEN.md                 # Zahlungssystem
│   └── DEVELOPER_GUIDE.md           # Entwickler-Leitfaden
├── scripts/
│   ├── import-kontenplan-skr04.js   # Kontenplan-Import
│   └── test-critical-data.js        # Datenintegritäts-Tests
└── README_FOR_AGENTS.md             # KI-Agenten-Anleitung
```

## 🚀 Setup & Installation

### Voraussetzungen
- Node.js 18+
- Zugriff auf JTL MSSQL-Datenbank
- MongoDB-Instanz

### Installation

1. **Repository klonen**
```bash
git clone <repository-url>
cd fibu-manager
```

2. **Dependencies installieren**
```bash
yarn install
```

3. **Umgebungsvariablen konfigurieren**

Erstellen Sie `.env` mit folgenden Variablen:

```env
# JTL MSSQL Datenbank (Read-Only)
JTL_DB_SERVER=<server>
JTL_DB_PORT=1433
JTL_DB_DATABASE=<database_name>
JTL_DB_USER=<username>
JTL_DB_PASSWORD=<password>

# MongoDB (Read/Write für FIBU-Daten)
MONGO_URL=mongodb://localhost:27017/fibu

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

4. **Kontenplan importieren**
```bash
node scripts/import-kontenplan-skr04.js
```

5. **Entwicklungsserver starten**
```bash
yarn dev
```

Die Anwendung läuft auf `http://localhost:3000`

## 📊 Datenbank-Schema

### MongoDB Collections

#### `fibu_konten`
Speichert den vollständigen SKR04-Kontenplan.

```javascript
{
  kontonummer: "1802",          // 4-stellig
  bezeichnung: "Postbank",
  kontenklasse: 1,              // 0-9
  kontengruppe: "18",           // 2-stellig
  kontenuntergruppe: "180",     // 3-stellig
  kontenklasseBezeichnung: "Umlaufvermögen",
  kontenklasseTyp: "aktiv",     // aktiv/passiv/ertrag/aufwand
  steuerrelevant: false,
  istAktiv: true,
  istSystemkonto: true,
  created_at: ISODate,
  updated_at: ISODate
}
```

#### `fibu_bank_transaktionen`
Importierte Bank-Transaktionen aus CSV.

```javascript
{
  buchungsdatum: ISODate,
  wertstellung: ISODate,
  verwendungszweck: String,
  betrag: Number,              // Positiv=Haben, Negativ=Soll
  waehrung: "EUR",
  saldo: Number,
  quelle: "postbank_csv",
  imported_at: ISODate
}
```

#### `fibu_kreditoren`
Lieferanten-Stammdaten.

```javascript
{
  kreditorenNummer: String,
  name: String,
  kategorie: String,           // z.B. "4" für Warenlieferant
  beschreibung: String,
  kontoNummer: String,         // Zugeordnetes Kreditorenkonto
  istAktiv: Boolean,
  created_at: ISODate,
  updated_at: ISODate
}
```

#### `fibu_zahlungseinstellungen`
Mapping: Zahlungsart → Debitor → Bank → Gebühren.

```javascript
{
  name: "Amazon Payment",
  zahlungsart: "amazon",       // JTL-Zahlungsart
  debitorKonto: "69002",       // Sammel-Debitor
  bankKonto: "1817",           // Amazon-Bank
  gebuehrenKonto: "4985",      // Gebühren
  beschreibung: String,
  istAktiv: Boolean
}
```

### JTL MSSQL Tabellen (Read-Only)

Die folgenden JTL-Tabellen werden gelesen:

- `dbo.tBestellung` - Bestellungen
- `dbo.tRechnungskopf` - Rechnungen
- `dbo.tZahlungseingang` - Zahlungseingänge
- `dbo.tZahlungsart` - Zahlungsarten
- `dbo.tLieferschein` - Lieferscheine

## 🔐 Sicherheitshinweise

### Kritische APIs

⚠️ **ACHTUNG:** Die folgenden APIs dürfen NICHT modifiziert werden ohne umfassende Tests:

1. **`/api/fibu/rechnungen/extern`**
   - Führt Rechnungs-/Zahlungs-Matching durch
   - Ändert Status in JTL-Datenbank
   - Bei Fehlern: Datenverlust möglich!

2. **`/api/fibu/zahlungen`**
   - Kombiniert Daten aus JTL + MongoDB
   - Fehler führen zu falschen Finanzberichten

Siehe `docs/CRITICAL_APIS_DO_NOT_BREAK.md` für Details.

### Datenintegrität

- **JTL-Datenbank:** IMMER read-only behandeln
- **MongoDB:** Backups vor größeren Änderungen
- **Test-Skript:** Vor Deployment `node scripts/test-critical-data.js` ausführen

## 📖 Weitere Dokumentation

- [Architektur](docs/ARCHITECTURE.md) - Detaillierte System-Architektur
- [Externe Rechnungen](docs/EXTERNE_RECHNUNGEN.md) - Rechnungs-Matching-Logik
- [Bank-Import](docs/BANK_IMPORT.md) - CSV-Import-Funktionalität
- [Kontenplan](docs/KONTENPLAN.md) - SKR04-Implementierung
- [Zahlungen](docs/ZAHLUNGEN.md) - Zahlungssystem
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Entwickler-Handbuch

## 🤝 Beitragen

Dieses Projekt ist für interne Nutzung konzipiert. Bei Fragen oder Problemen:

1. Dokumentation in `/docs` prüfen
2. `README_FOR_AGENTS.md` für KI-Assistenten konsultieren
3. Kritische APIs beachten!

## 📝 Lizenz

Internes Projekt - Alle Rechte vorbehalten.

## 🔧 Wartung

### Backup-Strategie
- MongoDB: Täglich automatisches Backup
- JTL-Datenbank: Wird vom JTL-System verwaltet

### Monitoring
- Logs: `/var/log/supervisor/nextjs.out.log`
- Fehler-Rate bei externen Rechnungen überwachen
- Import-Erfolgsrate bei Bank-CSVs prüfen

### Updates
- Vor Updates: Backup erstellen
- Nach Updates: Test-Skript ausführen
- Kritische APIs testen

---

**Version:** 1.0.0  
**Letzte Aktualisierung:** November 2025  
**Status:** Produktiv im Einsatz