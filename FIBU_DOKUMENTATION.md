# FIBU-Modul Dokumentation

## Überblick

Das FIBU-Modul ist ein vollständiges Finanz- und Buchhaltungssystem für die automatische Verarbeitung und Zuordnung von Zahlungen aus verschiedenen Quellen.

**Zeitraum:** Nur Daten ab **Oktober 2025**

---

## 1. Datenquellen

### 1.1 Amazon Settlements
- **Quelle:** JTL Datenbank (MSSQL)
- **Tabelle:** `Verkauf.tAmazonSettlement`
- **Abruf:** Über JTL Reports API
- **Besonderheit:** 
  - Amazon trennt NICHT nach Monaten
  - Für einen Monat werden **mehrere Settlement-Reports** benötigt (ca. 4 Stück)
  - Enthält detaillierte Breakdown: ItemPrice, ItemFees, Commission, Shipping, etc.
- **Collection:** `fibu_amazon_settlements`
- **API:** `/api/fibu/zahlungen/amazon-settlements`

**Wichtige Felder:**
```javascript
{
  transactionId: "AMZ-5332337586",
  orderId: "306-4519634-0707518",
  sku: "169693-4",
  amountType: "ItemPrice" | "ItemFees" | "Commission" | "Shipping",
  amountDescription: "Principal",
  betrag: 10.99,
  datum: "2025-10-31",
  kategorie: "erloes" | "gebühren"
}
```

### 1.2 PayPal Transactions
- **Quelle:** PayPal API (direkt)
- **API:** PayPal REST API v2
- **Authentifizierung:** OAuth2 Client Credentials
- **Collection:** `fibu_paypal_transactions`
- **API:** `/api/fibu/zahlungen/paypal`

**Wichtige Felder:**
```javascript
{
  transactionId: "5752704804081120D",
  rechnungsNr: "AU_12450_SW6", // Wichtig für Matching!
  kundenName: "Moritz Draußen",
  betrag: 78.24,
  gebuehr: -2.45,
  nettoBetrag: 75.79,
  status: "COMPLETED",
  betreff: ""
}
```

### 1.3 Mollie Transactions
- **Quelle:** Mollie API (direkt)
- **API:** Mollie Payments API v2
- **Authentifizierung:** API Key
- **Collection:** `fibu_mollie_transactions`
- **API:** `/api/fibu/zahlungen/mollie`
- **Filter:** Nur `status: 'paid'` oder `'authorized'` (keine `failed`)

**Wichtige Felder:**
```javascript
{
  transactionId: "tr_yHKyDUWgjXKbtAEEGD7HJ",
  verwendungszweck: "Bestellung AU_12453_SW6", // AU-Nummer hier!
  kundenName: "Franz Xaver Denk",
  betrag: 166.72,
  status: "authorized",
  methode: "billie"
}
```

### 1.4 Bank-Transaktionen (Commerzbank, Postbank)
- **Quelle:** JTL Datenbank (MSSQL)
- **Tabellen:** 
  - `Verkauf.tCommerzbankTransaction`
  - `Verkauf.tPostbankTransaction`
- **Collection:** 
  - `fibu_commerzbank_transactions`
  - `fibu_postbank_transactions`
- **API:** `/api/fibu/zahlungen/banks`

**Wichtige Felder:**
```javascript
{
  transactionId: "unique-id",
  verwendungszweck: "Rechnung RE2025-12345 Zahlung", // RE-Nummer hier!
  gegenkonto: "Max Mustermann",
  gegenkontoIban: "DE89370400440532013000",
  betrag: 299.99,
  datum: "2025-11-17"
}
```

### 1.5 VK-Rechnungen (Verkauf)
- **Quelle:** JTL Datenbank (MSSQL)
- **Tabelle:** `Verkauf.tRechnung`
- **Collection:** `fibu_vk_rechnungen`
- **API:** `/api/fibu/rechnungen/vk`

**Wichtige Felder:**
```javascript
{
  cRechnungsNr: "RE2025-97876",
  brutto: 168.33,
  rechnungsdatum: "2025-11-15",
  kundenName: "Test Kunde GmbH",
  bezahltStatus: "offen" | "bezahlt" | "teilbezahlt"
}
```

---

## 2. Auto-Matching System

### 2.1 Matching-Strategien

**API:** `POST /api/fibu/auto-match`

#### Strategie 1: AU-Nummer Matching (Mollie, PayPal)
```javascript
// Mollie: Extrahiere AU-Nummer aus verwendungszweck
const auMatch = verwendungszweck.match(/AU[_-]?(\d+)[_-]?SW\d+/i)

// PayPal: Direkt aus rechnungsNr
const auNummer = zahlung.rechnungsNr

// Match mit VK-Rechnung:
// - Betrag ±0.50€
// - Datum ±60 Tage
// - Beste Score-Kombination gewinnt
```

