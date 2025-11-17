# API-Referenz - FIBU Accounting Hub

## 🔗 Base URL

```
http://localhost:3000/api
```

Alle API-Endpoints sind unter `/api` erreichbar.

---

## 📊 FIBU APIs

### Kontenplan

#### GET /api/fibu/kontenplan

Lädt alle Konten aus dem SKR04-Kontenplan.

**Parameter:**
```typescript
{
  search?: string,  // Volltextsuche
  klasse?: string,  // Filter nach Kontenklasse (0-9)
  aktiv?: boolean   // Nur aktive Konten
}
```

**Response:**
```javascript
{
  ok: true,
  konten: [
    {
      kontonummer: "1801",
      bezeichnung: "PayPal",
      kontenklasse: 1,
      kontengruppe: "18",
      kontenklasseTyp: "aktiv",
      istSystemkonto: true,
      istAktiv: true
    }
  ],
  anzahl: 137
}
```

#### POST /api/fibu/kontenplan

Erstellt ein neues Konto.

**Body:**
```javascript
{
  kontonummer: "1899",           // 4-stellig, Pflicht
  bezeichnung: "Test-Konto",     // Pflicht
  beschreibung: "Optional",
  steuersatz: 19,                 // Optional
  istAktiv: true                  // Default: true
}
```

**Response:**
```javascript
{
  ok: true,
  konto: { /* Erstelltes Konto */ },
  created: true
}
```

#### PUT /api/fibu/kontenplan

Aktualisiert ein bestehendes Konto.

**Body:**
```javascript
{
  kontonummer: "1801",           // Pflicht (ID)
  bezeichnung: "Neue Bezeichnung",
  istAktiv: false                 // Deaktivieren
}
```

---

### Zahlungen

#### GET /api/fibu/zahlungen

Lädt alle Zahlungen aus verschiedenen Quellen.

**Parameter:**
```typescript
{
  from: string,      // '2025-10-01' (Pflicht)
  to: string,        // '2025-10-31' (Pflicht)
  limit?: number,    // Default: 1000
  reload?: boolean   // Cache invalidieren
}
```

**Response:**
```javascript
{
  ok: true,
  zahlungen: [
    {
      zahlungsdatum: "2025-10-15T10:30:00.000Z",
      zahlungsanbieter: "Amazon Payment",
      betrag: 123.45,
      hinweis: "Order/ItemPrice/Principal",
      quelle: "amazon_settlement",
      
      // Zuordnung
      istZugeordnet: true,
      zuordnungsArt: "konto",        // "rechnung" oder "konto"
      zugeordnetesKonto: "6850",
      rechnungsNr: null,
      
      // Meta
      kundenName: "Max Mustermann",
      kategorie: "erloes_artikel",
      _id: "...",
      zahlungsId: "..."
    }
  ],
  anzahl: 1234,
  zeitraum: { from: "2025-10-01", to: "2025-10-31" }
}
```

#### PUT /api/fibu/zahlungen

Ordnet eine Zahlung einer Rechnung oder einem Buchungskonto zu.

**Body:**
```javascript
{
  zahlungId: "123",              // Pflicht
  quelle: "postbank",            // Pflicht
  zuordnungsArt: "konto",        // "rechnung" oder "konto" (Pflicht)
  
  // Falls zuordnungsArt = "konto":
  kontonummer: "6850",           
  
  // Falls zuordnungsArt = "rechnung":
  rechnungsNr: "RE2025-12345"
}
```

**Response:**
```javascript
{
  ok: true,
  message: "Zuordnung erfolgreich gespeichert"
}
```

#### DELETE /api/fibu/zahlungen

Löscht die Zuordnung einer Zahlung (NICHT die Zahlung selbst!).

**Query Parameters:**
```typescript
{
  zahlungId: string,  // Pflicht
  quelle: string      // Pflicht
}
```

**Response:**
```javascript
{
  ok: true,
  message: "Zuordnung erfolgreich gelöscht"
}
```

---

### Amazon Settlements

#### GET /api/fibu/zahlungen/amazon-settlements

Lädt Amazon Settlement Report Positionen.

