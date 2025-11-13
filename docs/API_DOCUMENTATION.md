# FIBU API-Dokumentation

## Basis-URL

```
http://localhost:3000/api/fibu
```

## Authentifizierung

Aktuell keine Authentifizierung erforderlich (intern).

## Endpoints

### EK-Rechnungen (Lieferantenrechnungen)

#### GET `/api/fibu/rechnungen/ek`

Liefert alle EK-Rechnungen.

**Query Parameters:**

| Parameter | Typ | Beschreibung | Beispiel |
|-----------|-----|--------------|----------|
| `from` | string | Start-Datum (ISO) | `2025-10-01` |
| `to` | string | End-Datum (ISO) | `2025-11-13` |
| `limit` | number | Max. Anzahl | `500` |
| `kreditor` | string | Filter nach Kreditor | `70004` |

**Beispiel-Request:**

```bash
curl "http://localhost:3000/api/fibu/rechnungen/ek?from=2025-10-01&to=2025-11-13&limit=100"
```

**Response:**

```json
{
  "ok": true,
  "rechnungen": [
    {
      "_id": "abc123",
      "lieferantName": "KLINGSPOR Schleifsysteme GmbH",
      "rechnungsNummer": "59428710",
      "rechnungsdatum": "2025-10-06T00:00:00.000Z",
      "gesamtBetrag": 2191.15,
      "nettoBetrag": 1841.30,
      "steuerBetrag": 349.85,
      "steuersatz": 19,
      "kreditorKonto": "70004",
      "aufwandskonto": "5200",
      "parsing": {
        "method": "python-klingspor-parser",
        "confidence": 95,
        "parsedAt": "2025-11-01T10:05:00.000Z"
      },
      "needsManualReview": false,
      "created_at": "2025-11-01T10:05:00.000Z"
    }
  ],
  "count": 100,
  "total": 365
}
```

#### POST `/api/fibu/rechnungen/ek`

Erstellt eine neue EK-Rechnung.

**Request Body:**

```json
{
  "lieferantName": "Neue Firma GmbH",
  "rechnungsNummer": "RE-2025-001",
  "rechnungsdatum": "2025-11-13",
  "gesamtBetrag": 1190.00,
  "nettoBetrag": 1000.00,
  "steuerBetrag": 190.00,
  "steuersatz": 19,
  "kreditorKonto": "70099",
  "aufwandskonto": "5200",
  "pdf_base64": "JVBERi0xLjQ..."  // Optional
}
```

**Response:**

```json
{
  "ok": true,
  "id": "xyz789",
  "message": "EK-Rechnung erfolgreich erstellt"
}
```

#### PUT `/api/fibu/rechnungen/ek/:id`

Aktualisiert eine EK-Rechnung.

**URL Parameter:**
- `id`: Rechnungs-ID

**Request Body:** (Partial Update möglich)

```json
{
  "kreditorKonto": "70004",
  "needsManualReview": false
}
```

**Response:**

```json
{
  "ok": true,
  "message": "EK-Rechnung aktualisiert"
}
```

---

### Batch-Processing

#### POST `/api/fibu/rechnungen/ek/batch-process`

Verarbeitet mehrere PDFs aus der Email-Inbox.

**Query Parameters:**

| Parameter | Typ | Beschreibung | Standard |
|-----------|-----|--------------|----------|
| `limit` | number | Max. PDFs | `50` |
| `test` | boolean | Test-Modus | `false` |

**Beispiel:**

```bash
curl -X POST "http://localhost:3000/api/fibu/rechnungen/ek/batch-process?limit=10&test=true"
```

**Response:**

```json
{
  "ok": true,
  "processed": 10,
  "success": 9,
  "errors": 1,
  "testMode": true,
  "results": [
    {
      "filename": "rechnung_123.pdf",
      "status": "success",
      "data": {
        "lieferantName": "KLINGSPOR",
        "betrag": 2191.15
      }
    }
  ]
}
```

---

### VK-Rechnungen (Verkaufsrechnungen aus JTL)

#### GET `/api/fibu/rechnungen/vk`

Liefert Verkaufsrechnungen aus JTL.

**Query Parameters:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `from` | string | Start-Datum |
| `to` | string | End-Datum |
| `limit` | number | Max. Anzahl |

**Response:**

```json
{
  "ok": true,
  "rechnungen": [
    {
      "kRechnung": 12345,
      "cRechnungNr": "RE-2025-10001",
      "dErstellt": "2025-10-15T10:30:00.000Z",
      "fGesamtsumme": 595.00,
      "cFirma": "Musterkunde GmbH"
    }
  ],
  "count": 50
}
```

