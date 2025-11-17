# Zahlungsmodul - Dokumentation

## 🎯 Übersicht

Das Zahlungsmodul ist das Herzstück der FIBU-Anwendung. Es konsolidiert Zahlungsdaten aus **7 verschiedenen Quellen** und bietet ein einheitliches Interface für:

- Zahlungsübersicht
- Automatische Zuordnung
- Manuelle Zuordnung (Rechnung oder Buchungskonto)
- Statistiken und Filter

## 📊 Zahlungsquellen

### 1. Amazon Payment ✅ KOMPLETT

**Quelle:** JTL-DB `pf_amazon_settlement` + `pf_amazon_settlementpos`

**Daten:**
- 319.109 Settlement-Positionen
- Erlöse (Artikel, Versand, Steuer)
- Gebühren (Provision, FBA, Werbung)
- Rückerstattungen
- Transfers

**API-Route:** `/api/fibu/zahlungen/amazon-settlements`

**Kategorien:**
```javascript
{
  'erloes_artikel': 'Order/ItemPrice/Principal',
  'erloes_steuer': 'Order/ItemPrice/Tax',
  'gebuehr_provision': 'ItemFees/Commission',
  'gebuehr_fba': 'ItemFees/FBAFee',
  'transfer': 'Transfer'
}
```

### 2. eBay 🔄 IN VORBEREITUNG

**Quelle:** eBay Finances API (Direktanbindung)

**Benötigt:**
- eBay App ID (Client ID)
- eBay Cert ID (Client Secret)
- OAuth 2.0 Token

**API-Route:** `/api/fibu/zahlungen/ebay-transactions` (geplant)

### 3. PayPal 🔄 IN VORBEREITUNG

**Quelle:** PayPal Transaction Search API v1

**Benötigt:**
- PayPal Client ID
- PayPal Client Secret

**API-Route:** `/api/fibu/zahlungen/paypal-transactions` (geplant)

**Daten:**
- Payments
- Fees (`fee_amount`)
- Refunds
- Transfers (PayPal ↔ Bank)

### 4. Mollie ✅

**Quelle:** JTL-DB `tZahlung` (kZahlungsart=19)

**Hinweis:** Nur Netto-Zahlungen, keine Gebühren

### 5. Commerzbank ✅

**Quelle:** JTL-DB `tZahlungsabgleichUmsatz` (kZahlungsabgleichModul=5)

**Hinweis:** Bank-Transaktionen ohne Gebühren

### 6. Postbank ✅

**Quelle:** MongoDB `fibu_bank_transaktionen` (CSV-Import)

**Import:**
- Manueller Upload via UI
- CSV-Parsing
- Automatisches Matching mit Rechnungen

### 7. Otto.de ✅

**Quelle:** JTL-DB `tZahlung` (kZahlungsart=14)

## 🔧 API-Struktur

### Haupt-Endpoint

**Route:** `GET /api/fibu/zahlungen`

**Parameter:**
```typescript
{
  from: string,        // '2025-10-01'
  to: string,          // '2025-10-31'
  limit?: number,      // Default: 1000
  reload?: boolean     // Cache invalidieren
}
```

**Response:**
```javascript
{
  ok: true,
  zahlungen: [
    {
      zahlungsdatum: "2025-10-15T10:30:00Z",
      zahlungsanbieter: "Amazon Payment",
      betrag: 123.45,
      quelle: "amazon_settlement",
      
      // Zuordnung
      istZugeordnet: true,
      zuordnungsArt: "rechnung",  // oder "konto"
      rechnungsNr: "RE2025-12345",
      zugeordnetesKonto: null,
      
      // Meta
      hinweis: "Order/ItemPrice/Principal",
      kundenName: "Max Mustermann",
      kategorie: "erloes_artikel"
    }
  ],
  anzahl: 1234
}
```

### Zuordnungs-Endpoint

**Route:** `PUT /api/fibu/zahlungen`

**Body:**
```javascript
{
  zahlungId: "...",
  quelle: "postbank",
  zuordnungsArt: "konto",      // "rechnung" oder "konto"
  kontonummer: "6850",          // Falls konto
  rechnungsNr: "RE2025-12345"   // Falls rechnung
}
```

**Response:**
```javascript
{
  ok: true,
  message: "Zuordnung erfolgreich gespeichert"
}
```

### Zuordnung Löschen

