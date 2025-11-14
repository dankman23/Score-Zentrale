# SCORE Zentrale - FIBU Modul

## Übersicht

Komplettes Finanzbuchhaltungs-Modul für Score Handels GmbH & Co. KG mit Anbindung an JTL-Wawi und vollständiger SKR04-Kontenplan-Integration.

## Hauptfunktionen

### 1. EK-Rechnungen (Lieferantenrechnungen)
- **Automatischer Import** per E-Mail mit PDF-Parsing (Gemini AI)
- **Duplikate-Erkennung** und Filterung
- **Kreditor-Zuordnung** mit Batch-Funktion
- **0€-Rechnungen** automatisch in Zuordnung (nicht im Haupttab)
- **Beleg-Anzeige** (PDF aus MongoDB)
- **Filter**: Kreditor, Zahlung, Suche
- **Sortierung**: Datum, Lieferant, Betrag, Kreditor
- **Aktionen**: Beleg anzeigen, Zurück in Zuordnung, Löschen

### 2. VK-Rechnungen (Kundenrechnungen)
- **JTL-Integration** für normale RE-Rechnungen
- **Externe Rechnungen** (XRE-*) für Amazon/eBay
- **Rechnungsnummer + Kunde** aus MongoDB
- **Status**: Bezahlt/Offen
- **Filter**: Quelle, Status

### 3. Zahlungen
- **Multi-Source**: PayPal, Amazon Payment, eBay, Commerzbank, Postbank
- **1000 Zahlungen** anzeigen mit Cache (5 Min)
- **Bestellnummer** angezeigt für Amazon/eBay
- **Filter**: Anbieter, Zuordnung, Richtung
- **Spalten**: Datum, Anbieter, Betrag, Rechnung, Kunde, Hinweis/Bestellnr, Zuordnung, Quelle

### 4. Kreditor-Zuordnung
- **117 Kreditoren** aus CSV importiert (SKR04)
- **Intelligente Vorschläge** (Name-Matching)
- **Batch-Zuordnung** für mehrere Rechnungen
- **Auto-Zuordnung**: Alle Rechnungen vom gleichen Lieferanten auf einmal
- **Mapping speichern**: Zukünftige Rechnungen automatisch zuordnen
- **Edit-Funktion**: Rechnungen korrigieren (Lieferant, RgNr, Betrag, Datum)
- **Beleg anzeigen**: PDF direkt aus E-Mail-Anhang

### 5. Kreditoren-Verwaltung
- **CRUD-Funktionen**: Anlegen, Bearbeiten, Löschen
- **127 Kreditoren** verfügbar
- **Suche** nach Nummer oder Name
- **Kategorien**: 1-4
- **CSV-Import** möglich

### 6. Monats-Übersicht
- **KPI-Dashboard** mit kompakten Kacheln
- **Fortschrittsbalken** (Gesamt-Zuordnung)
- **Zufallszitat** (Philosophen feat. Reality-TV-Stars)
- **Direkte Links** von KPIs zu Detail-Views
- **Export-Button** wenn Monat abschließbar

### 7. Tennet/10it Export
- **SKR04-konform** (1200, 1825, 4400, etc.)
- **Doppelte Buchführung** (SOLL/HABEN)
- **Alle Belege**: VK-Rechnungen, EK-Rechnungen, Zahlungen
- **CSV-Format** für Tennet/Addison

### 8. Bank-Import
- **Postbank CSV** automatisch parsen
- **Gehälter** automatisch kategorisieren
- **Transaktionen** in MongoDB speichern

### 9. Fuzzy-Matching
- **Automatische Zuordnung** von Zahlungen zu Rechnungen
- **Betrag + Datum + Rechnungsnummer** Matching
- **Amazon Payment Regel**: NUR zu XRE-* Rechnungen
- **Confidence-Score**: Auto-Match ab 70%, Manuelle Prüfung ab 50%

### 10. Smart-Matching (Commerzbank)
- **Regel-basiert** für wiederkehrende Zahlungen
- **Lernend**: Speichert Muster
- **Automatische Zuordnung** für bekannte Zahlungsempfänger

## Technologie-Stack

### Frontend
- **Next.js 15** (React 19)
- **Tailwind CSS** + **shadcn/ui**
- **Client-Side Components** für Interaktivität