---

### Externe Rechnungen (Amazon, etc.)

#### GET `/api/fibu/rechnungen/extern`

Liefert externe Rechnungen (z.B. Amazon XRE-Rechnungen).

**Query Parameters:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `from` | string | Start-Datum |
| `to` | string | End-Datum |

**Response:**

```json
{
  "ok": true,
  "rechnungen": [
    {
      "cExterneBelegnr": "XRE-2025-100001",
      "dErstellt": "2025-10-15T00:00:00.000Z",
      "fBetrag": 150.00,
      "cPlattform": "Amazon"
    }
  ],
  "count": 25
}
```

---

### Zahlungen

#### GET `/api/fibu/zahlungen`

Liefert Zahlungstransaktionen aus JTL.

**Query Parameters:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `from` | string | Start-Datum |
| `to` | string | End-Datum |
| `limit` | number | Max. Anzahl |

**Response:**

```json
{
  "ok": true,
  "zahlungen": [
    {
      "kZahlung": 98765,
      "cHinweis": "Überweisung KLINGSPOR RE-59428710",
      "fBetrag": -2191.15,
      "dErstellt": "2025-10-10T00:00:00.000Z",
      "cZahlungsanbieter": "Commerzbank",
      "cISO": "EUR"
    }
  ],
  "count": 466
}
```

---

### Auto-Matching

#### POST `/api/fibu/auto-match-ek-zahlungen`

Führt automatisches Matching von Zahlungen zu EK-Rechnungen aus.

**Request:** (keine Parameter)

```bash
curl -X POST http://localhost:3000/api/fibu/auto-match-ek-zahlungen
```

**Response:**

```json
{
  "ok": true,
  "matchRate": "12.2%",
  "matches": 57,
  "analyzed": {
    "negativeZahlungen": 466,
    "ekRechnungen": 315
  },
  "results": [
    {
      "zahlung": {
        "kZahlung": 98765,
        "betrag": -2191.15,
        "datum": "2025-10-10"
      },
      "rechnung": {
        "_id": "abc123",
        "lieferantName": "KLINGSPOR",
        "gesamtBetrag": 2191.15,
        "rechnungsNummer": "59428710"
      },
      "score": 80,
      "reasons": [
        "Betrag exakt",
        "Datum innerhalb 7 Tage",
        "RgNr im Hinweis"
      ]
    }
  ]
}
```

---

### Kreditoren

#### GET `/api/fibu/kreditoren`

Liefert alle Kreditoren (Lieferanten).

**Query Parameters:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `limit` | number | Max. Anzahl | `500` |
| `search` | string | Such-Begriff |

**Response:**

```json
{
  "ok": true,
  "kreditoren": [
    {
      "_id": "uuid",
      "kreditorenNummer": "70004",
      "name": "KLINGSPOR Schleifsysteme GmbH & Co. KG",
      "strasse": "Hüttenstraße 36",
      "plz": "41749",
      "ort": "Viersen",
      "land": "Deutschland",
      "standardAufwandskonto": "5200"
    }
  ],
  "count": 126
}
```

#### POST `/api/fibu/kreditoren`

Erstellt einen neuen Kreditor.

**Request Body:**

```json
{
  "kreditorenNummer": "70099",
  "name": "Neue Firma GmbH",
  "strasse": "Musterstraße 1",
  "plz": "12345",
  "ort": "Musterstadt",
  "land": "Deutschland",
  "standardAufwandskonto": "5200",
  "ustIdNr": "DE123456789"
}
```

---

### Email-Inbox

#### GET `/api/fibu/email-inbox`

Liefert Status der Email-Inbox.

**Query Parameters:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `status` | string | Filter: `pending` \| `processed` \| `error` |
| `limit` | number | Max. Anzahl |

**Response:**

```json
{
  "ok": true,
  "emails": [
    {
      "_id": "uuid",
      "emailFrom": "invoices@supplier.com",
      "subject": "Rechnung 123456",
      "filename": "Rechnung_123456.pdf",
      "receivedDate": "2025-11-01T08:00:00.000Z",
      "status": "processed",
      "processedAt": "2025-11-01T08:05:00.000Z"
    }
  ],
  "count": 190,
  "stats": {
    "pending": 0,
    "processed": 190,
    "error": 0
  }
}
```

#### POST `/api/fibu/email-inbox/test-fetch`

Testet das Abrufen von Emails aus dem IMAP-Server.

**Response:**

