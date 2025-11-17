# System-Architektur - FIBU Accounting Hub

## 🏗️ Übersicht

Das FIBU Accounting Hub ist eine **Full-Stack Next.js Anwendung**, die als zentrale Buchhaltungsplattform fungiert und Daten aus mehreren Quellen konsolidiert.

## 📊 Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│                   Next.js Frontend (React)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ HTTP/REST
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  Next.js API Routes (Backend)                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ FIBU APIs    │  │ JTL APIs     │  │ Import APIs     │  │
│  │ /api/fibu/*  │  │ /api/jtl/*   │  │ /api/import/*   │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└────────┬─────────────────┬──────────────────┬──────────────┘
         │                 │                  │
         │                 │                  │
    ┌────▼──────┐    ┌────▼──────┐    ┌─────▼──────────┐
    │  MongoDB  │    │   MSSQL   │    │ External APIs  │
    │  (Local)  │    │   (JTL)   │    │ Amazon, eBay,  │
    │           │    │           │    │ PayPal         │
    └───────────┘    └───────────┘    └────────────────┘
```

## 🔧 Technologie-Stack

### Frontend Layer

**Framework:** Next.js 14 (App Router)
- Server-Side Rendering (SSR)
- Client Components für Interaktivität
- Optimierte Performance durch Route Caching

**UI Libraries:**
- React 18
- Tailwind CSS (Utility-First)
- Shadcn/ui (Komponenten-Bibliothek)
- Lucide Icons

**State Management:**
- React useState/useEffect (Component State)
- Keine externe State Library (bewusste Entscheidung)

### Backend Layer

**API Framework:** Next.js API Routes
- RESTful Endpoints
- Server-only Code
- TypeScript für Type Safety

**Datenbank-Verbindungen:**
```typescript
// MongoDB (Singleton Pattern)
import { getDb } from '@/lib/db/mongodb'

// MSSQL (Connection Pool)
import { getJTLConnection } from '@/lib/db/mssql'
```

### Datenbank Layer

#### MongoDB (Port 27017)
**Zweck:** Finanzdaten, Cache, Mappings

**Collections:**
- `fibu_kontenplan` - SKR04 Kontenplan
- `fibu_kreditoren` - Kreditorenstamm
- `fibu_bank_transaktionen` - Postbank Import
- `fibu_zahlungen` - Zahlungs-Cache
- `kreditoren` - Legacy (wird migriert)

#### MSSQL (JTL-Wawi Datenbank)
**Zweck:** Read-Only Zugriff auf JTL-Daten

**Wichtige Schemas:**
- `dbo.*` - Standard-Tabellen
- `Rechnung.*` - Rechnungen, Externe Belege

**Wichtige Tabellen:**
- `tZahlung` - Zahlungen
- `tZahlungsabgleichUmsatz` - Bank-Abgleich
- `tRechnung` - Rechnungen
- `tLieferant` - Lieferanten
- `pf_amazon_settlement` - Amazon Settlements
- `pf_amazon_settlementpos` - Amazon Settlement-Positionen

## 🔄 Datenfluss

### Beispiel: Zahlung anzeigen

```
1. User öffnet /fibu → Zahlungen Tab
   ↓
2. Frontend: ZahlungenView.js lädt
   ↓
3. API Call: GET /api/fibu/zahlungen?from=...&to=...
   ↓
4. Backend:
   a) Lädt aus MongoDB Cache
   b) Falls leer/veraltet:
      - Query JTL (tZahlung, tZahlungsabgleichUmsatz)
      - Query MongoDB (fibu_bank_transaktionen)
      - Kombiniert Daten
      - Speichert Cache
   ↓
5. Response: JSON mit allen Zahlungen
   ↓
6. Frontend: Rendering in Tabelle
```

### Beispiel: Konten-Zuordnung

```
1. User klickt "Zuordnen" bei einer Zahlung
   ↓
2. Modal öffnet: ZuordnungsModal
   ↓
3. User wählt: "Mit Buchungskonto verknüpfen"
   ↓
4. User wählt Konto: 6850 (Telefon/Internet)
   ↓
5. API Call: PUT /api/fibu/zahlungen
   Body: { zahlungId, quelle, zuordnungsArt: 'konto', kontonummer: '6850' }
   ↓
6. Backend:
   - Update MongoDB (fibu_bank_transaktionen oder fibu_zahlungen)
   - Setzt: zugeordnetesKonto, zuordnungsArt, istZugeordnet
   ↓
7. Response: { ok: true }
   ↓
8. Frontend: Reload & Anzeige-Update
```

## 🗂️ Code-Organisation

### API-Routen Pattern

```typescript
// /app/app/api/fibu/[modul]/route.ts

export async function GET(request: NextRequest) {
  try {
    // 1. Parameter validieren
    const searchParams = request.nextUrl.searchParams
    
    // 2. Datenbank-Abfrage
    const db = await getDb()
    const data = await db.collection('...').find().toArray()
    
    // 3. Response
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### Komponenten-Pattern

```javascript
// /app/components/ModulView.js
'use client'

import { useState, useEffect } from 'react'

export default function ModulView() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function loadData() {
      const res = await fetch('/api/fibu/modul')
      const json = await res.json()
      setData(json.data)
      setLoading(false)
    }
    loadData()
  }, [])
  
  if (loading) return <div>Laden...</div>
  
  return (
    <div className="p-6">
      {/* UI */}
    </div>
  )
}
```

## 🔐 Sicherheits-Architektur

### Environment Variables

```bash
# ⚠️ NIEMALS committen!
MONGO_URL=mongodb://localhost:27017
MSSQL_SERVER=localhost
MSSQL_USER=SA
MSSQL_PASSWORD=***
```

### API Security

- **Server-Only:** Alle sensiblen Operations in API Routes
- **No Client Secrets:** Keine API-Keys im Browser
- **Input Validation:** Alle User-Inputs validiert
- **SQL Injection Prevention:** Parameterized Queries

## 📈 Performance-Optimierungen

### 1. Caching-Strategie

**MongoDB als Cache für JTL-Daten:**
```javascript
// Cache für 1 Stunde
const cacheKey = `zahlungen_${from}_${to}`
const cached = await db.collection('cache').findOne({ key: cacheKey })

