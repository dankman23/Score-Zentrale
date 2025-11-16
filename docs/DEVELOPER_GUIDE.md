# Developer Guide - FIBU Manager

## 👨‍💻 Entwickler-Handbuch

Dieses Dokument richtet sich an Entwickler, die am FIBU Manager arbeiten oder das System erweitern möchten.

## 🛠️ Entwicklungsumgebung einrichten

### 1. Repository klonen

```bash
git clone <repository-url>
cd fibu-manager
```

### 2. Dependencies installieren

```bash
yarn install
```

### 3. Umgebungsvariablen konfigurieren

Datei `.env` erstellen:

```env
# JTL MSSQL (Read-Only)
JTL_DB_SERVER=localhost
JTL_DB_PORT=1433
JTL_DB_DATABASE=jtl_database
JTL_DB_USER=fibu_readonly
JTL_DB_PASSWORD=<password>

# MongoDB (Read/Write)
MONGO_URL=mongodb://localhost:27017/fibu

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Datenbanken vorbereiten

**MongoDB starten:**
```bash
mongod --dbpath /data/fibu
```

**Kontenplan importieren:**
```bash
node scripts/import-kontenplan-skr04.js
```

### 5. Entwicklungsserver starten

```bash
yarn dev
```

App läuft auf: `http://localhost:3000`

## 📚 Code-Struktur verstehen

### Verzeichnis-Übersicht

```
/app/
├── app/                  # Next.js App Directory
│   ├── api/              # Backend API Routes
│   │   └── fibu/         # FIBU-spezifische APIs
│   └── fibu/             # Frontend Pages
│       └── page.js       # FIBU Dashboard
├── components/           # React Components
├── docs/                 # Dokumentation
└── scripts/              # Utility-Skripte
```

### Naming Conventions

**Komponenten:**
- PascalCase: `KontenplanView.js`
- Funktionale Komponenten bevorzugt
- Eine Komponente pro Datei

**API Routes:**
- Kebab-case: `bank-import/route.ts`
- HTTP-Methoden: GET, POST, PUT, DELETE

**Variablen:**
- camelCase: `kontenNachKlasse`
- Konstanten: `UPPER_SNAKE_CASE`

**Datenbank:**
- Collections: `fibu_konten` (snake_case)
- Felder: camelCase im Code, snake_case in DB

## 🔧 Neue API erstellen

### Schritt 1: Route-Datei erstellen

```bash
touch app/api/fibu/meine-api/route.ts
```

### Schritt 2: Handler implementieren

```typescript
// app/api/fibu/meine-api/route.ts
import { NextResponse } from 'next/server'
import { connectMongo } from '@/lib/mongodb'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const param = searchParams.get('param')
    
    // Validierung
    if (!param) {
      return NextResponse.json(
        { ok: false, error: 'Parameter fehlt' },
        { status: 400 }
      )
    }
    
    // Datenbank-Abfrage
    const db = await connectMongo()
    const result = await db.collection('my_collection')
      .find({ field: param })
      .toArray()
    
    return NextResponse.json({
      ok: true,
      data: result
    })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validierung
    if (!body.field) {
      return NextResponse.json(
        { ok: false, error: 'Feld fehlt' },
        { status: 400 }
      )
    }
    
    // Daten speichern
    const db = await connectMongo()
    const result = await db.collection('my_collection')
      .insertOne({
        ...body,
        created_at: new Date()
      })
    
    return NextResponse.json({
      ok: true,
      id: result.insertedId
    })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### Schritt 3: Frontend einbinden

```javascript
// components/MeineKomponente.js
import { useState, useEffect } from 'react'

export default function MeineKomponente() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    try {
      const res = await fetch('/api/fibu/meine-api?param=wert')
      const json = await res.json()
      
      if (json.ok) {
        setData(json.data)
      } else {
        console.error(json.error)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) return <div>Lädt...</div>
  
  return (
    <div>
      {data.map(item => (
        <div key={item._id}>{item.name}</div>
      ))}
    </div>
  )
}
```

## 🔌 Datenbankverbindungen

### MongoDB Helper

```javascript
// lib/mongodb.js
import { MongoClient } from 'mongodb'

let cachedClient = null
let cachedDb = null

