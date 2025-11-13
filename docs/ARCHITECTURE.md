# Technische Architektur

## 📐 System-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│                    Next.js Frontend (React)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP/API Calls
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                    Next.js Backend (API Routes)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  FIBU API Layer                                           │  │
│  │  - /api/fibu/rechnungen/ek     (EK-Rechnungen)          │  │
│  │  - /api/fibu/rechnungen/vk     (VK-Rechnungen)          │  │
│  │  - /api/fibu/kreditoren        (Kreditoren)             │  │
│  │  - /api/fibu/uebersicht        (Dashboard)              │  │
│  │  - /api/fibu/export/10it       (Export)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│          ┌───────────────────┴──────────────────┐               │
│          │                                      │               │
│    ┌─────▼──────┐                      ┌───────▼─────────┐     │
│    │  MongoDB   │                      │  Python Parser  │     │
│    │  Database  │                      │  (child_process)│     │
│    └─────┬──────┘                      └───────┬─────────┘     │
│          │                                      │               │
└──────────┼──────────────────────────────────────┼───────────────┘
           │                                      │
           │                                      │
     ┌─────▼──────┐                      ┌───────▼─────────┐
     │  MongoDB   │                      │  Gemini API     │
     │  (Local)   │                      │  (emergent)     │
     └────────────┘                      └─────────────────┘
```

## 🗂️ Code-Architektur

### 1. Frontend (React/Next.js)

**Haupt-Entry-Point**: `/app/app/page.js`
- Single Page Application (SPA)
- Hash-basierte Navigation (#/fibu, #/outbound, etc.)
- Client-seitige Komponenten mit `'use client'`

**FIBU-Komponenten**: `/app/components/`

```javascript
FibuCompleteDashboard.js          // Haupt-Dashboard (Tabs, KPIs)
├── KreditorZuordnung.js          // Bulk-Zuordnung von EK zu Kreditoren
├── VKRechnungenView.js           // VK-Rechnungen mit Filterung
├── KontenplanView.js             // Kontenplan-Anzeige
├── BankImport.js                 // CSV-Upload
└── ExportDialog.js               // Export-Konfiguration
```

#### Komponenten-Hierarchie:

```
page.js (Router)
  └── FibuCompleteDashboard
        ├── Header (Zeitraum-Auswahl, Export)
        ├── Tabs (Overview, EK, VK, etc.)
        └── Tab-Content
              ├── Overview: KPI-Cards + Issues
              ├── EK: Tabellarische Anzeige
              ├── Zuordnung: KreditorZuordnung Component
              ├── VK: VKRechnungenView Component
              ├── Zahlungen: Tabelle
              ├── Bank-Import: BankImport Component
              └── Kontenplan: KontenplanView Component
```

### 2. Backend (Next.js API Routes)

**Route-Struktur**: `/app/app/api/fibu/`

```
api/fibu/
├── uebersicht/
│   └── complete/route.ts        # Dashboard-Daten (SLOW!)
├── rechnungen/
│   ├── ek/
│   │   ├── route.ts             # GET/POST EK-Rechnungen
│   │   ├── [id]/route.ts        # GET/PUT/DELETE einzelne Rechnung
│   │   ├── upload/route.ts      # PDF-Upload
│   │   └── batch-process/route.ts # Batch-Verarbeitung
│   ├── vk/
│   │   └── route.ts             # GET VK-Rechnungen (JTL + MongoDB)
│   └── extern/route.ts          # GET externe Rechnungen (Amazon)
├── kreditoren/
│   └── route.ts                 # GET/POST Kreditoren
├── zahlungen/route.ts           # GET Zahlungen
├── gutschriften/route.ts        # GET Gutschriften
├── kontenplan/route.ts          # GET Kontenplan
├── bank-import/route.ts         # POST CSV, GET Transaktionen
└── export/
    └── 10it/route.ts            # GET CSV-Export
```

#### API-Design-Pattern:

```typescript
// Standard API Route Structure
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const searchParams = request.nextUrl.searchParams
    
    // Query Parameters
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    // Database Query
    const results = await db.collection('fibu_ek_rechnungen')
      .find({ /* query */ })
      .limit(limit)
      .toArray()
    
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### 3. Datenbank-Layer

**MongoDB-Connection**: `/app/app/lib/db/mongodb.ts`

```typescript
import { MongoClient, Db } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb
  
  const client = await MongoClient.connect(process.env.MONGO_URL)
  const db = client.db('score_zentrale')
  
  cachedClient = client
  cachedDb = db
  return db
}
```

**MSSQL-Connection**: `/app/app/lib/db/mssql.ts`

