# System-Architektur - FIBU Manager

## 🏗️ Übersicht

Der FIBU Manager ist eine hybride Anwendung, die bestehende JTL-Daten mit erweiterten Buchhaltungsfunktionen kombiniert.

## 📐 Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  Next.js Frontend (React + Tailwind CSS)                    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/HTTPS
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              Next.js Backend (API Routes)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/fibu/rechnungen/extern    (Rechnungen)         │  │
│  │  /api/fibu/zahlungen            (Zahlungen)          │  │
│  │  /api/fibu/kontenplan           (Konten CRUD)        │  │
│  │  /api/fibu/kreditoren           (Lieferanten)        │  │
│  │  /api/fibu/bank-import          (CSV-Import)         │  │
│  │  /api/fibu/zahlungseinstellungen                     │  │
│  └──────────────────────────────────────────────────────┘  │
└───────┬──────────────────────────────────────┬─────────────┘
        │                                      │
        ↓ Read-Only                            ↓ Read/Write
┌───────────────────┐              ┌─────────────────────────┐
│  JTL MSSQL DB     │              │  MongoDB (fibu)         │
│                   │              │                         │
│  • tBestellung    │              │  • fibu_konten          │
│  • tRechnungskopf │              │  • fibu_kreditoren      │
│  • tZahlungseingang│              │  • fibu_bank_trans...  │
│  • tZahlungsart   │              │  • fibu_zahlungs...    │
│  • tLieferschein  │              │                         │
└───────────────────┘              └─────────────────────────┘
```

## 🎯 Hybrid-Datenbank-Strategie

### Warum zwei Datenbanken?

1. **JTL MSSQL (Read-Only):**
   - Enthält operative Geschäftsdaten (Bestellungen, Rechnungen, Kunden)
   - Wird von JTL-Wawi verwaltet
   - Änderungen nur über JTL-Software
   - FIBU Manager liest nur

2. **MongoDB (Read/Write):**
   - Speichert FIBU-spezifische Daten
   - Kontenplan (SKR04)
   - Importierte Bank-Transaktionen
   - Kreditoren-Zuordnungen
   - Zahlungseinstellungen

### Datenfluss-Beispiel: Externe Rechnung

```
1. Frontend ruft /api/fibu/rechnungen/extern auf
   ↓
2. Backend fetcht Rechnungen aus JTL MSSQL
   SELECT * FROM tRechnungskopf WHERE cRechnungsnummer LIKE 'XRE-%'
   ↓
3. Backend fetcht Zahlungen aus JTL MSSQL
   SELECT * FROM tZahlungseingang
   ↓
4. Node.js führt Matching durch (nach Betrag & Datum)
   ↓
5. Backend setzt Status in JTL auf "Bezahlt"
   UPDATE tRechnungskopf SET cStatus = 'bezahlt'
   ↓
6. Ergebnis wird an Frontend zurückgegeben
```

## 🔄 API-Architektur

### RESTful Endpoints

Alle FIBU-APIs folgen dem Schema: `/api/fibu/{ressource}`

#### Externe Rechnungen
```typescript
GET /api/fibu/rechnungen/extern?from=2025-01-01&to=2025-12-31

Response:
{
  ok: true,
  rechnungen: [
    {
      rechnungsnummer: "XRE-12345",
      datum: "2025-10-15",
      betrag: 1234.56,
      status: "bezahlt",
      zahlung: {
        datum: "2025-10-16",
        betrag: 1234.56,
        bank: "Amazon"
      }
    }
  ]
}
```

#### Kontenplan CRUD
```typescript
// Liste aller Konten
GET /api/fibu/kontenplan

// Einzelnes Konto
GET /api/fibu/kontenplan?kontonummer=1802

// Neues Konto anlegen
POST /api/fibu/kontenplan
Body: { kontonummer, bezeichnung, kontenklasse, ... }

// Konto bearbeiten
PUT /api/fibu/kontenplan?kontonummer=1802
Body: { bezeichnung, istAktiv, ... }