**Parameter:**
```typescript
{
  from: string,      // '2025-10-01' (Pflicht)
  to: string,        // '2025-10-31' (Pflicht)
  limit?: number     // Default: 5000
}
```

**Response:**
```javascript
{
  ok: true,
  positionen: [
    {
      settlementId: "16297649412",
      orderId: "404-1686377-1194722",
      transactionType: "Order",
      amountType: "ItemPrice",
      amountDescription: "Principal",
      betrag: 23.99,
      zahlungsdatum: "2025-10-15T...",
      kategorie: "erloes_artikel",
      sku: "PROD-12345",
      marketplace: "Amazon.de"
    }
  ],
  anzahl: 1234
}
```

**Kategorien:**
- `erloes_artikel` - Verkaufserlös
- `erloes_steuer` - MwSt
- `gebuehr_provision` - Amazon-Provision
- `gebuehr_fba` - FBA-Gebühren
- `rueckerstattung_artikel` - Rückerstattung
- `transfer` - Geldtransfer

---

### Kreditoren

#### GET /api/fibu/kreditoren

Lädt alle Kreditoren.

**Response:**
```javascript
{
  ok: true,
  kreditoren: [
    {
      kreditorId: "KR-12345",
      name: "Shopware AG",
      email: "[email protected]",
      jtlLieferantId: 123,
      kontonummer: "70001",
      status: "aktiv"
    }
  ]
}
```

#### POST /api/fibu/kreditoren

Erstellt einen neuen Kreditor.

**Body:**
```javascript
{
  name: "Neue Firma GmbH",       // Pflicht
  email: "[email protected]",
  jtlLieferantId: 456,           // Optional: Verknüpfung zu JTL
  kontonummer: "70002",          // Kreditorenkonto zuweisen
  status: "aktiv"                // Default: "aktiv"
}
```

---

## 📄 JTL APIs (Read-Only)

### Rechnungen

#### GET /api/jtl/rechnungen

**Parameter:**
```typescript
{
  from: string,
  to: string,
  limit?: number
}
```

### Lieferanten

#### GET /api/jtl/lieferanten

**Response:**
```javascript
{
  ok: true,
  lieferanten: [
    {
      kLieferant: 123,
      cName: "Shopware AG",
      cMail: "[email protected]"
    }
  ]
}
```

---

## 📥 Import APIs

### Postbank CSV Import

#### POST /api/fibu/bank-import

Importiert Postbank-Transaktionen aus CSV.

**Body (FormData):**
```typescript
{
  file: File,         // CSV-Datei
  quelle: 'postbank'  // Bank-ID
}
```

**Response:**
```javascript
{
  ok: true,
  imported: 45,
  matched: 32,      // Automatisch zugeordnet
  unmatched: 13     // Manuell zuordnen
}
```

---

## ⚡ Rate Limits

**Aktuell:** Keine harten Limits

**Empfehlung:**
- Max. 100 Requests/Minute pro Client
- Caching nutzen (`reload=false`)
- Pagination für große Datasets

## ❌ Error Handling

**Standard Error Response:**

```javascript
{
  ok: false,
  error: "Error message",
  details?: { /* Zusätzliche Infos */ }
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (z.B. fehlende Parameter)
- `404` - Not Found
- `500` - Server Error

## 📝 Beispiel-Requests

### Zahlungen für Oktober laden

```bash
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-10-01&to=2025-10-31" \
  | jq '.zahlungen[0:5]'
```

### Zahlung einem Konto zuordnen

```bash
curl -X PUT "http://localhost:3000/api/fibu/zahlungen" \
  -H "Content-Type: application/json" \
  -d '{
    "zahlungId": "673898f2ac45d6e7891d25b3",
    "quelle": "postbank",
    "zuordnungsArt": "konto",
    "kontonummer": "6850"
  }' | jq .
```

### Neues Konto erstellen

```bash
curl -X POST "http://localhost:3000/api/fibu/kontenplan" \
  -H "Content-Type: application/json" \
  -d '{
    "kontonummer": "1899",
    "bezeichnung": "Test-Bankkonto",
    "beschreibung": "Dies ist ein Test"
  }' | jq .
```

---

**Version:** 1.0.0  
**Letzte Aktualisierung:** November 2025