```typescript
import sql from 'mssql'

let pool: sql.ConnectionPool | null = null

export async function getJTLConnection(): Promise<sql.ConnectionPool> {
  if (pool) return pool
  
  pool = await sql.connect({
    server: process.env.DB_HOST!,
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  })
  
  return pool
}
```

### 4. Python-Integration

**Parser-Architektur**:

```
Node.js API Route
    |
    | spawn child_process
    |
    v
Python Script (emergent_gemini_parser.py)
    |
    | stdin: { pdf_base64, filename, email_context }
    |
    v
Gemini API (via emergentintegrations)
    |
    | stdout: { success, lieferant, rechnungsnummer, ... }
    |
    v
Node.js (JSON.parse)
    |
    v
MongoDB (fibu_ek_rechnungen)
```

**Code-Beispiel**: API → Python

```typescript
import { spawn } from 'child_process'

const python = spawn('python3', ['/app/python_libs/emergent_gemini_parser.py'])

// Send PDF as JSON via stdin
python.stdin.write(JSON.stringify({
  pdf_base64: pdfBase64,
  filename: 'rechnung.pdf',
  email_context: { from: 'lieferant@example.com' }
}))
python.stdin.end()

// Receive result via stdout
let output = ''
python.stdout.on('data', (data) => output += data.toString())
python.stdout.on('end', () => {
  const result = JSON.parse(output)
  // result = { success: true, lieferant: '...', ... }
})
```

## 🔄 Datenflüsse

### Workflow 1: EK-Rechnung Processing

```
1. PDF kommt via Email → fibu_email_inbox (MongoDB)
2. Batch-Processor erkennt neues PDF
3. Parser-Detection:
   a) Filename-Match? → Nutze spezifischen Parser
   b) Kein Match → Nutze Gemini AI Parser
4. Parsing:
   - Python Script liest PDF
   - Extrahiert: Lieferant, RgNr, Datum, Betrag
5. Kreditor-Matching:
   - Suche in kreditoren Collection
   - Auto-Match wenn eindeutig
6. Speicherung in fibu_ek_rechnungen
7. Dashboard zeigt neue Rechnung an
```

### Workflow 2: VK-Rechnung Anzeige

```
1. User öffnet VK-Rechnungen Tab
2. Frontend → GET /api/fibu/rechnungen/vk?from=...&to=...
3. Backend:
   a) Query MongoDB: fibu_vk_rechnungen
   b) Query MSSQL: JTL tRechnung (falls nicht in Mongo)
   c) Merge beide Datenquellen
4. Debitor-Zuordnung (falls noch nicht vorhanden):
   - Prüfe: IGL-Kunde? (EU + USt-ID + MwSt=0%)
     - JA → Eigener Debitor (10xxx)
     - NEIN → Sammelkonto nach Zahlungsart (69xxx)
5. Response mit vollständigen Daten
6. Frontend rendert Tabelle mit Filterung
```

### Workflow 3: Datenexport (10it)

```
1. User klickt Export-Button
2. Dialog: Zeitraum + Typ auswählen
3. GET /api/fibu/export/10it?from=...&to=...&type=alle
4. Backend sammelt:
   - VK-Rechnungen → Buchungssätze
   - VK-Zahlungen → Buchungssätze
   - EK-Rechnungen → Buchungssätze
   - Gutschriften → Buchungssätze
5. Generiere CSV:
   ```csv
   Konto;Kontobezeichnung;Datum;Belegnummer;Text;Gegenkonto;Soll;Haben;Steuer
   1200;Forderungen;01.10.2025;RE-12345;...;4400;119.00;0.00;19
   ```
6. Download CSV-Datei
```

## 🗄️ Datenbank-Schema (detailliert)

### MongoDB Collections

#### `fibu_ek_rechnungen`
```javascript
{
  _id: ObjectId,
  rechnungsNummer: String,
  rechnungsdatum: Date,
  lieferantName: String,
  gesamtBetrag: Number,
  nettoBetrag: Number,
  steuerbetrag: Number,
  steuersatz: Number,
  kreditorKonto: String,        // z.B. "70001"
  aufwandskonto: String,         // z.B. "5200"
  zahlungId: String,             // Verknüpfung zu fibu_zahlungen
  pdfBase64: String,             // Original PDF
  emailId: String,               // Verknüpfung zu fibu_email_inbox
  parsing_method: String,        // "emergent-gemini" / "python-parser"
  created_at: Date
}
```