**Route:** `DELETE /api/fibu/zahlungen?zahlungId=...&quelle=...`

**Response:**
```javascript
{
  ok: true,
  message: "Zuordnung erfolgreich gelöscht"
}
```

## 🎨 Frontend-Komponenten

### ZahlungenView.js

**Hauptkomponente** für Zahlungsübersicht

**Features:**
- Tabellen-Ansicht mit allen Zahlungen
- Filter (Anbieter, Status, Richtung, Suche)
- Statistiken (Eingänge, Ausgänge, Saldo)
- Zeitraum-Auswahl
- Zuordnen-Button für jede Zahlung

**States:**
```javascript
const [zahlungen, setZahlungen] = useState([])
const [zeitraum, setZeitraum] = useState('2025-10-01_2025-10-31')
const [anbieterFilter, setAnbieterFilter] = useState('alle')
const [zuordnungFilter, setZuordnungFilter] = useState('alle')
const [searchTerm, setSearchTerm] = useState('')
```

### ZuordnungsModal (in ZahlungenView.js)

**Lexoffice-Style Modal** für Zuordnung

**Features:**
- Zahlungs-Details-Anzeige
- Zwei Zuordnungsarten:
  - 📄 Mit Rechnung verknüpfen
  - 📊 Mit Buchungskonto verknüpfen
- Kontenplan-Auswahl (gruppiert nach SKR04-Klassen)
- Validierung
- Zuordnung löschen

**States:**
```javascript
const [zuordnungsArt, setZuordnungsArt] = useState(null)
const [rechnungsNr, setRechnungsNr] = useState('')
const [kontonummer, setKontonummer] = useState('')
const [kontenplan, setKontenplan] = useState([])
```

## 📊 Datenfluss

### Zahlungen laden

```
1. User wählt Zeitraum: Oktober 2025
   ↓
2. Frontend: API-Call GET /api/fibu/zahlungen
   ↓
3. Backend:
   a) Prüft MongoDB Cache
   b) Falls cache miss:
      - Query JTL tZahlung (kZahlungsart IN (6,7,8,14,19))
      - Query JTL tZahlungsabgleichUmsatz
      - Query MongoDB fibu_bank_transaktionen
      - Query JTL pf_amazon_settlement[pos]
      - Kombiniert & normalisiert
      - Speichert in Cache
   ↓
4. Response mit allen Zahlungen
   ↓
5. Frontend: Rendering in Tabelle
   ↓
6. User sieht:
   - Datum, Anbieter, Betrag
   - Zuordnungsstatus (✓ oder -)
   - Zuordnung (RE-Nr. oder Konto-Nr.)
   - "Zuordnen"-Button
```

### Zahlung zuordnen

```
1. User klickt "Zuordnen"
   ↓
2. Modal öffnet mit Zahlungs-Details
   ↓
3. User wählt: "Mit Buchungskonto verknüpfen"
   ↓
4. Dropdown lädt Kontenplan vom /api/fibu/kontenplan
   ↓
5. User wählt: 6850 - Telefon/Internet
   ↓
6. User klickt "Speichern"
   ↓
7. PUT /api/fibu/zahlungen
   Body: { ..., zuordnungsArt: 'konto', kontonummer: '6850' }
   ↓
8. Backend:
   - Update MongoDB (fibu_bank_transaktionen)
   - Setzt: zugeordnetesKonto='6850', zuordnungsArt='konto', istZugeordnet=true
   ↓
9. Response: { ok: true }
   ↓
10. Frontend:
    - Schließt Modal
    - Lädt Zahlungen neu
    - Zeigt: 📊 6850 in Spalte "Zuordnung"
```

## 🔍 Normalisierung

### Zahlungsanbieter-Mapping

**Funktion:** `normalizeZahlungsanbieter()`

**Duplikate verhindern:**
```javascript
'paypal' → 'PayPal'
'paypal (bank)' → 'PayPal'
'ebay managed payments' → 'eBay'
'ebay (bank)' → 'eBay'
'amazon' → 'Amazon Payment'
```

**Zahlungsarten filtern:**
```javascript
// ❌ Rausfiltern (sind keine Anbieter!)
'vorkasse', 'rechnung', 'lastschrift', 'ratepay', 'klarna'
```

**Nur echte Zahlungskonten:**
```sql
WHERE kZahlungsart IN (
  6,   -- PayPal
  7,   -- eBay Managed Payments
  8,   -- Amazon Payment
  14,  -- Otto.de
  19   -- Mollie
)
```