**Erfolgsrate:** 
- PayPal: ~274/385 (71%)
- Mollie: ~16/23 (70%)

#### Strategie 2: RE-Nummer Matching (Bank)
```javascript
// Extrahiere Rechnungsnummer aus Verwendungszweck
const reMatch = verwendungszweck.match(/RE\s*(\d{4}[-\s]?\d+)/i)

// Direkte Suche in VK-Rechnungen
const rechnung = vkRechnungen.find(r => 
  r.cRechnungsNr.includes(reNummer)
)
```

**Erfolgsrate:** 
- Commerzbank: ~11/165 (7%)

#### Strategie 3: Betrag+Datum Matching (Amazon Verkäufe)
```javascript
// Nur für ItemPrice (Verkaufserlöse)
if (kategorie === 'ItemPrice' && orderId) {
  // Suche Rechnung mit:
  // - Betrag ±0.50€
  // - Datum ±30 Tage
  // - Score: betragDiff + (daysDiff × 0.1)
  // - Nur wenn Score < 1.0
}
```

**Erfolgsrate:** 
- Amazon ItemPrice: ~150/8.117 (2%)

#### Strategie 4: Kategorie-Mapping (Amazon Gebühren)
```javascript
const kontoMapping = {
  'ItemFees': '4910',           // Verkaufsgebühren
  'FBAPerUnitFulfillmentFee': '4950', // FBA Gebühren
  'Commission': '4970',          // Provisionen
  'Shipping': '4800',            // Frachtkosten
  'ShippingHB': '4800',
  'StorageFee': '4950',
  'AdvertisingFee': '4630',      // Werbekosten
  'Goodwill': '4960',            // Kulanz
  'RefundCommission': '4970',
  'ServiceFee': '4910'
}
```

**Erfolgsrate:** 
- Amazon Gebühren: ~2.976/8.117 (37%)

### 2.2 Gesamt-Performance

**Oktober 2025:**
- Gesamt Zahlungen: 8.541
- Auto-Matched: 3.169 (37%)
- Manuell nötig: 5.372 (63%)

**Breakdown:**
- Kategorie-Mapping: 2.976 (93% der Matches)
- Betrag+Datum: 150 (5%)
- AU-Nummer: 32 (1%)
- RE-Nummer: 11 (<1%)

---

## 3. Manuelles Zuordnungssystem

### 3.1 Vorschläge-API

**API:** `GET /api/fibu/zahlungen/vorschlaege`

**Parameter:**
```javascript
{
  betrag: 166.72,
  datum: "2025-11-17",
  referenz: "AU_12453_SW6",
  transaktionsId: "tr_xxx"
}
```

**Scoring-Logik:**
```javascript
let score = 0

// 1. Betrag (Hauptkriterium)
if (betragDiff < 0.10) score += 100  // Exakt
else if (betragDiff < 1.00) score += 80  // Sehr gut
else if (betragDiff < 5.00) score += 50  // Gut
else if (betragDiff < 20.00) score += 20 // Akzeptabel

// 2. AU-Nummer Match
if (referenzMatch) score += 50

// 3. Datum-Nähe
if (daysDiff <= 7) score += 30
else if (daysDiff <= 30) score += 15
else if (daysDiff <= 60) score += 5

// Beste Score = Beste Übereinstimmung
```

### 3.2 Zuordnungs-API

**API:** `POST /api/fibu/zahlungen/zuordnen`

**Request:**
```javascript
{
  zahlungIds: ["691b29b8677fd8393053388e"], // Array!
  
  // Option A: Rechnung
  rechnungId: "rechnung-xyz",
  rechnungsNr: "RE2025-12345",
  
  // Option B: Konto
  kontoNr: "4910",
  kontoName: "Verkaufsgebühren",
  
  // Bei Abweichung
  abweichungsgrund: "skonto" | "teilzahlung" | "währung" | "sonstiges",
  abweichungsBetrag: -5.50,
  notiz: "Optionale Notiz"
}
```

**Unterstützte Features:**
- ✅ Mehrere Zahlungen → ein Beleg (Teilzahlungen)
- ✅ Betrag-Abweichungen mit Grund
- ✅ Rechnung- UND Konto-Zuordnung
- ✅ Freitext-Notizen

### 3.3 Zuordnungs-Modal UI

**Komponente:** `/components/ZuordnungsModal.js`

