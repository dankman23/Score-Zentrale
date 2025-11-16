# System-Architektur - FIBU Modul

## Überblick

Das FIBU-Modul folgt einer hybriden Architektur mit JTL MSSQL als primäre Datenquelle und MongoDB für erweiterte FIBU-Funktionen.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  ┌────────┬────────┬────────┬────────┬────────────┐    │
│  │Dashboard│ VK-Rg │ EK-Rg  │Zahlungen│Kontenplan │    │
│  └────────┴────────┴────────┴────────┴────────────┘    │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────┐
│              Next.js API Routes (/api/fibu/*)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Rechnungen  │  │  Zahlungen   │  │  Kontenplan  │ │
│  │  VK/EK/Extern│  │  Multi-Quelle│  │  SKR04 CRUD  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└──────────┬──────────────────────┬──────────────────────┘
           │                      │
    ┌──────▼──────┐      ┌───────▼────────┐
    │ JTL MSSQL   │      │   MongoDB      │
    │ eazybusiness│      │ score_zentrale │
    │             │      │                │
    │ • tRechnung │      │ • fibu_zahlungen
    │ • tZahlung  │      │ • fibu_kontenplan
    │ • tExternerBeleg   │ • kreditoren
    │ • tZahlungsabgleich│ • fibu_bank_*
    └─────────────┘      └────────────────┘
```

## Datenbank-Schema

### MongoDB Collections (score_zentrale)

#### 1. fibu_zahlungen
Zentrale Zahlungs-Collection (aus JTL + manuell)
```javascript
{
  zahlungsdatum: Date,
  zahlungsanbieter: String, // "PayPal", "Amazon Payment", "eBay"
  betrag: Number,
  hinweis: String,
  
  // Zuordnung
  rechnungsId: String,
  rechnungsNr: String,
  kRechnung: Number,
  istZugeordnet: Boolean,
  
  // Meta
  quelle: String, // "tZahlung", "tZahlungsabgleichUmsatz", "postbank"
  created_at: Date,
  updated_at: Date
}
```

#### 2. fibu_bank_transaktionen
Bank-CSV-Imports (Postbank, Commerzbank)
```javascript
{
  datum: Date,
  auftraggeber: String,
  verwendungszweck: String,
  betrag: Number, // Haben=positiv, Soll=negativ
  iban: String,
  bic: String,
  
  // Matching
  matchedRechnungNr: String,
  matchedBestellNr: String,
  kategorie: String, // "einnahme_ebay", "versand", "gehalt"
  
  quelle: String, // "postbank", "commerzbank"
  format: String,
  created_at: Date
}
```

#### 3. fibu_kontenplan
SKR04 Kontenplan (137 Konten)
```javascript
{
  kontonummer: String, // 4-stellig, z.B. "1802"
  bezeichnung: String, // "Postbank"
  beschreibung: String,
  
  // SKR04 Hierarchie
  kontenklasse: Number, // 0-9
  kontengruppe: String, // 2-stellig, z.B. "18"
  kontenuntergruppe: String, // 3-stellig, z.B. "180"
  kontenklasseBezeichnung: String, // "Umlaufvermögen"
  kontenklasseTyp: String, // "aktiv", "passiv", "aufwand", "ertrag"
  
  // Steuer
  steuerrelevant: Boolean,
  steuersatz: Number, // 0, 7, 19
  vorsteuer: Boolean,
  
  istAktiv: Boolean,
  istSystemkonto: Boolean,
  created_at: Date,
  updated_at: Date
}
```

#### 4. kreditoren
Lieferanten-Stammdaten
```javascript
{
  kreditorenNummer: String, // z.B. "70001"
  name: String,
  kategorie: String,
  standardAufwandskonto: String, // z.B. "5900"
  kontaktEmail: String,
  telefon: String,
  adresse: Object,
  created_at: Date,
  updated_at: Date
}
```

#### 5. fibu_ek_rechnungen
Einkaufsrechnungen mit Kreditor-Zuordnung
```javascript
{
  lieferant: String,
  rechnungsNr: String,
  datum: Date,
  betrag: Number,
  kreditorId: String, // Referenz zu kreditoren.kreditorenNummer
  sachkonto: String, // z.B. "5900"
  status: String, // "Offen", "Zugeordnet"
  sourceEmailId: String, // Referenz zu fibu_email_inbox
  created_at: Date
}
```

#### 6. fibu_email_inbox
E-Mail-Import für EK-Rechnungen
```javascript
{
  betreff: String,
  absender: String,
  datum: Date,
  attachments: [{
    filename: String,
    contentType: String,
    data: String // Base64-encoded PDF
  }],
  verarbeitet: Boolean,
  created_at: Date
}
```

### JTL MSSQL Tabellen (Wichtigste)

#### dbo.tRechnung
Verkaufsrechnungen (RE-*)
```sql
kRechnung (PK)
cRechnungsNr (RE-123456)
dDatum
fGesamtsumme
kKunde (FK -> tKunde)
```

#### Rechnung.tExternerBeleg
Externe Belege (XRE-* Amazon)
```sql
kExternerBeleg (PK)
cBelegnr (XRE-5105)
dBelegdatumUtc
nBelegtyp (0=Rechnung, 1=Gutschrift)
cHerkunft ("amazon-de", "amazon-fr")
kKunde (FK)
```

#### Rechnung.tExternerBelegEckdaten
Beträge für externe Belege
```sql
kExternerBeleg (FK)
fVkBrutto
fVkNetto
```

#### dbo.tZahlung
Zahlungseingänge
```sql
kZahlung (PK)
kBestellung (FK - ACHTUNG: Nicht immer = kExternerBeleg!)
kRechnung (FK -> tRechnung)
fBetrag
dDatum
cHinweis
kZahlungsart (FK -> tZahlungsart)
```

#### dbo.tZahlungsabgleichUmsatz
eBay Zahlungsabgleich
```sql
kZahlungsabgleichUmsatz (PK)
fBetrag
cBestellNr
cHinweis
```

## Datenfluss

### 1. Verkaufsrechnungen (VK)
```
JTL tRechnung → API /api/fibu/rechnungen/vk → MongoDB Cache → Frontend
                                                              ↓
                                                          Filter nach:
                                                          - Datum
                                                          - Status
                                                          - Quelle
```

### 2. Externe Amazon Rechnungen (XRE)
```
JTL Rechnung.tExternerBeleg + tExternerBelegEckdaten
            ↓
    LEFT JOIN tZahlung (Matching: Betrag ±0.50€, Datum ±1 Tag)
            ↓
    API /api/fibu/rechnungen/extern
            ↓
    Status = "Bezahlt" (IMMER!)
            ↓
    MongoDB Cache (optional)
            ↓
    Frontend (VK-Rechnungen Tab, Filter: "Amazon/Extern")
```

### 3. Zahlungen (Multi-Source)
```
┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐
│ JTL tZahlung    │  │ JTL tZahlungs-   │  │ MongoDB        │
│ (PayPal/Amazon) │  │ abgleichUmsatz   │  │ fibu_bank_*    │
│                 │  │ (eBay)           │  │ (Postbank/CB)  │
└────────┬────────┘  └────────┬─────────┘  └────────┬───────┘
         │                    │                     │
         └────────────────────┼─────────────────────┘
                              ↓
                   API /api/fibu/zahlungen
                   (Server-Side Cache 5 Min)
                              ↓
                      Kombinierte Liste
                              ↓
                    Frontend Zahlungen-View
```

### 4. Einkaufsrechnungen (EK)
```
E-Mail mit PDF-Anhang
         ↓
fibu_email_inbox (Base64-PDF)
         ↓
Manuelle/Automatische Extraktion
         ↓
fibu_ek_rechnungen (ohne Kreditor)
         ↓
Kreditor-Zuordnung UI
         ↓
fibu_ek_rechnungen (mit Kreditor)
         ↓
EK-Rechnungen View
```

## API-Architektur

### 1. Caching-Strategie

**Problem:** JTL DB-Queries sind langsam (15s für Complete-Overview)

**Lösung:** In-Memory Cache
```typescript
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 Minuten

if (cache.has(cacheKey)) {
  const { data, timestamp } = cache.get(cacheKey)
  if (Date.now() - timestamp < CACHE_TTL) {
    return data // Cache Hit
  }
}

// Cache Miss → DB Query
const data = await fetchFromDB()
cache.set(cacheKey, { data, timestamp: Date.now() })
```

**Gecachte APIs:**
- `/api/fibu/uebersicht/complete` - Dashboard
- `/api/fibu/zahlungen` - Zahlungen

### 2. Matching-Algorithmen

#### Betrag + Datum Matching (für Amazon Payments)
```typescript
function matchPaymentToInvoice(payment, invoice) {
  const betragDiff = Math.abs(payment.betrag - invoice.betrag)
  const tageDiff = Math.abs(
    (payment.datum - invoice.datum) / (1000 * 60 * 60 * 24)
  )
  
  // Match-Kriterien
  return betragDiff <= 0.50 && tageDiff <= 1
}

// Ranking: Beste Übereinstimmung
payments.sort((a, b) => 
  Math.abs(a.betrag - rechnung.betrag) - Math.abs(b.betrag - rechnung.betrag)
)
const besteZahlung = payments[0]
```

#### Fuzzy-String-Matching (für Namen)
```typescript
import Fuse from 'fuse.js'

const fuse = new Fuse(kreditoren, {
  keys: ['name'],
  threshold: 0.3 // 70% Übereinstimmung
})

const matches = fuse.search(rechnung.lieferant)
```

### 3. Error-Handling

```typescript
try {
  // DB Operation
  const result = await db.collection('...').find({})
  
  return NextResponse.json({
    ok: true,
    data: result
  })
  
} catch (error) {
  console.error('[API Name] Fehler:', error)
  
  return NextResponse.json(
    { ok: false, error: error.message },
    { status: 500 }
  )
}
```

## Performance-Metriken

### Vor Optimierung
```
/api/fibu/uebersicht/complete:  ~15.000ms
/api/fibu/zahlungen:            ~8.000ms
Frontend Initial Load:          ~25.000ms
```

### Nach Optimierung
```
/api/fibu/uebersicht/complete:  ~3.000ms (Cache Hit: ~50ms)
/api/fibu/zahlungen:            ~2.000ms (Cache Hit: ~30ms)
Frontend Initial Load:          ~5.000ms
```

**Verbesserung:** 80% schneller!

## Skalierung

### Aktuelle Kapazität
- **Rechnungen:** ~10.000 pro Jahr
- **Zahlungen:** ~5.000 pro Jahr
- **Kreditoren:** ~500
- **Konten:** 137 (SKR04)

### Skalierungs-Limits
- MongoDB: Keine praktischen Limits
- JTL MSSQL: Query-Performance ab 50.000 Rechnungen beachten
- Caching: Memory-Usage bei großen Datasets

### Empfehlungen bei Wachstum
1. **Archivierung** alter Daten (> 2 Jahre)
2. **Indizes** auf häufig genutzte Felder
3. **Redis** für verteiltes Caching
4. **Read-Replicas** für JTL DB

## Sicherheit

### 1. Daten-Integrität
- Automatische Tests (`test-critical-data.js`)
- Systemkonten können nicht gelöscht werden
- Duplikat-Erkennung bei Imports

### 2. Zugriffs-Schutz
```typescript
// Alle FIBU-APIs sollten Authentifizierung haben
// (Aktuell noch nicht implementiert - TODO!)

if (!session || !session.user) {
  return NextResponse.json(
    { ok: false, error: 'Nicht authentifiziert' },
    { status: 401 }
  )
}
```

### 3. Eingabe-Validierung
```typescript
// Kontonummer validieren
if (!/^\d{4}$/.test(kontonummer)) {
  return NextResponse.json(
    { ok: false, error: 'Kontonummer muss 4-stellig sein' },
    { status: 400 }
  )
}
```

## Deployment-Architektur

### Kubernetes Setup
```yaml
Services:
- nextjs:3000 (Frontend + API)
- mongodb:27017 (Lokal)
- jtl-mssql:49172 (Remote)

Ingress Rules:
- /fibu/* → nextjs:3000
- /api/fibu/* → nextjs:3000
```

### Environment Management
```bash
# Production
MONGO_URL=mongodb://prod-host:27017
JTL_SQL_HOST=prod-jtl-server

# Development
MONGO_URL=mongodb://localhost:27017
JTL_SQL_HOST=dev-jtl-server
```

### Supervisor Configuration
```ini
[program:nextjs]
command=yarn start
directory=/app
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/nextjs.out.log
stderr_logfile=/var/log/supervisor/nextjs.err.log
```

## Monitoring & Logging

### Logs
```bash
# Next.js Logs
tail -f /var/log/supervisor/nextjs.out.log
tail -f /var/log/supervisor/nextjs.err.log

# MongoDB Logs (falls konfiguriert)
tail -f /var/log/mongodb/mongod.log
```

### Health-Checks
```bash
# Services Status
sudo supervisorctl status

# API Health
curl http://localhost:3000/api/fibu/kontenplan

# Daten-Integrität
node test-critical-data.js
```

## Erweiterungspunkte

### 1. Neue Zahlungsquellen hinzufügen
```typescript
// 1. Bank-Import API erweitern
// /app/app/api/fibu/bank-import/route.ts

if (format === 'neue-bank') {
  // Parser implementieren
}

// 2. Zahlungen-API Collection hinzufügen
// /app/app/api/fibu/zahlungen/route.ts

const neueTransaktionen = await db
  .collection('fibu_neue_bank')
  .find({ datum: { $gte: from, $lte: to } })
  .toArray()

alleZahlungen = [...cached, ...bankZahlungen, ...neueTransaktionen]
```

### 2. SUSA Export implementieren
```typescript
// Neue API: /api/fibu/export/susa

GET /api/fibu/export/susa?from=2025-01-01&to=2025-12-31

Response:
- Excel-Datei mit Summen- und Saldenliste
- Format: DATEV-kompatibel
- Gruppierung nach Kontenklassen
```

### 3. Automatische Rechnung-Zahlung-Zuordnung
```typescript
// Cronjob oder API-Endpoint
// Läuft täglich und ordnet offene Zahlungen zu

const offeneZahlungen = await getOffeneZahlungen()
for (const zahlung of offeneZahlungen) {
  const matches = await findMatchingInvoices(zahlung)
  if (matches.length === 1) {
    await assignPaymentToInvoice(zahlung, matches[0])
  }
}
```

## Best Practices

### 1. API-Entwicklung
- IMMER Error-Handling
- IMMER Response-Format: `{ ok: true/false, ... }`
- Logging für Debugging
- Input-Validierung

### 2. Datenbank-Queries
- Indizes auf oft genutzte Felder
- Limit für große Ergebnisse
- Projections nutzen (nur benötigte Felder)
- Aggregation-Pipeline für komplexe Queries

### 3. Frontend
- Loading-States für alle API-Calls
- Error-Boundaries für Fehlerbehandlung
- Optimistic UI-Updates
- Debouncing für Search

---

**Stand:** Januar 2025  
**Version:** 2.0  
**Autor:** SCORE Zentrale Dev Team