### Backend
- **Next.js API Routes** (TypeScript)
- **MongoDB** (score_zentrale DB)
  - Collections: kreditoren, fibu_ek_rechnungen, fibu_vk_rechnungen, fibu_externe_rechnungen, fibu_zahlungen, fibu_email_inbox, fibu_lieferant_kreditor_mapping
- **MSSQL** (JTL-Wawi Integration)
  - Database: eazybusiness
  - Tables: tZahlung, tRechnung, tExternerBeleg, tBestellung, tKunde, tKreditor

### AI/ML
- **Google Gemini** für PDF-Parsing (Rechnungsdaten-Extraktion)

## Installation

### Voraussetzungen
```bash
Node.js 20+
Yarn
MongoDB
MSSQL Server (JTL-Wawi)
```

### Setup
```bash
# Dependencies installieren
yarn install

# Environment Variables
cp .env.example .env
# MONGO_URL, JTL_SQL_*, GEMINI_API_KEY konfigurieren

# Development
yarn dev

# Production
yarn build
yarn start
```

### Kreditoren importieren
```bash
node scripts/import-kreditoren-csv.js /pfad/zu/kreditoren.csv
```

## Projekt-Struktur

```
/app/
├── app/
│   ├── api/fibu/              # FIBU API Routes
│   │   ├── zahlungen/         # Zahlungen-API
│   │   ├── ek-rechnungen/     # EK-Rechnungen Liste
│   │   ├── zuordnung/         # Zuordnungs-APIs
│   │   ├── beleg/[id]/        # PDF-Beleg anzeigen
│   │   ├── kreditoren/        # Kreditoren CRUD
│   │   ├── export/10it/       # Tennet Export
│   │   ├── bank-import/       # Postbank Import
│   │   └── fix-amazon-zuordnung/  # Amazon Payment Fix
│   ├── fibu/page.js           # FIBU Hauptseite
│   └── lib/db/                # DB Connections
│       ├── mongodb.ts         # MongoDB Helper
│       └── mssql.ts           # MSSQL Helper
├── components/
│   ├── FibuCompleteDashboard.js    # Haupt-Dashboard
│   ├── EKRechnungenView.js         # EK-Rechnungen View
│   ├── VKRechnungenView.js         # VK-Rechnungen View
│   ├── ZahlungenView.js            # Zahlungen View
│   ├── KreditorZuordnung.js        # Zuordnungs-Interface
│   ├── KreditorenManagement.js     # Kreditoren Verwaltung
│   ├── FibuMonatsUebersicht.js     # KPI Dashboard
│   ├── DateRangePicker.js          # Custom Date Picker
│   └── BankImport.js               # Bank CSV Upload
├── scripts/
│   ├── import-kreditoren-csv.js    # Kreditoren Import
│   ├── fuzzy-match-zahlungen.js    # Fuzzy Matching
│   └── smart-match-commerzbank.js  # Smart Matching
└── docs/
    ├── FIBU_BELEGE_SYSTEM.md       # Beleg-System Doku
    └── FIBU_FEATURES.md            # Feature-Übersicht
```

## Wichtige Workflows

### 1. EK-Rechnung verarbeiten
1. E-Mail mit PDF kommt an
2. PDF wird in `fibu_email_inbox` (Base64) gespeichert
3. Gemini parst PDF → `fibu_ek_rechnungen`
4. Erscheint in "Kreditor-Zuordnung" Tab
5. Manuell oder Auto: Kreditor zuordnen
6. Erscheint in "EK-Rechnungen" Tab
7. Export über "10it Export"

### 2. Amazon Payment zuordnen
1. Amazon Payment Zahlung in JTL
2. Wird zu `fibu_zahlungen` synchronisiert
3. Fix-API entfernt falsche RE-Zuordnungen
4. Fuzzy-Matching matched zu XRE-* Rechnungen
5. Status: "Bezahlt" in VK-Rechnungen

### 3. Monat abschließen
1. Alle EK-Rechnungen Kreditor zuordnen
2. Alle VK-Rechnungen prüfen
3. Alle Zahlungen zuordnen
4. FIBU Übersicht: "Monat abschließbar" = Grün
5. "10it Export" Button → CSV herunterladen
6. In Tennet/Addison importieren

## Datenbank-Schema

### MongoDB Collections

#### kreditoren
```javascript
{
  _id: ObjectId,
  kreditorenNummer: "70001",
  name: "Haufe Service Center GmbH",
  kategorie: "4",
  created_at: Date,
  source: "csv_import"
}
```