export async function connectMongo() {
  if (cachedDb) {
    return cachedDb
  }
  
  const client = await MongoClient.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  
  const db = client.db('fibu')
  
  cachedClient = client
  cachedDb = db
  
  return db
}
```

### MSSQL Helper

```javascript
// lib/mssql.js
import sql from 'mssql'

let pool = null

export async function connectMSSQL() {
  if (pool) {
    return pool
  }
  
  pool = await sql.connect({
    server: process.env.JTL_DB_SERVER,
    port: parseInt(process.env.JTL_DB_PORT),
    database: process.env.JTL_DB_DATABASE,
    user: process.env.JTL_DB_USER,
    password: process.env.JTL_DB_PASSWORD,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  })
  
  return pool
}
```

## 🧩 React Best Practices

### 1. State Management

```javascript
// Lokaler State für UI
const [isOpen, setIsOpen] = useState(false)

// State für API-Daten
const [data, setData] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)

// Derived State (kein useState)
const filteredData = data.filter(item => item.active)
```

### 2. useEffect Patterns

```javascript
// Daten beim Mount laden
useEffect(() => {
  loadData()
}, [])

// Daten neu laden bei Änderung
useEffect(() => {
  loadData()
}, [dateRange])  // Dependencies!

// Cleanup bei Unmount
useEffect(() => {
  const interval = setInterval(() => {
    refreshData()
  }, 5000)
  
  return () => clearInterval(interval)
}, [])
```

### 3. Error Handling

```javascript
const loadData = async () => {
  setLoading(true)
  setError(null)
  
  try {
    const res = await fetch('/api/data')
    const json = await res.json()
    
    if (!json.ok) {
      throw new Error(json.error)
    }
    
    setData(json.data)
  } catch (err) {
    setError(err.message)
    console.error('Load error:', err)
  } finally {
    setLoading(false)
  }
}
```

### 4. Custom Hooks

```javascript
// hooks/useFibuData.js
export function useFibuData(endpoint, params = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const queryString = new URLSearchParams(params).toString()
        const res = await fetch(`/api/fibu/${endpoint}?${queryString}`)
        const json = await res.json()
        
        if (json.ok) {
          setData(json.data || json)
        } else {
          setError(json.error)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [endpoint, JSON.stringify(params)])
  
  return { data, loading, error }
}

// Verwendung:
function MyComponent() {
  const { data, loading, error } = useFibuData('kontenplan')
  
  if (loading) return <div>Lädt...</div>
  if (error) return <div>Fehler: {error}</div>
  
  return <div>{/* Render data */}</div>
}
```

## 💡 Coding Guidelines

### API Response Format

Immer einheitliches Format:

```typescript
// Erfolg
{
  ok: true,
  data: any,
  message?: string
}

// Fehler
{
  ok: false,
  error: string,
  details?: any
}
```

### Error Handling

```typescript
// Backend
try {
  // ... logic
} catch (error) {
  console.error('[API_NAME] Error:', error)
  return NextResponse.json(
    { 
      ok: false, 
      error: 'Benutzerfreundliche Nachricht',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    { status: 500 }
  )
}
```

### Validierung

```typescript
// Zod für Schema-Validierung
import { z } from 'zod'

const KontoSchema = z.object({
  kontonummer: z.string().regex(/^\d{4}$/),
  bezeichnung: z.string().min(1),
  kontenklasse: z.number().int().min(0).max(9)
})

try {
  const validated = KontoSchema.parse(body)
  // ... use validated data
} catch (error) {
  return NextResponse.json(
    { ok: false, error: 'Validierungsfehler', details: error.errors },
    { status: 400 }
  )
}
```

### Logging

```javascript
// Strukturiertes Logging
console.log('[MODULE] Action:', { context })
console.error('[MODULE] Error:', error)

// Für Produktion: Winston oder Pino
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})
```

## 🧪 Testing

### Manuelle Tests

**Test-Checklist vor Deployment:**

```bash
# 1. Kritische APIs testen
node scripts/test-critical-data.js

# 2. JTL-Verbindung prüfen
curl http://localhost:3000/api/fibu/zahlungen?from=2025-01-01&to=2025-01-31

# 3. MongoDB-Verbindung prüfen
curl http://localhost:3000/api/fibu/kontenplan

# 4. Bank-Import testen
# CSV hochladen und Ergebnis prüfen

