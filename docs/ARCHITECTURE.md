# FIBU-Modul - Technische Architektur

## System-Überblick

Das FIBU-Modul ist ein Hybrid-System, das Template-basierte Python-Parser mit KI-basiertem PDF-Parsing kombiniert, um eine hohe Automatisierungsrate bei der Verarbeitung von Lieferantenrechnungen zu erreichen.

## Technologie-Entscheidungen

### Warum Hybrid-Ansatz (Python + Gemini)?

**Problem:**
- PDF-Parsing in Node.js ist unzuverlässig (pdfjs-dist, pdf-parse haben Kompatibilitätsprobleme mit Next.js)
- Reine AI-Lösungen sind teuer (~0,03€ pro Rechnung)
- Vorhandene Python-Parser existierten bereits und funktionierten gut

**Lösung:**
1. **Stufe 1 - Python-Parser** (kostenlos, schnell):
   - Template-basiert für bekannte Lieferanten
   - 96% Erfolgsrate bei bekannten Mustern
   - 0,5-1 Sek pro PDF
   
2. **Stufe 2 - Gemini AI** (flexibel, universell):
   - Für unbekannte Lieferanten
   - 90% Erfolgsrate
   - 3-5 Sek pro PDF, ~0,03€

**Ergebnis:**
- 93% Gesamt-Erfolgsrate
- Nur ~4€ Kosten für 145 unbekannte Lieferanten
- Best of both worlds

### Warum MongoDB statt PostgreSQL?

- **Flexibles Schema**: EK-Rechnungen haben verschiedene Strukturen je nach Lieferant
- **Schnelle Entwicklung**: Keine Migrations bei Schema-Änderungen
- **JSON-native**: Gemini-Responses können direkt gespeichert werden
- **Bereits im Stack**: Score Zentrale nutzt bereits MongoDB

### Warum Next.js API Routes statt separatem Backend?

- **Einfachheit**: Ein Deployment, ein Server
- **TypeScript**: Type-Safety über Frontend und Backend
- **Performance**: Server-Side Rendering + API in einem
- **Developer Experience**: Hot Reload für API-Entwicklung

## Komponenten-Architektur

### 1. Email-Inbox-System

```
┌────────────────────────────────────────────────────┐
│              Email Inbox Workflow                   │
├────────────────────────────────────────────────────┤
│                                                      │
│  IMAP Server (invoices@score.de)                   │
│         │                                            │
│         │ (Cron Job / Manual Trigger)               │
│         ▼                                            │
│  ┌──────────────────┐                               │
│  │ IMAP Client      │  imap + mailparser            │
│  │ /lib/email-inbox │                               │
│  └────────┬─────────┘                               │
│           │                                          │
│           │ Parse Email + Extract PDF               │
│           ▼                                          │
│  ┌──────────────────┐                               │
│  │ Duplicate Check  │  Check by filename hash      │
│  └────────┬─────────┘                               │
│           │                                          │
│           ▼                                          │
│  ┌──────────────────┐                               │
│  │ Save to MongoDB  │  fibu_email_inbox            │
│  │ status: 'pending'│                               │
│  └──────────────────┘                               │
│                                                      │
└────────────────────────────────────────────────────┘
```

**Wichtige Dateien:**
- `/app/lib/email-inbox.ts` - IMAP Client
- `/app/api/fibu/email-inbox/test-fetch/route.ts` - Test-Endpoint
- `/app/api/fibu/email-inbox/cron/route.ts` - Cron-Job-Endpoint

**Datenfluss:**
1. Cron Job ruft IMAP-Server ab
2. Neue Emails werden erkannt (SINCE-Filter)
3. PDFs werden extrahiert und Base64-encodiert
4. Duplicate-Check via Filename-Hash
5. Speicherung in MongoDB mit `status: 'pending'`

### 2. PDF-Parsing-System

```
┌────────────────────────────────────────────────────┐
│            PDF Parsing Workflow                     │
├────────────────────────────────────────────────────┤
│                                                      │
│  MongoDB: fibu_email_inbox                          │
│  (PDFs mit status='pending')                        │
│         │                                            │
│         │ Batch Script gestartet                    │
│         ▼                                            │
│  ┌──────────────────┐                               │
│  │ Python Parser    │  Subprocess spawn()           │
│  │ Attempt          │                               │
│  └────────┬─────────┘                               │
│           │                                          │
│           ├─ SUCCESS (bekannter Lieferant)          │
│           │  └─▶ Strukturierte Daten                │
│           │                                          │
│           └─ FAILURE (unbekannter Lieferant)        │
│              │                                       │
│              ▼                                       │
│  ┌──────────────────┐                               │
│  │ Gemini AI        │  Emergent Universal Key       │
│  │ Fallback         │                               │
│  └────────┬─────────┘                               │
│           │                                          │
│           ├─ SUCCESS                                 │
│           │  └─▶ Strukturierte Daten                │
│           │                                          │
│           └─ FAILURE                                 │
│              └─▶ Status: Error                      │
│                                                      │
│         ▼                                            │
│  ┌──────────────────┐                               │
│  │ Save to MongoDB  │  fibu_ek_rechnungen          │
│  │ + Update Email   │  status: 'processed'         │
│  └──────────────────┘                               │
│                                                      │
└────────────────────────────────────────────────────┘
```