#### fibu_ek_rechnungen
```javascript
{
  _id: ObjectId,
  lieferantName: "DHL Paket GmbH",
  rechnungsNummer: "2025-12345",
  rechnungsdatum: Date,
  gesamtBetrag: 125.50,
  nettoBetrag: 105.46,
  steuerBetrag: 20.04,
  steuersatz: 19,
  kreditorKonto: "70007",
  aufwandskonto: "6300",
  zahlungId: ObjectId | null,
  sourceEmailId: ObjectId,
  needsManualReview: false,
  created_at: Date
}
```

#### fibu_email_inbox
```javascript
{
  _id: ObjectId,
  emailFrom: "rechnung@lieferant.de",
  emailSubject: "Rechnung 2025-12345",
  filename: "rechnung.pdf",
  pdfBase64: "JVBERi0...",
  fileSize: 245678,
  status: "processed",
  rechnungId: ObjectId
}
```

#### fibu_zahlungen
```javascript
{
  _id: ObjectId,
  betrag: 125.50,
  zahlungsdatum: Date,
  zahlungsart: "Amazon Payment",
  zahlungsanbieter: "Amazon",
  kRechnung: 12345,
  rechnungsNr: "XRE-5636",
  istZugeordnet: true,
  zuordnungstyp: "Direkt (kRechnung)",
  hinweis: "Amazon Verkauf",
  cBestellNr: "303-1234567-7654321"
}
```

## API-Endpunkte

### EK-Rechnungen
- `GET /api/fibu/ek-rechnungen/list?from=YYYY-MM-DD&to=YYYY-MM-DD` - Liste geprüfter Rechnungen
- `GET /api/fibu/zuordnung/ek-liste?from=YYYY-MM-DD&to=YYYY-MM-DD` - Liste für Zuordnung
- `PUT /api/fibu/rechnungen/ek/:id` - Rechnung aktualisieren
- `DELETE /api/fibu/rechnung/:id/kreditor-entfernen` - Kreditor entfernen
- `DELETE /api/fibu/rechnung/:id/loeschen` - Rechnung löschen

### Beleg
- `GET /api/fibu/beleg/:sourceEmailId` - PDF anzeigen

### Kreditoren
- `GET /api/fibu/kreditoren?limit=500` - Liste alle
- `POST /api/fibu/kreditoren` - Neu anlegen
- `PUT /api/fibu/kreditoren/:id` - Bearbeiten
- `DELETE /api/fibu/kreditoren/:id` - Löschen

### Zahlungen
- `GET /api/fibu/zahlungen?from=YYYY-MM-DD&to=YYYY-MM-DD&force=true` - Liste (mit Cache)

### Export
- `GET /api/fibu/export/10it?from=YYYY-MM-DD&to=YYYY-MM-DD&type=alle` - Tennet CSV

### Fixes
- `POST /api/fibu/fix-amazon-zuordnung` - Amazon Payment Zuordnungen korrigieren

## Kritische Regeln

### ⚠️ WICHTIG

1. **Amazon Payment** darf NUR zu **XRE-*** Rechnungen zugeordnet werden!
2. **0€ Rechnungen** bleiben IMMER in Zuordnung (nie im EK-Rechnungen Tab)
3. **Duplikate**: Gleicher Lieferant + RgNr + Betrag + Datum = Duplikat
4. **Kreditor-Nummer** kann NICHT geändert werden (nur Name + Kategorie)
5. **Cache**: Zahlungen-API cached 5 Min, "Aktualisieren"-Button lädt neu

## Bekannte Einschränkungen

- PDF-Parsing nicht 100% akkurat (Gemini AI)
- Fuzzy-Matching kann falsch-positive generieren
- MSSQL-Verbindung zu JTL benötigt VPN/Netzwerkzugriff
- Cache-Invalidierung nur manuell per Button

## Roadmap

- [ ] Automatische Kreditor-Erkennung für bekannte Lieferanten
- [ ] Regel-Builder für Smart-Matching
- [ ] Automatische E-Mail-Abholung (IMAP)
- [ ] OCR-Verbesserung für schlechte PDFs
- [ ] Debitor-Verwaltung (Kunden)
- [ ] Mahnwesen
- [ ] DATEV-Export

## Support

Bei Fragen oder Problemen siehe `/app/docs/` Ordner für detaillierte Dokumentation.

---

**Version**: 1.0.0  
**Letzte Aktualisierung**: November 2025  
**Entwickelt für**: Score Handels GmbH & Co. KG