#### `fibu_vk_rechnungen`
```javascript
{
  _id: ObjectId,
  kRechnung: Number,             // JTL ID (optional)
  cRechnungsNr: String,          // "RE-12345"
  rechnungsdatum: Date,
  kundenName: String,
  kundenLand: String,            // "DE", "FR", etc.
  kundenUstId: String,           // nur bei IGL
  brutto: Number,
  netto: Number,
  mwst: Number,
  mwstSatz: Number,              // 19, 7, 0
  zahlungsart: String,           // "PayPal", "Rechnung", etc.
  status: String,                // "Bezahlt", "Offen"
  debitorKonto: String,          // "10001" (IGL) oder "69015" (Sammelkonto)
  sachkonto: String,             // "4400" (Erlöse)
  quelle: String,                // "JTL" / "manuell"
  created_at: Date
}
```

#### `kreditoren`
```javascript
{
  _id: ObjectId,
  kreditorenNummer: String,      // "70001" - "79999"
  name: String,
  adresse: Object,
  standardAufwandskonto: String, // "5200"
  created_at: Date
}
```

#### `fibu_igl_debitoren`
```javascript
{
  _id: ObjectId,
  debitorNr: String,             // "10001" - "19999"
  kundenName: String,
  kundenUstId: String,
  kundenLand: String,            // EU-Land
  created_at: Date
}
```

#### `fibu_debitor_regeln`
```javascript
{
  _id: ObjectId,
  typ: String,                   // "sammelkonto" / "igl_ausnahme"
  zahlungsart: String,           // "PayPal", "Amazon", etc.
  debitorNr: String,             // "69015", "69002", etc.
  bezeichnung: String
}
```

### MSSQL (JTL) Schema

#### `tRechnung`
```sql
kRechnung           INT PRIMARY KEY
cRechnungsNr        NVARCHAR(50)
dErstellt           DATETIME
fGesamtsumme        DECIMAL(18,2)
cStatus             NVARCHAR(20)
kKunde              INT
```

#### `tZahlungseingang`
```sql
kZahlungseingang    INT PRIMARY KEY
dZahlungsdatum      DATETIME
fBetrag             DECIMAL(18,2)
cZahlungsanbieter   NVARCHAR(50)
kRechnung           INT
```

## ⚡ Performance-Überlegungen

### Aktuelles Problem: `/api/fibu/uebersicht/complete`

**Ist-Zustand** (Langsam - 5-15 Sek.):
```typescript
// Macht 5 separate API-Calls:
const vkResponse = await fetch('/api/fibu/rechnungen/vk?...')
const externResponse = await fetch('/api/fibu/rechnungen/extern?...')
const zahlungenResponse = await fetch('/api/fibu/zahlungen?...')
const gutschriftenResponse = await fetch('/api/fibu/gutschriften?...')
```

**Soll-Zustand** (Schnell - <2 Sek.):
```typescript
// Direkte DB-Queries:
const [ek, vk, zahlungen, extern, gutschriften] = await Promise.all([
  db.collection('fibu_ek_rechnungen').find({...}).toArray(),
  db.collection('fibu_vk_rechnungen').find({...}).toArray(),
  db.collection('fibu_zahlungen').find({...}).toArray(),
  db.collection('fibu_externe_rechnungen').find({...}).toArray(),
  db.collection('fibu_gutschriften').find({...}).toArray()
])
```

### Caching-Strategie

```typescript
// In-Memory Cache für statische Daten
const kontenplanCache = new Map()

export async function getKontenplan() {
  if (kontenplanCache.has('kontenplan')) {
    return kontenplanCache.get('kontenplan')
  }
  
  const db = await getDb()
  const kontenplan = await db.collection('kontenplan').find({}).toArray()
  kontenplanCache.set('kontenplan', kontenplan)
  return kontenplan
}
```

## 🔐 Sicherheit

### Umgebungsvariablen
- Alle Secrets in `.env`
- NIEMALS in Git committen
- Server-seitige Validierung bei allen API-Calls

### Datenbank-Zugriff
- MongoDB: Nur via Server-Side API Routes
- MSSQL (JTL): Read-Only Zugriff
- Keine direkten DB-Credentials im Frontend

## 🧪 Testing-Überlegungen

```bash
# API Tests mit curl
curl -X GET "http://localhost:3000/api/fibu/rechnungen/ek?limit=10"

# Python Parser Test
echo '{"pdf_base64":"..."}' | python3 /app/python_libs/emergent_gemini_parser.py

# Script Tests
node /app/scripts/apply-debitor-regeln.js
```

## 📦 Deployment-Struktur

```
Kubernetes Pod
├── Next.js App (Port 3000)
├── MongoDB (Port 27017)
├── Python Runtime
└── Supervisor (Process Management)
```

### Supervisor Config:
```ini
[program:nextjs]
command=yarn dev
directory=/app/app
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/nextjs.out.log
stderr_logfile=/var/log/supervisor/nextjs.err.log
```

---

**Letzte Aktualisierung**: Januar 2025