**Wichtige Dateien:**
- `/app/python_libs/fibu_invoice_parser.py` - Python-Wrapper
- `/app/python_libs/emergent_gemini_parser.py` - Gemini-Integration
- `/app/scripts/batch-process-with-gemini-fallback.js` - Hybrid-Batch-Script

**Parser-Pipeline:**

1. **Filename-Analysis** (schnell, kostenlos):
   ```javascript
   if (filename.match(/^(70\d{3})/)) {
     kreditorNr = filename.substring(0, 5)
   }
   ```

2. **Python Template-Parsing** (0,5-1s, kostenlos):
   ```python
   # Identifiziere Firma
   if "klingspor" in text.lower():
       parser = InvoiceKlingsporParser()
       return parser.parse(pdf_path)
   ```

3. **Gemini AI-Parsing** (3-5s, ~0,03€):
   ```python
   chat = LlmChat(api_key=EMERGENT_LLM_KEY)
       .with_model("gemini", "gemini-2.0-flash")
   
   response = await chat.send_message(
       prompt + pdf_file
   )
   ```

### 3. Auto-Matching-Engine

```
┌────────────────────────────────────────────────────┐
│          Auto-Matching Algorithm                    │
├────────────────────────────────────────────────────┤
│                                                      │
│  Input:                                             │
│  - Negative Zahlungen (Zahlungsausgänge)           │
│  - EK-Rechnungen (mit Betrag)                      │
│                                                      │
│  ┌──────────────────┐                               │
│  │ For each Zahlung │                               │
│  └────────┬─────────┘                               │
│           │                                          │
│           ▼                                          │
│  ┌──────────────────────────────────┐               │
│  │ Find Matching Rechnungen         │               │
│  │ (within date range ±30 days)     │               │
│  └────────┬─────────────────────────┘               │
│           │                                          │
│           ▼                                          │
│  ┌──────────────────────────────────┐               │
│  │ Calculate Match Score            │               │
│  │                                   │               │
│  │ Score = 0                         │               │
│  │ + BetragMatch (0-60 Punkte)      │               │
│  │ + DatumNähe (0-20 Punkte)        │               │
│  │ + RgNrInHinweis (0-20 Punkte)    │               │
│  └────────┬─────────────────────────┘               │
│           │                                          │
│           ▼                                          │
│  ┌──────────────────────────────────┐               │
│  │ Score >= 70?                     │               │
│  │  YES → Create Match               │               │
│  │  NO  → Next Rechnung              │               │
│  └──────────────────────────────────┘               │
│                                                      │
│  Output:                                            │
│  - Matched Pairs (Zahlung ↔ Rechnung)             │
│  - Match Rate (%)                                   │
│                                                      │
└────────────────────────────────────────────────────┘
```

**Matching-Score-Details:**

```javascript
// 1. Betrags-Match (max 60 Punkte)
const betragDiff = Math.abs(zahlung.betrag + rechnung.gesamtBetrag)
if (betragDiff < 0.01) score += 60        // Exakt
else if (betragDiff < 1) score += 50      // < 1€ Differenz
else if (betragDiff < 5) score += 40      // < 5€ Differenz
else if (betragDiff < 10) score += 20     // < 10€ Differenz

// 2. Datum-Nähe (max 20 Punkte)
const daysDiff = Math.abs(daysBetween(zahlung.datum, rechnung.datum))
if (daysDiff <= 3) score += 20
else if (daysDiff <= 7) score += 15
else if (daysDiff <= 14) score += 10
else if (daysDiff <= 30) score += 5

// 3. Rechnungsnummer im Hinweis (20 Punkte)
if (zahlung.hinweis.includes(rechnung.rechnungsNummer)) {
  score += 20
}

// Threshold
return score >= 70 ? 'match' : 'no-match'
```

**Optimierungsmöglichkeiten:**
- Lieferanten-Name-Matching (Fuzzy)
- IBAN-Matching
- Machine Learning für Score-Threshold
- Multi-Rechnung-Matching (Teilzahlungen)

