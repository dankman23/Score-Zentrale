# SCORE Zentrale - FIBU Modul

## Übersicht

Das FIBU-Modul ist ein vollständiges in-house Buchhaltungssystem, das mit der JTL-Wawi MSSQL-Datenbank integriert ist und zusätzliche Buchhaltungsfunktionen in MongoDB verwaltet.

## Hauptfunktionen

### 1. Dashboard & Übersicht
- Zentrale Übersicht über alle Finanzkennzahlen
- Monatliche KPI-Auswertung
- Umsatz-, Kosten- und Gewinn-Tracking
- Zeitraum-Filter (Monat/Quartal/Jahr)

### 2. Verkaufsrechnungen (VK)
- Automatischer Import aus JTL DB (tRechnung)
- Externe Amazon-Rechnungen (XRE-*) aus Rechnung.tExternerBeleg
- Status-Tracking: Offen/Bezahlt
- Filter nach Quelle (JTL/Amazon/eBay)
- PDF-Beleg-Anzeige

### 3. Einkaufsrechnungen (EK)
- Verwaltung von Lieferanten-Rechnungen
- Kreditor-Zuordnung (Lieferant)
- Duplikat-Erkennung und Bereinigung
- CSV-Import aus E-Mail-Posteingang
- Status: Offen/Zugeordnet/Bezahlt

### 4. Zahlungen
- Multi-Provider Integration:
  - PayPal (aus JTL tZahlung)
  - Amazon Payment (aus JTL tZahlung)
  - eBay (aus JTL tZahlungsabgleichUmsatz)
  - Postbank (CSV-Import)
  - Commerzbank (CSV-Import)
- Intelligentes Matching: Zahlung ↔ Rechnung
- Filter nach Anbieter, Zuordnung, Richtung
- Server-Side Caching für Performance

### 5. Kreditor-Zuordnung
- Intelligente Massen-Zuordnung (1 Zuordnung = alle vom gleichen Lieferant)
- PDF-Beleg-Viewer
- Edit-Modal für Rechnungsdetails
- CSV-Import für Kreditoren-Stammdaten

### 6. Kontenplan (SKR04)
- 137 Konten aus Summen- und Saldenliste
- DATEV SKR04 Struktur (Abschlussgliederungsprinzip)
- Hierarchie: Kontenklasse → Kontengruppe → Untergruppe → Einzelkonto
- CRUD-Funktionen (Anlegen/Bearbeiten/Löschen)
- Tab-Navigation nach Kontenklassen
- Vorbereitet für SUSA (Summen- und Saldenliste) Export

### 7. Bank-Import
- Postbank CSV (18-Spalten-Format)
- Commerzbank CSV
- Automatische Kategorisierung
- Duplikat-Erkennung

## Technologie-Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18** mit Hooks
- **Tailwind CSS** für Styling
- **shadcn/ui** Komponenten

### Backend
- **Next.js API Routes** (TypeScript)
- **MongoDB** für erweiterte FIBU-Daten
- **MSSQL** (JTL-Wawi Integration)
- **Node.js Scripts** für Batch-Operationen

### Datenbanken
- **MongoDB (score_zentrale)**:
  - `fibu_zahlungen` - Zentrale Zahlungen
  - `fibu_externe_rechnungen` - Amazon VCS-Lite Rechnungen
  - `fibu_ek_rechnungen` - Einkaufsrechnungen mit Zuordnung
  - `fibu_email_inbox` - E-Mail-Import (PDFs als Base64)
  - `fibu_bank_transaktionen` - Bank-CSV-Imports
  - `fibu_kontenplan` - SKR04 Konten (137 aktive)
  - `kreditoren` - Lieferanten-Stammdaten

- **JTL MSSQL (eazybusiness)**:
  - `dbo.tRechnung` - Verkaufsrechnungen
  - `Rechnung.tExternerBeleg` - Externe Belege (Amazon)
  - `dbo.tZahlung` - Zahlungseingänge
  - `dbo.tZahlungsabgleichUmsatz` - Zahlungsabgleich (eBay)

## Wichtige Konzepte

### 1. Hybride Datenarchitektur
- **JTL DB = Source of Truth** für Verkaufsdaten
- **MongoDB = Erweiterung** für FIBU-spezifische Daten
- Synchronisation über API-Layer

### 2. Intelligentes Zahlungs-Matching
- **Amazon Payments**: Matching über Betrag (±0.50 EUR) + Datum (±1 Tag)
- **Externe Rechnungen (XRE-*)**: IMMER als "Bezahlt" (Amazon VCS-Lite)
- **Fuzzy Matching**: Für unklare Zuordnungen

### 3. Server-Side Caching
- Kritische APIs cachen Daten für 5 Minuten
- Reduziert Load-Zeit von 15s auf 3s
- Cache-Invalidierung bei Datenänderungen

### 4. Daten-Integrität
- **Regel**: "Was einmal im Modul ist, bleibt auch da!"
- Automatische Duplikat-Erkennung
- Filter gegen fehlerhafte Daten (Selbst-Firma als Lieferant)
- Kritische APIs sind geschützt (siehe `CRITICAL_APIS_DO_NOT_BREAK.md`)