// Konto löschen
DELETE /api/fibu/kontenplan?kontonummer=1802
```

#### Bank-Import
```typescript
POST /api/fibu/bank-import
Content-Type: multipart/form-data

Body: FormData mit CSV-Datei

Response:
{
  ok: true,
  imported: 45,
  errors: [],
  message: "45 Transaktionen erfolgreich importiert"
}
```

## 🧩 Component-Architektur

### Frontend-Komponenten-Hierarchie

```
app/fibu/page.js
  └─ FibuCompleteDashboard
       ├─ Tab: Übersicht
       ├─ Tab: Rechnungen
       ├─ Tab: Zahlungen
       │    └─ ZahlungenView
       ├─ Tab: Kontenplan + Einstellungen
       │    └─ KontenplanView
       │         ├─ Tab: Kontenplan (SKR04-Hierarchie)
       │         ├─ Tab: Kreditoren
       │         │    └─ KreditorenManagement
       │         ├─ Tab: Debitoren (Sammel-Debitorenkonten)
       │         ├─ Tab: Kostenarten
       │         ├─ Tab: Kostenstellen
       │         └─ Tab: Einstellungen
       │              └─ ZahlungsEinstellungen
       └─ Tab: Bank-Import
            └─ BankImport
```

### State Management

Keine externe State-Management-Library. Nutzt:
- **React `useState`** für lokalen Component-State
- **React `useEffect`** für API-Calls
- **Browser localStorage** für UI-Präferenzen

## 🔍 Matching-Algorithmus (Rechnungen ↔ Zahlungen)

### Problem
Externe Amazon-Rechnungen (XRE-*) müssen mit Zahlungen verknüpft werden.

### Lösung: Application-Layer Matching

```javascript
// 1. Rechnungen aus JTL holen
const rechnungen = await fetchExterneRechnungen()

// 2. Zahlungen aus JTL holen
const zahlungen = await fetchZahlungen()

// 3. Matching in Node.js durchführen
for (const rechnung of rechnungen) {
  const passendeZahlung = zahlungen.find(z => 
    Math.abs(z.betrag - rechnung.betrag) < 0.01 &&  // Betrag-Match
    isDateWithin7Days(z.datum, rechnung.datum)       // Datum-Match
  )
  
  if (passendeZahlung) {
    rechnung.status = 'bezahlt'
    rechnung.zahlung = passendeZahlung
    
    // Status in JTL aktualisieren
    await updateRechnungStatus(rechnung.id, 'bezahlt')
  }
}
```

### Warum nicht SQL JOIN?

❌ **Problematischer Ansatz (vermieden):**
```sql
-- NICHT VERWENDEN! Führt zu Datenverlust!
SELECT r.*, z.*
FROM tRechnungskopf r
LEFT JOIN tZahlungseingang z ON (
  ABS(r.fBetrag - z.fBetrag) < 0.01 AND
  DATEDIFF(day, r.dDatum, z.dDatum) < 7
)
```

Probleme:
- Komplexe JOIN-Bedingungen sind fehleranfällig
- Bei Bugs verschwinden Daten aus der Ansicht
- Schwer zu debuggen
- Risiko von Dateninkonsistenzen

✅ **Sicherer Ansatz (implementiert):**
- Daten separat fetchen
- Matching in Node.js (einfach zu testen)
- Bei Fehlern: Keine Daten verloren
- Einfaches Debugging

## 📦 Deployment-Architektur

### Produktiv-Setup

```
┌────────────────────────────────────────┐
│  Reverse Proxy (nginx/Kubernetes)      │
│  HTTPS Termination                     │
└──────────────┬─────────────────────────┘
               │
               ↓
┌────────────────────────────────────────┐
│  Next.js App (Port 3000)               │
│  - Supervisor für Process Management   │
│  - Logs: /var/log/supervisor/          │
└──────┬──────────────────┬──────────────┘
       │                  │
       ↓                  ↓