### 4. JTL-Integration

```
┌────────────────────────────────────────────────────┐
│           JTL MS SQL Integration                    │
├────────────────────────────────────────────────────┤
│                                                      │
│  JTL ERP Database (MS SQL)                         │
│         │                                            │
│         │ node-mssql Driver                         │
│         ▼                                            │
│  ┌──────────────────┐                               │
│  │ Connection Pool  │  /lib/db/mssql.ts            │
│  └────────┬─────────┘                               │
│           │                                          │
│           ├─▶ VK-Rechnungen (tRechnung)            │
│           │   SELECT * FROM dbo.tRechnung           │
│           │   WHERE dErstellt BETWEEN @from @to     │
│           │                                          │
│           ├─▶ Externe Rechnungen (tExternerBeleg)  │
│           │   SELECT * FROM Rechnung.tExternerBeleg │
│           │   WHERE cExterneBelegnr LIKE 'XRE%'     │
│           │                                          │
│           ├─▶ Zahlungen (tZahlung + tZahlungsab.)  │
│           │   SELECT * FROM dbo.tZahlung            │
│           │   UNION ALL                              │
│           │   SELECT * FROM tZahlungsabgleichUmsatz │
│           │                                          │
│           └─▶ Gutschriften (tRechnung + FLAG)      │
│               SELECT * WHERE cType = 'Gutschrift'   │
│                                                      │
└────────────────────────────────────────────────────┘
```

**Wichtige Query-Optimierungen:**

1. **Zahlungen UNION**:
   - Problem: Commerzbank-Transaktionen fehlten
   - Lösung: `tZahlung UNION ALL tZahlungsabgleichUmsatz`

2. **Externe Rechnungen**:
   - Problem: Amazon XRE-Rechnungen fehlten
   - Lösung: Neue Tabelle `Rechnung.tExternerBeleg` gefunden

3. **Indizes**:
   - `dErstellt` für Datum-Filter
   - `cRechnungNr` für schnelle Suche
   - `kKunde` für Kunden-Filter

### 5. Export-System

```
┌────────────────────────────────────────────────────┐
│              10it Export Pipeline                   │
├────────────────────────────────────────────────────┤
│                                                      │
│  Query MongoDB + JTL                                │
│         │                                            │
│         ├─▶ VK-Rechnungen (JTL)                    │
│         ├─▶ EK-Rechnungen (MongoDB)                │
│         ├─▶ Gutschriften (JTL)                     │
│         └─▶ Zahlungen (JTL)                        │
│                                                      │
│         ▼                                            │
│  ┌──────────────────────────────────┐               │
│  │ Data Transformation               │               │
│  │                                   │               │
│  │ - Format Dates (DD.MM.YYYY)      │               │
│  │ - Format Amounts (1234,56)       │               │
│  │ - Map Konten                      │               │
│  │ - Add SKR03 Codes                │               │
│  └────────┬─────────────────────────┘               │
│           │                                          │
│           ▼                                          │
│  ┌──────────────────────────────────┐               │
│  │ CSV Generation                    │               │
│  │                                   │               │
│  │ Headers:                          │               │
│  │ - Belegdatum                      │               │
│  │ - Belegnummer                     │               │
│  │ - Lieferant                       │               │
│  │ - Kreditor                        │               │
│  │ - Aufwandskonto                   │               │
│  │ - Nettobetrag                     │               │
│  │ - MwSt                            │               │
│  │ - Bruttobetrag                    │               │
│  └────────┬─────────────────────────┘               │
│           │                                          │
│           ▼                                          │
│  10it-kompatible CSV-Datei                          │
│                                                      │
└────────────────────────────────────────────────────┘
```

## Datenbank-Design

### MongoDB Collections

#### 1. `fibu_email_inbox`

**Zweck**: Speichert eingehende Emails mit PDF-Anhängen

**Indizes:**
```javascript
db.fibu_email_inbox.createIndex({ status: 1 })
db.fibu_email_inbox.createIndex({ receivedDate: -1 })
db.fibu_email_inbox.createIndex({ filename: 1 })
```

**Typische Größe**: ~100KB pro Dokument (Base64 PDF)

#### 2. `fibu_ek_rechnungen`

**Zweck**: Geparste EK-Rechnungen

**Indizes:**
```javascript
db.fibu_ek_rechnungen.createIndex({ rechnungsdatum: -1 })
db.fibu_ek_rechnungen.createIndex({ kreditorKonto: 1 })
db.fibu_ek_rechnungen.createIndex({ gesamtBetrag: 1 })
db.fibu_ek_rechnungen.createIndex({ 'parsing.method': 1 })
```