### 5. SKR04 Kontenplan-Struktur
```
Kontonummer (4-stellig):
1. Ziffer: Kontenklasse (0-9)
1.-2. Ziffer: Kontengruppe
1.-3. Ziffer: Kontenuntergruppe
4-stellig: Einzelkonto

Beispiel: 1810 (PayPal)
- Klasse 1: Umlaufvermögen
- Gruppe 18: Kasse/Bank
- Untergruppe 181: Bankkonten
- Konto 1810: PayPal
```

## Quick Start

### 1. Voraussetzungen
```bash
# Node.js 20+
# MongoDB (lokal oder Remote)
# Zugriff auf JTL MSSQL DB
```

### 2. Installation
```bash
cd /app
yarn install
```

### 3. Umgebungsvariablen
Datei: `/app/.env`
```bash
# MongoDB (NICHT ÄNDERN!)
MONGO_URL=mongodb://localhost:27017

# JTL MSSQL
JTL_SQL_HOST=162.55.235.45
JTL_SQL_PORT=49172
JTL_SQL_DATABASE=eazybusiness
JTL_SQL_USER=sellermath
JTL_SQL_PASSWORD=***
JTL_SQL_ENCRYPT=false
JTL_SQL_TRUST_CERT=true

# Next.js (NICHT ÄNDERN!)
NEXT_PUBLIC_BASE_URL=https://[ihre-domain]
```

### 4. Daten-Import
```bash
# Kontenplan (SKR04) importieren
node scripts/import-kontenplan-skr04.js

# Kreditoren aus CSV importieren
node scripts/import-kreditoren-csv.js

# (Optional) Fuzzy-Matching für Zahlungen
node scripts/fuzzy-match-zahlungen.js
```

### 5. Services starten
```bash
# Alle Services
sudo supervisorctl restart all

# Nur Next.js
sudo supervisorctl restart nextjs
```

### 6. Zugriff
```
Frontend: https://[ihre-domain]/fibu
API: https://[ihre-domain]/api/fibu/*
```

## Test-Suite

### Kritischer Daten-Test (PFLICHT vor/nach Änderungen)
```bash
node test-critical-data.js
```

Prüft ob alle wichtigen Daten noch vorhanden sind:
- VK-Rechnungen (min. 1000)
- Externe Rechnungen (min. 40)
- EK-Rechnungen (min. 20)
- Zahlungen (min. 200)
- Kreditoren (min. 50)

### Weitere Test-Scripts
```bash
# Externe Rechnungen mit Zahlungszuordnung
node test-externe-rechnungen.js

# JTL DB Relationen
node test-jtl-relations.js

# Postbank Import
node test-postbank-import.js
```

## API-Endpunkte (Übersicht)

### Rechnungen
- `GET /api/fibu/rechnungen/vk` - Verkaufsrechnungen
- `GET /api/fibu/rechnungen/extern` - Amazon externe Rechnungen
- `GET /api/fibu/ek-rechnungen/list` - Einkaufsrechnungen

### Zahlungen
- `GET /api/fibu/zahlungen` - Alle Zahlungen (gecacht)
- `POST /api/fibu/bank-import` - Bank-CSV importieren

### Stammdaten
- `GET/POST/PUT/DELETE /api/fibu/kontenplan` - SKR04 Konten
- `GET/POST/PUT/DELETE /api/fibu/kreditoren` - Lieferanten

### Dashboard
- `GET /api/fibu/uebersicht/complete` - Gesamtübersicht (gecacht)

## Performance-Optimierungen

1. **Server-Side Caching**
   - `/api/fibu/uebersicht/complete` - 5 Minuten Cache
   - `/api/fibu/zahlungen` - 5 Minuten Cache
   - Reduziert Ladezeit von 15s → 3s

2. **Optimierte Queries**
   - Indizes auf häufig genutzte Felder
   - LEFT JOINs statt Nested Queries
   - Batching für große Datenmengen

3. **Frontend-Optimierung**
   - Lazy Loading für Tabs
   - Virtualisierung für große Tabellen
   - Debounced Search

## Sicherheits-Mechanismen

### Daten-Schutz
**Siehe:** `/app/docs/CRITICAL_APIS_DO_NOT_BREAK.md`

- Kritische APIs sind dokumentiert und geschützt
- Automatischer Daten-Test (`test-critical-data.js`)
- Rollback-Anleitung bei Daten-Verlust
- Systemkonten können nicht gelöscht werden

### Regel
> **"Was einmal im Modul ist, bleibt auch da und kann nur manuell gelöscht werden!"**

Keine Code-Änderung darf jemals dazu führen, dass Daten verschwinden.

## Bekannte Besonderheiten

### 1. Externe Amazon Rechnungen
- Status ist IMMER "Bezahlt" (VCS-Lite = bereits abgewickelt)
- Matching zu Amazon Payments über Betrag + Datum (nicht kBestellung!)
- `kExternerBeleg` ≠ `kBestellung` in tZahlung