**Tabs:**
1. **"BELEG WÄHLEN"**
   - Zeigt VK-Rechnungen mit Score
   - Top 10 Vorschläge
   - Visuelles Score-Ranking
   - Betrag-Differenz-Anzeige

2. **"KATEGORIE WÄHLEN"**
   - Zeigt Kontenplan (SKR03/04)
   - Suchfunktion
   - Kontonummer + Bezeichnung

**Abweichungs-Handling:**
- Bei Betrag-Diff > 0.50€ → Dropdown erscheint
- Gründe: Teilzahlung, Skonto, Währung, Sonstiges
- Notiz-Feld für Details

---

## 4. Datenstruktur

### 4.1 Zahlung (alle Collections)

**Basis-Felder:**
```javascript
{
  _id: ObjectId,
  transactionId: String,      // Eindeutige ID
  datum: Date,
  datumDate: Date,            // Für Queries
  betrag: Number,
  waehrung: String,           // "EUR"
  
  // Quelle
  quelle: String,             // "fibu_paypal_transactions"
  
  // Zuordnung
  istZugeordnet: Boolean,
  zugeordneteRechnung: String,    // "RE2025-12345"
  zugeordnetesKonto: String,      // "4910"
  zuordnungsArt: String,          // "rechnung" | "konto"
  zuordnungsDatum: Date,
  zuordnungsMethode: String,      // "auto" | "manuell"
  
  // Abweichungen
  abweichungsgrund: String,       // "skonto" | "teilzahlung" | ...
  abweichungsBetrag: Number,
  zuordnungsNotiz: String,
  
  // Import
  imported_at: Date,
  updated_at: Date
}
```

**Anbieter-spezifische Felder:**
```javascript
// Amazon
{
  orderId: String,
  sku: String,
  amountType: String,
  amountDescription: String,
  kategorie: String
}

// PayPal
{
  rechnungsNr: String,        // AU-Nummer!
  kundenName: String,
  kundenEmail: String,
  gebuehr: Number,
  nettoBetrag: Number
}

// Mollie
{
  verwendungszweck: String,   // AU-Nummer hier!
  kundenName: String,
  methode: String,
  status: String
}

// Bank
{
  verwendungszweck: String,   // RE-Nummer hier!
  gegenkonto: String,
  gegenkontoIban: String
}
```

### 4.2 API-Response Format

**Zahlungen-API:** `/api/fibu/zahlungen`

```javascript
{
  ok: true,
  from: "2025-10-01",
  to: "2025-10-31",
  
  stats: {
    gesamt: 8541,
    gesamtsumme: 125430.55,
    anbieter: {
      "Amazon": { anzahl: 8117, summe: 98234.12 },
      "PayPal": { anzahl: 385, summe: 15678.90 },
      // ...
    }
  },
  
  zahlungen: [...],
  
  pagination: {
    page: 1,
    pageSize: 500,
    totalCount: 8541,
    totalPages: 18,
    hasNext: true,
    hasPrev: false
  }
}
```

---

## 5. Wichtige Hinweise für Entwicklung

### 5.1 Datensicherheit

**KRITISCH:** Zugeordnete Zahlungen dürfen NICHT überschrieben werden!

```javascript
// In allen Import-APIs (PayPal, Mollie, etc.):

// 1. Hole alle zugeordneten IDs
const zugeordnete = await collection.find({
  transactionId: { $in: transactionIds },
  istZugeordnet: true
}).toArray()

// 2. Filtere sie aus dem Update-Array
const zugeordneteIds = new Set(zugeordnete.map(z => z.transactionId))
const bulkOps = transactions
  .filter(t => !zugeordneteIds.has(t.transactionId))
  .map(t => ({ updateOne: { ... } }))

// 3. Log Warnung
console.log(`⚠️ ${zugeordneteIds.size} zugeordnete Transaktionen geschützt`)
```

### 5.2 Amazon Settlements

**Problem:** Amazon trennt nicht nach Monaten

**Lösung:**
1. Alle Settlement-Reports aus JTL DB laden
2. Nach `settlementStartDate` und `settlementEndDate` gruppieren
3. Für einen Monat (z.B. Oktober) benötigt man ~4 Reports
4. Settlements können sich überlappen

**JTL Query:**
```sql
SELECT * FROM Verkauf.tAmazonSettlement
WHERE settlementStartDate >= '2025-10-01'
  AND settlementEndDate <= '2025-11-30'
ORDER BY settlementStartDate
```

### 5.3 Performance

**Große Datenmengen:**
- Amazon Oktober: ~8.117 Transaktionen
- Pagination ist PFLICHT (500 pro Seite)
- Auto-Match über ALLE Daten, nicht nur Zeitraum