```json
{
  "ok": true,
  "fetched": 5,
  "newEmails": 2,
  "duplicates": 3
}
```

---

### Bank-Import

#### POST `/api/fibu/bank-import`

Importiert Postbank-CSV-Kontoauszüge.

**Request:** Multipart Form-Data

```bash
curl -X POST \
  -F "file=@kontoauszug.csv" \
  http://localhost:3000/api/fibu/bank-import
```

**Response:**

```json
{
  "ok": true,
  "imported": 150,
  "duplicates": 5,
  "errors": 0,
  "transactions": [
    {
      "datum": "2025-10-15",
      "verwendungszweck": "Überweisung KLINGSPOR",
      "betrag": -2191.15,
      "waehrung": "EUR"
    }
  ]
}
```

---

### Export

#### GET `/api/fibu/export/10it`

Exportiert Daten für 10it Buchhaltungssoftware.

**Query Parameters:**

| Parameter | Typ | Beschreibung | Erforderlich |
|-----------|-----|--------------|--------------|
| `from` | string | Start-Datum | Ja |
| `to` | string | End-Datum | Ja |
| `format` | string | `csv` \| `json` | Nein (default: csv) |

**Beispiel:**

```bash
curl "http://localhost:3000/api/fibu/export/10it?from=2025-10-01&to=2025-11-13&format=csv" > export.csv
```

**CSV-Format:**

```csv
Belegdatum,Belegnummer,Lieferant,Kreditor,Aufwandskonto,Nettobetrag,MwSt,Bruttobetrag,Beschreibung
2025-10-06,59428710,KLINGSPOR Schleifsysteme GmbH,70004,5200,1841.30,349.85,2191.15,Rechnung 59428710
```

**JSON-Format:**

```json
{
  "ok": true,
  "format": "json",
  "period": {
    "from": "2025-10-01",
    "to": "2025-11-13"
  },
  "data": {
    "vkRechnungen": [],
    "ekRechnungen": [],
    "gutschriften": [],
    "zahlungen": []
  },
  "summary": {
    "totalVK": 50000.00,
    "totalEK": 25000.00,
    "totalGutschriften": 500.00
  }
}
```

---

### Gutschriften

#### GET `/api/fibu/gutschriften`

Liefert Gutschriften aus JTL.

**Query Parameters:**

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `from` | string | Start-Datum |
| `to` | string | End-Datum |
| `limit` | number | Max. Anzahl |

**Response:**

```json
{
  "ok": true,
  "gutschriften": [
    {
      "kGutschrift": 1001,
      "cGutschriftNr": "GS-2025-0001",
      "dErstellt": "2025-10-20T00:00:00.000Z",
      "fBetrag": -50.00,
      "cFirma": "Musterkunde GmbH"
    }
  ],
  "count": 10
}
```

---

### Übersicht Nicht-Zugeordnet

#### GET `/api/fibu/uebersicht/nicht-zugeordnet`

Liefert Übersicht über nicht zugeordnete Rechnungen und Zahlungen.

**Response:**

```json
{
  "ok": true,
  "summary": {
    "ekRechnungenOhneZahlung": 308,
    "zahlungenOhneRechnung": 409,
    "ekRechnungenOhneBetrag": 168,
    "ekRechnungenOhneKreditor": 287
  },
  "details": {
    "ekRechnungenOhneZahlung": [
      {
        "_id": "abc123",
        "lieferantName": "Neue Firma",
        "gesamtBetrag": 100.00
      }
    ],
    "zahlungenOhneRechnung": [
      {
        "kZahlung": 123,
        "betrag": -150.00,
        "hinweis": "Überweisung XYZ"
      }
    ]
  }
}
```

---

## Fehler-Codes

| Status Code | Bedeutung |
|-------------|-----------|
| 200 | Erfolg |
| 400 | Bad Request (ungültige Parameter) |
| 404 | Nicht gefunden |
| 500 | Server-Fehler |

## Beispiel-Fehler-Response

```json
{
  "ok": false,
  "error": "Fehlermeldung",
  "details": "Detaillierte Fehlerbeschreibung"
}
```

## Rate Limiting

Aktuell kein Rate Limiting implementiert (intern).

## Webhooks

Aktuell nicht implementiert. Geplant für Q1 2026.

## Changelog

### Version 1.0.0 (November 2025)
- Initiale API-Version
- Alle CRUD-Operationen für EK/VK-Rechnungen
- Auto-Matching-Endpoint
- 10it-Export-Endpoint
- Bank-Import-Endpoint