### 2. Bank-Transaktionen
- Werden in separater Collection gespeichert (`fibu_bank_transaktionen`)
- Zahlungen-API liest aus beiden Collections
- Postbank: 18-Spalten CSV-Format mit Soll/Haben

### 3. Kontenplan
- SKR04 (nicht SKR03!)
- 137 aktive Konten
- Kontenklassen: 0,1,3,4,5,6,7,9 (2 und 8 nicht verwendet)
- Alle Konten sind editierbar (außer Systemkonten)

## Wichtige Workflows

### Kreditor-Zuordnung
1. Unzugeordnete EK-Rechnungen erscheinen im Tab "Kreditor-Zuordnung"
2. Kreditor aus Dropdown auswählen
3. **Intelligente Zuordnung**: Alle offenen Rechnungen des gleichen Lieferanten werden automatisch zugeordnet
4. Rechnung wird zu "EK-Rechnungen" verschoben

### Bank-Import
1. CSV-Datei über "Bank-Import" Tab hochladen
2. Format wird automatisch erkannt (Postbank/Commerzbank)
3. Transaktionen werden geparst und kategorisiert
4. Duplikate werden automatisch erkannt
5. Transaktionen erscheinen im "Zahlungen" Modul

### Rechnungs-Zuordnung
1. Zahlungen ohne Rechnung im "Zahlungen" Tab filtern
2. Fuzzy-Matching Script ausführen (optional)
3. Manuelle Zuordnung über UI möglich

## Datei-Struktur

```
/app/
├── app/
│   ├── api/fibu/              # FIBU APIs
│   │   ├── rechnungen/
│   │   │   ├── vk/route.ts
│   │   │   └── extern/route.ts
│   │   ├── ek-rechnungen/
│   │   │   └── list/route.ts
│   │   ├── zahlungen/route.ts
│   │   ├── kontenplan/route.ts
│   │   ├── kreditoren/route.ts
│   │   └── uebersicht/complete/route.ts
│   ├── fibu/page.js           # FIBU Dashboard
│   └── lib/db/
│       ├── mongodb.ts         # MongoDB Connection
│       └── mssql.ts           # JTL MSSQL Connection
├── components/                 # React Komponenten
│   ├── FibuCompleteDashboard.js
│   ├── VKRechnungenView.js
│   ├── EKRechnungenView.js
│   ├── ZahlungenView.js
│   ├── KreditorZuordnung.js
│   ├── KontenplanView.js
│   └── ...
├── scripts/                    # Batch-Scripts
│   ├── import-kontenplan-skr04.js
│   ├── import-kreditoren-csv.js
│   ├── fuzzy-match-zahlungen.js
│   └── fix-amazon-payment-zuordnung.js
├── docs/                       # Dokumentation
│   ├── CRITICAL_APIS_DO_NOT_BREAK.md
│   ├── EXTERNE_RECHNUNGEN_FIX.md
│   ├── FIBU_BELEGE_SYSTEM.md
│   └── CHANGELOG.txt
└── test-*.js                   # Test-Scripts
```

## Entwickler-Hinweise

### Vor Änderungen an FIBU-APIs

1. **Dokumentation lesen**
   ```bash
   cat /app/docs/CRITICAL_APIS_DO_NOT_BREAK.md
   cat /app/README_FOR_AGENTS.md
   ```

2. **Daten-Test ausführen**
   ```bash
   node test-critical-data.js
   # Alle Tests müssen ✅ sein
   ```

3. **Backup erstellen**
   ```bash
   cp [datei].ts [datei].ts.backup
   ```

4. **Änderung testen**
   ```bash
   node test-critical-data.js
   # Nach Änderung erneut prüfen
   ```

### Verbotene Änderungen (ohne explizite User-Anweisung)

❌ WHERE-Clause verschärfen (filtert Daten aus!)
❌ Collection-Namen ändern
❌ Komplexe SQL-Subqueries ohne Test
❌ Response-Format brechen
❌ URLs/Ports in .env ändern

### Erlaubte Änderungen

✅ Neue Felder zur Response hinzufügen
✅ Performance-Optimierung MIT Test
✅ Neue APIs erstellen
✅ Caching verbessern

## Lizenz & Fork-Informationen

**Original-Projekt:** SCORE Zentrale FIBU Modul  
**Entwickelt für:** Eazy Business / SCORE Schleifwerkzeuge  
**Zeitraum:** Oktober 2024 - Januar 2025  
**Technologie:** Next.js 14 + MongoDB + MSSQL

### Bei Fork beachten

1. **Umgebungsvariablen anpassen** (`.env`)
2. **JTL-Zugangsdaten** ändern
3. **MongoDB-URL** konfigurieren
4. **Kontenplan** auf eigene Bedürfnisse anpassen
5. **Kreditoren-Liste** leeren und neu importieren

### Kontakt & Support

Bei Fragen zur Implementierung siehe:
- `/app/docs/` - Komplette Dokumentation
- `/app/README_FOR_AGENTS.md` - Entwickler-Guide
- `/app/test-*.js` - Test-Beispiele

---

**Stand:** Januar 2025  
**Version:** 2.0  
**Status:** Production-Ready