## 📈 Statistiken

**Berechnung im Frontend:**

```javascript
const statistik = {
  eingaenge: zahlungen.filter(z => z.betrag > 0).length,
  ausgaenge: zahlungen.filter(z => z.betrag < 0).length,
  summeEingaenge: zahlungen
    .filter(z => z.betrag > 0)
    .reduce((sum, z) => sum + z.betrag, 0),
  summeAusgaenge: zahlungen
    .filter(z => z.betrag < 0)
    .reduce((sum, z) => sum + z.betrag, 0),
  saldo: summeEingaenge + summeAusgaenge,
  zugeordnet: zahlungen.filter(z => z.istZugeordnet).length,
  offen: zahlungen.filter(z => !z.istZugeordnet).length
}
```

## 🔐 Datenintegrität

### Lösch-Schutz

**Regel:** Zahlungen können NICHT gelöscht werden!

**Grund:** Wie in echter Buchhaltung - Zahlung ist getätigt, bleibt im System.

**Aber:** Zuordnung kann gelöscht/geändert werden.

**Implementierung:**
```javascript
// DELETE löscht NUR die Zuordnung, nicht die Zahlung
const updateData = {
  zuordnungsArt: null,
  istZugeordnet: false,
  zugeordnetesKonto: null,
  rechnungsNr: null
}
// Zahlung selbst bleibt erhalten!
```

### Duplikats-Vermeidung

**Unique ID:** `${quelle}_${zahlungId}`

```javascript
// Amazon
`amazon_settlement_16297649412_1032612231`

// Postbank
`postbank_673898f2ac45d6e7891d25b3`

// JTL
`tZahlung_12345`
```

## 🎨 UI/UX-Design

### Farb-Kodierung

**Zahlungsanbieter:**
- 🔵 JTL (tZahlung)
- 🟢 Postbank
- 🟣 Bank (tZahlungsabgleichUmsatz)

**Betrag:**
- 🟢 Grün: Eingang (positiv)
- 🔴 Rot: Ausgang (negativ)

**Zuordnung:**
- 📄 Blau: Rechnung
- 📊 Lila: Buchungskonto
- ⚪ Grau: Keine Zuordnung

### Responsive Design

- **Desktop:** Volle Tabelle mit allen Spalten
- **Tablet:** Kompakte Darstellung
- **Mobile:** Karten-Layout (geplant)

## 🚀 Performance

### Caching-Strategie

```javascript
// Cache-Key
const cacheKey = `zahlungen_${from}_${to}_${limit}`

// TTL: 1 Stunde
const TTL = 3600000

// Invalidierung
?reload=true  // Force Reload
```

### Pagination

```javascript
// Default: 1000 Zahlungen
const limit = parseInt(searchParams.get('limit') || '1000')

// Für große Zeiträume
const alleAnzeigen = true  // Lädt bis zu 2000
```

## 🧪 Testing

### API-Tests

```bash
# Zahlungen laden
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-10-01&to=2025-10-31"

# Zuordnung erstellen
curl -X PUT "http://localhost:3000/api/fibu/zahlungen" \
  -H "Content-Type: application/json" \
  -d '{
    "zahlungId": "123",
    "quelle": "postbank",
    "zuordnungsArt": "konto",
    "kontonummer": "6850"
  }'

# Zuordnung löschen
curl -X DELETE "http://localhost:3000/api/fibu/zahlungen?zahlungId=123&quelle=postbank"
```

## 📝 Erweiterungen

### Neue Zahlungsquelle hinzufügen

**Checklist:**

1. ✅ API-Route erstellen: `/api/fibu/zahlungen/neue-quelle/route.ts`
2. ✅ Daten normalisieren (gleiches Schema)
3. ✅ In Haupt-Route einbinden
4. ✅ `normalizeZahlungsanbieter()` erweitern
5. ✅ Filter-Dropdown aktualisieren
6. ✅ Dokumentation updaten

### Bulk-Aktionen (geplant)

- [ ] Mehrere Zahlungen gleichzeitig zuordnen
- [ ] Massen-Export (Excel/CSV)
- [ ] Automatische Regeln (z.B. "Alle PayPal > 100€ → Konto 1801")

---

**Letzte Aktualisierung:** November 2025  
**Version:** 1.0.0