**Optimierungen:**
```javascript
// Index auf datumDate
db.collection.createIndex({ datumDate: 1 })

// Index auf istZugeordnet für schnelle Filterung
db.collection.createIndex({ istZugeordnet: 1 })

// Compound Index für Queries
db.collection.createIndex({ datumDate: 1, istZugeordnet: 1 })
```

### 5.4 Zeitzone-Probleme VERMEIDEN

**NIEMALS `toISOString()` für Date-Vergleiche verwenden!**

```javascript
// ❌ FALSCH:
const dateStr = date.toISOString().split('T')[0] // Kann um 1 Tag verschoben sein!

// ✅ RICHTIG:
const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// ✅ Oder: Direkt mit String-Parsing
const [year, month, day] = dateString.split('-').map(Number)
const date = new Date(year, month - 1, day)
```

---

## 6. Offene TODOs

### 6.1 Amazon Konten-Mapping

**Status:** Teilweise implementiert, muss mit JTL-Daten abgeglichen werden

**TODO:**
1. Excel "Amazon Oktober.xlsx" analysieren
2. Konto/Gegenkonto Mapping aus JTL extrahieren
3. In Auto-Match Kategorie-Mapping einpflegen
4. Sicherstellen, dass ALLE Transaktionstypen erfasst sind

**Bekannte Typen:**
- Order/ItemPrice/Principal → 8400 (Erlöse)
- Order/ItemFees/Commission → 4910 (Verkaufsgebühren)
- Order/ItemFees/FBAPerUnitFulfillmentFee → 4950 (FBA Gebühren)
- Refund/ItemPrice/Principal → 4730 (Erlösschmälerungen)
- other-transaction/Kosten für Werbung → 4630 (Werbekosten)

### 6.2 EK-Rechnungen Integration

**Status:** Nicht implementiert

**TODO:**
1. API für EK-Rechnungen erstellen (`/api/fibu/rechnungen/ek`)
2. In Vorschläge-API einbinden (bei negativen Beträgen)
3. Auto-Match für EK erweitern

### 6.3 Auftrags-Integration (Nice-to-have)

**Status:** Geplant, aber zurückgestellt

**Idee:**
- Zahlungen → JTL Aufträge matchen (über AU-Nummer)
- Warengruppe auslesen (z.B. "Konfektion")
- Voraussichtliche Lieferzeit berücksichtigen
- Besseres Matching für Zahlungen VOR Rechnung

**Vorteil:** Würde Matching-Rate von 37% → ~60%+ erhöhen

### 6.4 Bulk-Zuordnung UI

**Status:** Backend fertig, Frontend fehlt

**TODO:**
1. Mehrfachauswahl in Zahlungen-Tabelle (Checkboxen)
2. "Ausgewählte zuordnen" Button
3. Modal öffnet sich mit allen ausgewählten Zahlungen
4. Gesamt-Betrag anzeigen
5. Bei Zuordnung: `zahlungIds: [id1, id2, id3]`

---

## 7. Testing & Debugging

### 7.1 Auto-Match testen

```bash
# Dry-Run für Oktober
curl -X POST http://localhost:3000/api/fibu/auto-match \
  -H "Content-Type: application/json" \
  -d '{"zeitraum": "2025-10-01_2025-10-31", "dryRun": true}'

# Zeigt Stats ohne Daten zu ändern
```

### 7.2 Vorschläge testen

```bash
# Vorschläge für eine Zahlung
curl "http://localhost:3000/api/fibu/zahlungen/vorschlaege?betrag=166.72&datum=2025-11-17&referenz=AU_12453_SW6"
```

### 7.3 Logs überprüfen

```bash
# Backend Logs
tail -f /var/log/supervisor/nextjs.out.log | grep "Auto-Match\|Zuordnung\|Vorschläge"

# Zahlungen-Count
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-10-01&to=2025-10-31" | jq '.stats'
```

---

## 8. Deployment Checklist

- [ ] MongoDB Indices erstellt
- [ ] Environment Variables gesetzt (PayPal, Mollie API Keys)
- [ ] JTL DB Connection konfiguriert
- [ ] Amazon Settlement Reports in DB vorhanden
- [ ] Auto-Match initial ausgeführt
- [ ] Kontenplan importiert (`/api/fibu/kontenplan`)
- [ ] VK-Rechnungen importiert
- [ ] Backup-Strategie definiert
- [ ] Monitoring eingerichtet

---

**Letzte Aktualisierung:** 18. November 2025
**Version:** 1.0
**Autor:** AI Assistant