# 5. Externe Rechnungen testen
curl http://localhost:3000/api/fibu/rechnungen/extern?from=2025-10-01&to=2025-10-31
```

### Unit Tests (Optional)

```javascript
// __tests__/api/kontenplan.test.js
import { GET, POST } from '@/app/api/fibu/kontenplan/route'

describe('Kontenplan API', () => {
  it('sollte alle Konten zurückgeben', async () => {
    const request = new Request('http://localhost:3000/api/fibu/kontenplan')
    const response = await GET(request)
    const json = await response.json()
    
    expect(json.ok).toBe(true)
    expect(json.konten).toBeInstanceOf(Array)
    expect(json.konten.length).toBeGreaterThan(0)
  })
})
```

## 🚀 Deployment

### Production Build

```bash
# Build erstellen
yarn build

# Production Server starten
yarn start
```

### Supervisor Configuration

```ini
[program:fibu-manager]
command=yarn start
directory=/app
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/fibu.out.log
stderr_logfile=/var/log/supervisor/fibu.err.log
```

### Health Check

```bash
# Server-Status prüfen
curl http://localhost:3000/api/health

# Logs überwachen
tail -f /var/log/supervisor/fibu.out.log
```

## ⚠️ Wichtige Sicherheitsregeln

### 1. JTL-Datenbank

**NIEMALS:**
- Daten löschen
- Schema ändern
- Komplexe JOINs mit DELETE/UPDATE

**IMMER:**
- Read-only User verwenden
- Queries testen
- Separate fetches statt komplexe JOINs

### 2. MongoDB

**IMMER:**
- Validierung vor Insert/Update
- Indizes für Performance
- Backups vor größeren Änderungen

### 3. Kritische APIs

Siehe `docs/CRITICAL_APIS_DO_NOT_BREAK.md`

## 📖 Dokumentation aktualisieren

Bei Änderungen **immer** Dokumentation anpassen:

```bash
# API-Änderung?
→ docs/ARCHITECTURE.md aktualisieren

# Neue Funktion?
→ README.md + spezifisches Doc erstellen

# Bug-Fix an kritischer API?
→ docs/CRITICAL_APIS_DO_NOT_BREAK.md prüfen

# Datenbank-Schema geändert?
→ docs/<MODUL>.md aktualisieren
```

## 👥 Code Review Checklist

- [ ] Code folgt Naming Conventions
- [ ] API nutzt einheitliches Response-Format
- [ ] Error Handling implementiert
- [ ] Validierung vorhanden
- [ ] Keine hardcoded Credentials
- [ ] Logging strukturiert
- [ ] Dokumentation aktualisiert
- [ ] Manuelle Tests durchgeführt
- [ ] Performance OK (< 2s Response-Zeit)
- [ ] Keine Sicherheits-Risiken

## 📝 Git Workflow

### Branch-Strategie

```bash
# Feature-Branch erstellen
git checkout -b feature/meine-funktion

# Änderungen commiten
git add .
git commit -m "feat: Neue Funktion XY hinzugefügt"

# Pushen
git push origin feature/meine-funktion

# Pull Request erstellen
```

### Commit Messages

```
feat: Neue Funktion
fix: Bug-Fix
docs: Dokumentation
refactor: Code-Umstrukturierung
test: Tests hinzugefügt
chore: Wartung
```

## 🔧 Troubleshooting

### Problem: API gibt 500 zurück

```bash
# 1. Logs checken
tail -f /var/log/supervisor/fibu.out.log

# 2. Datenbank-Verbindung testen
mongo
use fibu
db.fibu_konten.find().limit(1)

# 3. JTL-Verbindung testen
node -e "require('./lib/mssql').connectMSSQL().then(() => console.log('OK'))"
```

### Problem: Frontend zeigt keine Daten

```bash
# 1. Browser DevTools öffnen (F12)
# 2. Network-Tab checken
# 3. API-Response prüfen
# 4. Console-Errors checken
```

### Problem: Import schlägt fehl

```bash
# 1. CSV-Format prüfen
head -n 5 kontoauszug.csv

# 2. Encoding prüfen (muss UTF-8 sein)
file -i kontoauszug.csv

# 3. Delimiter prüfen (Semikolon?)
```

---

**Bei Fragen:** Dokumentation konsultieren oder erfahrene Entwickler fragen!

**Letzte Aktualisierung:** November 2025