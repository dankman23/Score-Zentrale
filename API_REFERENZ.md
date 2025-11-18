# FIBU-Modul API Referenz

## Inhaltsverzeichnis
1. [Zahlungen](#zahlungen)
2. [Auto-Matching](#auto-matching)
3. [Zuordnung](#zuordnung)
4. [Rechnungen](#rechnungen)
5. [Kontenplan](#kontenplan)
6. [Import/Refresh](#import-refresh)

---

## Zahlungen

### GET `/api/fibu/zahlungen`
Lädt alle Zahlungen für einen Zeitraum mit Pagination.

**Query Parameters:**
```
from      = "2025-10-01"  (required)
to        = "2025-10-31"  (required)
page      = 1             (default: 1)
pageSize  = 500           (default: 500)
anbieter  = "all"         (default: all, optional: paypal, amazon, mollie, commerzbank, postbank)
```

**Response:**
```json
{
  "ok": true,
  "from": "2025-10-01",
  "to": "2025-10-31",
  "stats": {
    "gesamt": 8541,
    "gesamtsumme": 125430.55,
    "anbieter": {
      "Amazon": {
        "anzahl": 8117,
        "summe": 98234.12
      }
    }
  },
  "zahlungen": [
    {
      "_id": "691b29b8677fd8393053388e",
      "transaktionsId": "tr_yHKyDUWgjXKbtAEEGD7HJ",
      "referenz": "AU_12453_SW6",
      "datum": "2025-11-17T10:30:00.000Z",
      "betrag": 166.72,
      "waehrung": "EUR",
      "anbieter": "Mollie",
      "quelle": "fibu_mollie_transactions",
      "verwendungszweck": "Bestellung AU_12453_SW6",
      "gegenkonto": "Franz Xaver Denk",
      "kundenEmail": null,
      "gebuehr": null,
      "kategorie": null,
      "methode": "billie",
      "status": "authorized",
      "sku": null,
      "istZugeordnet": true,
      "zugeordneteRechnung": "RE2025-12345",
      "zugeordnetesKonto": null,
      "zuordnungsArt": "rechnung",
      "zuordnungsDatum": "2025-11-18T08:15:00.000Z",
      "zuordnungsMethode": "manuell",
      "abweichungsgrund": "skonto",
      "abweichungsBetrag": -5.50,
      "zuordnungsNotiz": "5% Skonto gewährt"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 500,
    "totalCount": 8541,
    "totalPages": 18,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Status Codes:**
- `200 OK` - Erfolg
- `400 Bad Request` - Fehlende Parameter
- `500 Internal Server Error` - Server-Fehler

---

### GET `/api/fibu/zahlungen/paypal`
Lädt PayPal-Transaktionen direkt von der API.

**Query Parameters:**
```
from    = "2025-10-01"  (required)
to      = "2025-10-31"  (required)
refresh = true          (default: false, lädt von PayPal API)
limit   = 1000          (default: 1000)
```

**Datenquelle:** PayPal REST API v2
**Collection:** `fibu_paypal_transactions`
**Authentifizierung:** OAuth2 (aus ENV)

**Response:** Wie GET `/api/fibu/zahlungen` aber nur PayPal

---

### GET `/api/fibu/zahlungen/mollie`
Lädt Mollie-Transaktionen direkt von der API.

**Query Parameters:**
```
from    = "2025-10-01"  (required)
to      = "2025-10-31"  (required)
refresh = true          (default: false)
limit   = 1000          (default: 1000)
```

**Datenquelle:** Mollie Payments API v2
**Collection:** `fibu_mollie_transactions`
**Filter:** Nur `status: 'paid'` oder `'authorized'`

---

### GET `/api/fibu/zahlungen/amazon-settlements`
Lädt Amazon Settlement-Reports aus JTL DB.

**Query Parameters:**
```
from    = "2025-10-01"  (required)
to      = "2025-10-31"  (required)
refresh = true          (default: false)
limit   = 5000          (default: 5000)
```

**Datenquelle:** JTL MSSQL `Verkauf.tAmazonSettlement`
**Collection:** `fibu_amazon_settlements`

**Besonderheit:** 
- Amazon trennt nicht nach Monaten
- Für einen Monat werden mehrere Settlement-Reports benötigt

**Response zusätzlich:**
```json
{
  "settlements": 4,
  "transaktionen": 8117,
  "stats": {
    "erloes": 82430.55,
    "gebuehren": -15803.43
  }
}
```

---

### GET `/api/fibu/zahlungen/banks`
Lädt Bank-Transaktionen aus JTL DB.

**Query Parameters:**
```
bank    = "all"              (required: all, commerzbank, postbank)
from    = "2025-10-01"       (required)
to      = "2025-10-31"       (required)
refresh = true               (default: false)
```

**Datenquelle:** JTL MSSQL
- `Verkauf.tCommerzbankTransaction`
- `Verkauf.tPostbankTransaction`

**Collections:**
- `fibu_commerzbank_transactions`
- `fibu_postbank_transactions`

---

## Auto-Matching

### POST `/api/fibu/auto-match`
Führt automatisches Matching von Zahlungen zu Rechnungen/Konten durch.

**Request Body:**
```json
{
  "zeitraum": "2025-10-01_2025-10-31",
  "dryRun": true
}
```

**Parameter:**
- `zeitraum` (optional): Wird nur für Stats verwendet, Matching läuft über ALLE nicht-zugeordneten Daten ab Okt 2025
- `dryRun` (default: false): Wenn `true`, werden keine Daten geändert (nur Simulation)

**Response:**
```json
{
  "ok": true,
  "matched": [
    {
      "zahlungId": "691b29b8677fd8393053388e",
      "anbieter": "PayPal",
      "transaktionsId": "5752704804081120D",
      "betrag": 78.24,
      "datum": "2025-11-15T12:00:00.000Z",
      "match": {
        "type": "rechnung",
        "rechnungId": "6914d6514060008245a1b7c3",
        "rechnungsNr": "RE2025-97876",
        "confidence": "high"
      },
      "method": "auNummer"
    }
  ],
  "stats": {
    "totalZahlungen": 5619,
    "matched": 290,
    "byMethod": {
      "auNummer": 32,
      "reNummer": 11,
      "betragDatum": 150,
      "kategorie": 97
    },
    "byAnbieter": {
      "Amazon": { "total": 8117, "matched": 247 },
      "PayPal": { "total": 385, "matched": 32 },
      "Mollie": { "total": 23, "matched": 11 }
    }
  },
  "dryRun": true
}
```

**Matching-Methoden:**
1. **auNummer**: AU-Nummer aus Mollie/PayPal → VK-Rechnung
2. **reNummer**: RE-Nummer aus Verwendungszweck → VK-Rechnung
3. **betragDatum**: Betrag + Datum Matching (Amazon ItemPrice)
4. **kategorie**: Kategorie → Kontenplan (Amazon Gebühren)

**Status Codes:**
- `200 OK` - Erfolg
- `500 Internal Server Error` - Server-Fehler

---

## Zuordnung

### GET `/api/fibu/zahlungen/vorschlaege`
Findet passende Belege für eine Zahlung (für manuelles Matching).

**Query Parameters:**
```
betrag        = 166.72            (required)
datum         = "2025-11-17"      (optional)
referenz      = "AU_12453_SW6"    (optional)
transaktionsId= "tr_xxx"          (optional)
```

**Response:**
```json
{
  "ok": true,
  "vorschlaege": [
    {
      "belegId": "6914d6514060008245a1b7c3",
      "typ": "vk-rechnung",
      "rechnungsNr": "RE2025-97876",
      "kunde": "Test GmbH",
      "betrag": 168.33,
      "datum": "2025-11-15T00:00:00.000Z",
      "status": "offen",
      "score": 115,
      "reasons": [
        "Betrag ähnlich (±1.61€)",
        "AU-Nummer: AU_12453_SW6",
        "Datum nah"
      ],
      "betragDiff": 1.61
    }
  ],
  "zahlungInfo": {
    "betrag": 166.72,
    "datum": "2025-11-17",
    "referenz": "AU_12453_SW6",
    "istEingang": true
  }
}
```

**Scoring-Logik:**
- Betrag exakt (±0.10€): +100
- Betrag sehr gut (±1.00€): +80
- Betrag gut (±5.00€): +50
- AU-Nummer Match: +50
- Datum sehr nah (±7 Tage): +30
- Datum nah (±30 Tage): +15

**Status Codes:**
- `200 OK` - Erfolg
- `400 Bad Request` - Betrag fehlt
- `500 Internal Server Error` - Server-Fehler

---

### POST `/api/fibu/zahlungen/zuordnen`
Ordnet eine oder mehrere Zahlungen einem Beleg oder Konto zu.

**Request Body:**
```json
{
  "zahlungIds": [
    "691b29b8677fd8393053388e",
    "691b29b8677fd8393053388f"
  ],
  
  // Option A: Rechnung-Zuordnung
  "rechnungId": "6914d6514060008245a1b7c3",
  "rechnungsNr": "RE2025-12345",
  
  // Option B: Konto-Zuordnung
  "kontoNr": "4910",
  "kontoName": "Verkaufsgebühren",
  
  // Bei Betrag-Abweichung
  "abweichungsgrund": "skonto",
  "abweichungsBetrag": -5.50,
  "notiz": "5% Skonto gewährt"
}
```

**Abweichungsgründe:**
- `teilzahlung` - Mehrere Zahlungen für eine Rechnung
- `skonto` - Skontoabzug
- `währung` - Währungsumrechnung
- `sonstiges` - Anderer Grund

**Response:**
```json
{
  "ok": true,
  "updated": 2,
  "zahlungen": [
    {
      "zahlungId": "691b29b8677fd8393053388e",
      "anbieter": "Mollie",
      "betrag": 166.72
    },
    {
      "zahlungId": "691b29b8677fd8393053388f",
      "anbieter": "PayPal",
      "betrag": 100.00
    }
  ],
  "gesamtBetrag": 266.72,
  "rechnungId": "6914d6514060008245a1b7c3",
  "rechnungsNr": "RE2025-12345",
  "abweichungsgrund": "skonto"
}
```

**Status Codes:**
- `200 OK` - Erfolg
- `400 Bad Request` - Fehlende Parameter
- `404 Not Found` - Zahlung nicht gefunden
- `500 Internal Server Error` - Server-Fehler

---

### DELETE `/api/fibu/zahlungen/zuordnen`
Entfernt Zuordnung von Zahlungen.

**Request Body:**
```json
{
  "zahlungIds": [
    "691b29b8677fd8393053388e"
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "removed": 1
}
```

**Status Codes:**
- `200 OK` - Erfolg
- `400 Bad Request` - Fehlende Parameter
- `500 Internal Server Error` - Server-Fehler

---

## Rechnungen

### GET `/api/fibu/rechnungen/vk`
Lädt VK-Rechnungen (Verkauf) aus JTL DB.

**Query Parameters:**
```
from  = "2025-10-01"  (required)
to    = "2025-10-31"  (required)
limit = 1000          (default: 1000)
```

**Datenquelle:** JTL MSSQL `Verkauf.tRechnung`
**Collection:** `fibu_vk_rechnungen`

**Response:**
```json
{
  "ok": true,
  "from": "2025-10-01",
  "to": "2025-10-31",
  "rechnungen": [
    {
      "_id": "6914d6514060008245a1b7c3",
      "cRechnungsNr": "RE2025-97876",
      "rechnungsNr": "RE2025-97876",
      "rechnungsdatum": "2025-11-15T00:00:00.000Z",
      "brutto": 168.33,
      "netto": 141.45,
      "ust": 26.88,
      "kundenName": "Test GmbH",
      "cFirma": "Test GmbH",
      "bezahltStatus": "offen",
      "bezahltBetrag": 0,
      "quelle": "JTL"
    }
  ],
  "stats": {
    "gesamt": 789,
    "offen": 234,
    "bezahlt": 555,
    "gesamtBetrag": 125678.90
  }
}
```

**Status Codes:**
- `200 OK` - Erfolg
- `400 Bad Request` - Fehlende Parameter
- `500 Internal Server Error` - Server-Fehler

---

## Kontenplan

### GET `/api/fibu/kontenplan`
Lädt den Kontenplan (SKR03/04).

**Query Parameters:** Keine

**Response:**
```json
{
  "ok": true,
  "konten": [
    {
      "_id": "691769b67f45d40e7de4bf39",
      "kontonummer": "4910",
      "bezeichnung": "Verkaufsgebühren Amazon",
      "kontoart": "Aufwand",
      "skr": "SKR03",
      "created_at": "2025-11-14T17:41:10.379Z",
      "updated_at": "2025-11-14T17:41:19.896Z"
    }
  ],
  "stats": {
    "gesamt": 138,
    "byArt": {
      "Aufwand": 85,
      "Ertrag": 32,
      "Aktiva": 12,
      "Passiva": 9
    }
  }
}
```

**Status Codes:**
- `200 OK` - Erfolg
- `500 Internal Server Error` - Server-Fehler

---

## Import/Refresh

### Refresh-Workflow

**1. Zahlungen aktualisieren:**
```javascript
// PayPal
await fetch('/api/fibu/zahlungen/paypal?from=2025-10-01&to=2025-10-31&refresh=true')

// Mollie
await fetch('/api/fibu/zahlungen/mollie?from=2025-10-01&to=2025-10-31&refresh=true')

// Amazon
await fetch('/api/fibu/zahlungen/amazon-settlements?from=2025-10-01&to=2025-10-31&refresh=true')

// Bank
await fetch('/api/fibu/zahlungen/banks?bank=all&from=2025-10-01&to=2025-10-31&refresh=true')
```

**2. Auto-Match ausführen:**
```javascript
await fetch('/api/fibu/auto-match', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    zeitraum: '2025-10-01_2025-10-31',
    dryRun: false
  })
})
```

**WICHTIG:** 
- Zugeordnete Zahlungen werden beim Refresh automatisch geschützt
- Nur neue/geänderte Transaktionen werden importiert
- Auto-Match ordnet nur nicht-zugeordnete Zahlungen zu

---

## Rate Limits & Performance

### PayPal API
- Rate Limit: 1000 requests/minute
- Max 500 Transaktionen pro Request
- Für große Zeiträume: Mehrere Requests mit Pagination

### Mollie API
- Rate Limit: 50 requests/second
- Max 250 Zahlungen pro Request

### JTL DB (Amazon, Bank)
- Keine API-Limits
- Performance abhängig von DB-Last
- Index auf `datum`, `settlementStartDate` empfohlen

### MongoDB Performance
```javascript
// Empfohlene Indices:
db.fibu_paypal_transactions.createIndex({ datumDate: 1, istZugeordnet: 1 })
db.fibu_amazon_settlements.createIndex({ datumDate: 1, istZugeordnet: 1 })
db.fibu_vk_rechnungen.createIndex({ rechnungsdatum: 1 })
```

---

## Error Handling

### Standardfehler-Format
```json
{
  "ok": false,
  "error": "Fehlermeldung hier",
  "details": {
    "field": "betrag",
    "reason": "Muss größer als 0 sein"
  }
}
```

### Häufige Fehler

**400 Bad Request:**
- Fehlende required Parameter
- Ungültiges Datumsformat (muss `YYYY-MM-DD` sein)
- Ungültiger Betrag

**404 Not Found:**
- Zahlung nicht gefunden
- Rechnung nicht gefunden

**500 Internal Server Error:**
- Datenbankverbindung fehlgeschlagen
- PayPal/Mollie API nicht erreichbar
- JTL DB Verbindung fehlgeschlagen

---

## Debugging

### Log-Ausgaben aktivieren

```bash
# Backend Logs live verfolgen
tail -f /var/log/supervisor/nextjs.out.log

# Nur FIBU-relevante Logs
tail -f /var/log/supervisor/nextjs.out.log | grep "Zahlungen\|Auto-Match\|Zuordnung"

# Fehler-Logs
tail -f /var/log/supervisor/nextjs.out.log | grep "ERROR\|Fehler"
```

### Test-Requests

```bash
# Zahlungen zählen
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-10-01&to=2025-10-31" | jq '.stats.gesamt'

# Auto-Match Dry-Run
curl -X POST http://localhost:3000/api/fibu/auto-match \
  -H "Content-Type: application/json" \
  -d '{"zeitraum": "2025-10-01_2025-10-31", "dryRun": true}' | jq '.stats'

# Vorschläge testen
curl "http://localhost:3000/api/fibu/zahlungen/vorschlaege?betrag=100.00&datum=2025-11-17" | jq '.vorschlaege | length'
```

---

**Version:** 1.0
**Letzte Aktualisierung:** 18. November 2025