┌──────────────┐   ┌─────────────────┐
│  JTL MSSQL   │   │  MongoDB        │
│  (Remote)    │   │  (Local/Remote) │
└──────────────┘   └─────────────────┘
```

### Umgebungsvariablen

**Entwicklung:**
```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
JTL_DB_SERVER=localhost
MONGO_URL=mongodb://localhost:27017/fibu
```

**Produktion:**
```env
NEXT_PUBLIC_BASE_URL=https://fibu.example.com
JTL_DB_SERVER=jtl-prod.internal
MONGO_URL=mongodb://mongo.internal:27017/fibu
```

## 🔐 Sicherheitsarchitektur

### Zugriffskontrolle

1. **JTL MSSQL:**
   - Dedizierter Read-Only User
   - Nur SELECT-Rechte auf benötigte Tabellen
   - UPDATE nur auf tRechnungskopf.cStatus

2. **MongoDB:**
   - Full Access für FIBU-Collections
   - Separate Database (`fibu`)

### Datenvalidierung

```typescript
// Beispiel: Konto erstellen
POST /api/fibu/kontenplan

// Validierung im Backend:
1. Kontonummer: 4-stellig, numerisch
2. Bezeichnung: Nicht leer
3. Kontenklasse: 0-9
4. Keine Duplikate
```

## 📊 Performance-Optimierungen

### Caching
- Kontenplan wird im Frontend gecacht (selten Änderungen)
- API-Responses mit Cache-Control Headers

### Batch-Operations
- Bank-Import verarbeitet CSV in Chunks
- Bulk-Insert in MongoDB für bessere Performance

### Indexierung
```javascript
// MongoDB Indices
db.fibu_konten.createIndex({ kontonummer: 1 }, { unique: true })
db.fibu_konten.createIndex({ kontenklasse: 1, kontengruppe: 1 })
db.fibu_bank_transaktionen.createIndex({ buchungsdatum: -1 })
db.fibu_kreditoren.createIndex({ name: "text" })
```

## 🐛 Error Handling

### API Error Response Format

```typescript
{
  ok: false,
  error: "Detaillierte Fehlerbeschreibung",
  code: "ERROR_CODE",  // Optional
  details: { ... }      // Optional
}
```

### Fehler-Kategorien

1. **Validierungs-Fehler** (400)
2. **Nicht gefunden** (404)
3. **Datenbank-Fehler** (500)
4. **Externe API-Fehler** (502)

## 🔄 Datenfluss-Beispiele

### CSV-Import-Flow

```
1. User wählt CSV-Datei aus
   ↓
2. Frontend sendet FormData an /api/fibu/bank-import
   ↓
3. Backend parst CSV Zeile für Zeile
   ↓
4. Jede Zeile wird validiert:
   - Datum im korrekten Format?
   - Betrag numerisch?
   - Pflichtfelder vorhanden?
   ↓
5. Valide Zeilen werden in MongoDB eingefügt
   ↓
6. Response mit Import-Statistik
   ↓
7. Frontend zeigt Erfolgs-Meldung
```

### Kontenplan-Anzeige-Flow

```
1. User öffnet Kontenplan-Tab
   ↓
2. Frontend ruft GET /api/fibu/kontenplan auf
   ↓
3. Backend fetcht alle Konten aus MongoDB
   ↓
4. Konten werden nach Klasse/Gruppe sortiert
   ↓
5. Response mit 137+ Konten
   ↓
6. Frontend gruppiert hierarchisch:
   Klasse 0
     └─ Gruppe 06 (EDV & Fahrzeuge)
         └─ Untergruppe 065 (EDV-Software)
             └─ Konto 0650
   ↓
7. Accordion-UI rendert Hierarchie
```

## 🧪 Testing-Strategie

### Manuelle Tests
- Kritische APIs vor jedem Deployment
- Test-Skript: `node scripts/test-critical-data.js`

### Monitoring
- Server-Logs überwachen
- Import-Fehlerrate tracken
- Matching-Erfolgsrate bei externen Rechnungen

---

**Letzte Aktualisierung:** November 2025  
**Version:** 1.0.0