if (cached && Date.now() - cached.timestamp < 3600000) {
  return cached.data
}

// Sonst: Fresh Load + Cache Update
```

### 2. Lazy Loading

- Komponenten werden nur bei Bedarf geladen
- Tabs laden Daten erst bei Aktivierung
- Infinite Scroll für große Listen

### 3. Query-Optimierung

**MSSQL:**
- Indexes auf häufig gefilterten Spalten
- LIMIT/TOP für große Result Sets
- JOIN nur wenn nötig

**MongoDB:**
- Compound Indexes für Filter-Kombinationen
- Projection für große Dokumente

## 🔄 Deployment-Architektur

### Supervisor (Process Manager)

```ini
[program:nextjs]
command=yarn start
directory=/app
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/nextjs.out.log
stderr_logfile=/var/log/supervisor/nextjs.err.log
```

### Port-Mapping

- **Next.js:** Intern 3000 → Extern via Nginx
- **MongoDB:** Intern 27017 (nicht extern)
- **MSSQL:** Intern 1433 (nicht extern)

### Environment

- **Production:** `NODE_ENV=production`
- **Hot Reload:** Automatisch in Development
- **Server Restart:** Nur bei Package-Changes nötig

## 🧩 Erweiterbarkeit

### Neue Zahlungsquelle hinzufügen

1. **API-Route erstellen:**
   ```typescript
   /app/app/api/fibu/zahlungen/neue-quelle/route.ts
   ```

2. **Daten normalisieren:**
   ```javascript
   const zahlungen = data.map(item => ({
     zahlungsdatum: item.date,
     betrag: item.amount,
     zahlungsanbieter: 'Neue Quelle',
     // ...
   }))
   ```

3. **In Haupt-Route einbinden:**
   ```javascript
   // /api/fibu/zahlungen/route.ts
   const neueQuelle = await fetch('/api/fibu/zahlungen/neue-quelle')
   alleZahlungen = [...alleZahlungen, ...neueQuelle]
   ```

### Neues Modul hinzufügen

1. **Komponente:** `/app/components/NeuesModul.js`
2. **API:** `/app/app/api/fibu/neues-modul/route.ts`
3. **Tab in Dashboard:** `FibuCompleteDashboard.js` erweitern

## 📝 Best Practices

### API-Entwicklung

✅ **DO:**
- Immer try/catch verwenden
- Sinnvolle Error Messages
- HTTP Status Codes korrekt setzen
- Input validieren

❌ **DON'T:**
- Sensible Daten im Response
- Lange Queries ohne Timeout
- Unvalidierte User-Inputs
- Hardcoded Credentials

### Frontend-Entwicklung

✅ **DO:**
- Loading States anzeigen
- Error Handling
- Debounce bei Sucheingaben
- Optimistic UI Updates

❌ **DON'T:**
- API-Keys im Client
- Große Datenmengen ungepaginiert
- Blocking Operations im UI
- Inline Styles (außer dynamisch)

## 🔍 Debugging

### Backend Logs

```bash
# Supervisor Logs
tail -f /var/log/supervisor/nextjs.out.log
tail -f /var/log/supervisor/nextjs.err.log

# MongoDB Logs
sudo journalctl -u mongodb -f
```

### Frontend Debugging

- Browser DevTools Console
- React DevTools Extension
- Network Tab für API Calls

---

**Letzte Aktualisierung:** November 2025  
**Version:** 1.0.0