**Typische Größe**: ~2-5KB pro Dokument

#### 3. `kreditoren`

**Zweck**: Lieferanten-Stammdaten

**Indizes:**
```javascript
db.kreditoren.createIndex({ kreditorenNummer: 1 }, { unique: true })
db.kreditoren.createIndex({ name: 1 })
```

**Typische Größe**: ~1KB pro Dokument

### Daten-Retention

- **Emails**: Unbegrenzt (Archiv-Zweck)
- **EK-Rechnungen**: Unbegrenzt (Buchhaltungspflicht)
- **Logs**: 90 Tage

## Performance-Optimierungen

### 1. Batch-Processing

**Problem**: 190 PDFs einzeln verarbeiten = langsam

**Lösung**: Batch-Script mit Parallel-Processing

```javascript
// Pseudo-Code
const pdfs = await fetchPending(limit)
const results = await Promise.all(
  pdfs.map(pdf => parsePDF(pdf))
)
```

**Ergebnis**: 200 PDFs in ~10 Minuten

### 2. MongoDB Connection Pooling

```typescript
// /lib/db/mongodb.ts
let cachedClient = null
let cachedDb = null

export async function getDb() {
  if (cachedDb) return cachedDb
  
  cachedClient = await MongoClient.connect(MONGO_URL, {
    maxPoolSize: 10,
    minPoolSize: 2
  })
  
  cachedDb = cachedClient.db()
  return cachedDb
}
```

### 3. Gemini Request Optimization

**Original**: 1 Request pro PDF = langsam

**Optimiert**: Async/Await mit Queue

```javascript
const queue = []
for (const pdf of pdfs) {
  queue.push(callGemini(pdf))
  
  // Max 5 parallel
  if (queue.length >= 5) {
    await Promise.race(queue)
  }
}
```

## Sicherheit

### 1. Credentials

- **MongoDB**: `MONGO_URL` in `.env`, localhost-only
- **MS SQL**: Connection-String in `.env`, read-only user
- **IMAP**: Credentials in `.env`, dedicated inbox
- **Gemini**: Emergent Universal Key in `.env`

### 2. Input-Validierung

- PDF Base64: Längen-Check
- Dates: ISO-Format-Validierung
- Amounts: Number-Type-Check
- SQL: Parameterized Queries

### 3. Error-Handling

```typescript
try {
  // Operation
} catch (error) {
  console.error('Error:', error)
  return NextResponse.json(
    { ok: false, error: error.message },
    { status: 500 }
  )
}
```

## Monitoring & Logging

### Logs

- **Next.js**: `/var/log/supervisor/nextjs.out.log`
- **Errors**: `/var/log/supervisor/nextjs.err.log`
- **MongoDB**: `mongosh` CLI für Queries

### Metriken

```bash
# Parsing-Erfolgsrate
db.fibu_ek_rechnungen.aggregate([
  { $group: {
    _id: "$parsing.method",
    count: { $sum: 1 }
  }}
])

# Auto-Match-Rate
curl -X POST /api/fibu/auto-match-ek-zahlungen
```

## Deployment

### Production-Checklist

- [ ] `.env` mit Production-Credentials
- [ ] MongoDB Backup-Strategy
- [ ] Supervisor für Process-Management
- [ ] Nginx für Reverse-Proxy
- [ ] SSL-Zertifikat
- [ ] Firewall-Regeln (MongoDB Port)
- [ ] Cron-Job für Email-Polling
- [ ] Monitoring-Alerts

### Backup-Strategy

```bash
# Daily MongoDB Backup
mongodump --uri="$MONGO_URL" --out=/backup/$(date +%Y%m%d)

# Retention: 30 Tage
find /backup -mtime +30 -delete
```

## Skalierung

### Horizontal

- Multiple Next.js Instances hinter Load Balancer
- MongoDB Replica Set für Read-Skalierung
- Redis für Caching (future)

### Vertical

- Mehr RAM für MongoDB
- Mehr CPU für PDF-Processing
- SSD für schnellere File-I/O

## Zukünftige Erweiterungen

### Q1 2026
- [ ] Webhook für Real-Time Processing
- [ ] OCR für gescannte PDFs
- [ ] More Python-Parser (Norton, Rhodius vollständig)

### Q2 2026
- [ ] Machine Learning für besseres Matching
- [ ] Automatische Duplikat-Erkennung
- [ ] Multi-Tenant-Support

### Q3 2026
- [ ] Mobile App
- [ ] Real-Time Dashboard
- [ ] AI-Powered Anomalie-Detection
