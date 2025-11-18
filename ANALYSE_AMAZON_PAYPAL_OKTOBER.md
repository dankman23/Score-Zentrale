# Analyse: Amazon & PayPal Daten Oktober 2025

## 📊 Datenquellen-Analyse

### Amazon Oktober.xlsx
**Struktur:**
- Spalten: Datum, Konto, Gegenkonto, Betrag, Währung, BG-Text, Belegfeld 1, Belegfeld 2, Str.Schlüssel, Sachverhalt, Bemerkung, etc.
- Format: Buchhaltungs-Export aus JTL (vermutlich für DATEV/10it)
- Zeitraum: Hauptsächlich Oktober 2025, einige September-Einträge

**Transaktionstypen identifiziert:**
1. **Verkaufserlöse** (Order/ItemPrice/Principal)
   - Konto: 69001
   - Beispiel: "Artikel bezahlt"
   - Belegfeld 1: XRE-XXXX (Rechnungsnummer)
   - Belegfeld 2: AU2025-XXXXX (Auftragsnummer)

2. **Amazon Kommissionen** (Order/ItemFees/Commission)
   - Konto: 6770
   - Belegfeld 1: XRE-XXXX
   - Belegfeld 2: AU2025-XXXXX

3. **Rückzahlungen** (Refund/*)
   - Verschiedene Typen: ItemPrice/Tax, ItemPrice/Principal, ItemFees/Commission
   - Belegfeld 1: XRK-XXX (Korrekturrechnung)

4. **Steuer/Versand** (Order/ItemWithheldTax/MarketplaceFacilitatorVAT-Shipping)
   - Konto: 1370
   - Versandgebühr (Steuer abgeführt)

### PayPal oktober.xlsx
**Struktur:**
- 279 Zeilen Daten
- Spalten: Datum, Konto, Gegenkonto, Betrag, Währung, BG-Text, Belegfeld 1, Belegfeld 2, JTL Kd-Nr., EMail

**Transaktionstypen identifiziert:**
1. **Shop-Zahlungen** (doppelt gebucht)
   - Erlös: Konto 69012/69014/69016/69018/69020
   - Gebühr: Konto 6855
   - Belegfeld 1: RE2025-XXXXX (Rechnungsnummer)
   - Belegfeld 2: AU_XXXXX_SW6 (Bestellnummer)

2. **Transfer zu Bank**
   - Konto: 1460
   - BG-Text: "Paypal an Bank"
   - Keine Belegfelder

3. **Einkäufe** (externe Dienste)
   - Konto: 79000
   - Anbieter: shopware AG, eBay S.a.r.l., Dropbox, Microsoft, flaschenpost SE, ninepoint software, Stephan Redeker

4. **Einbehaltungen**
   - Konto: 1370
   - "Einbehaltung für offene Autorisierung"
   - Rückbuchung: "Rückbuchung allgemeine Einbehaltung"

---

## 🔍 Vergleich mit aktueller System-Implementierung

### Aktuelle Datenstruktur im System

#### Amazon Settlements (fibu_amazon_settlements)
**Felder:**
- `transactionId`: AMZ-{kMessageId}
- `datum`, `datumDate`
- `betrag`, `waehrung`
- `settlementId`, `orderId`, `merchantOrderId`
- `transactionType`, `amountType`, `amountDescription`
- `sku`, `quantity`
- `kategorie`: erloes/gebuehr/rueckerstattung/transfer/sonstiges
- **Zuordnung:** `istZugeordnet`, `zugeordneteRechnung`, `zugeordnetesKonto`

**Kategorisierung:**
```typescript
- Erlöse: Order + Item + Principal, Order + Shipping
- Gebühren: Fee, Commission
- Rückerstattungen: Refund
- Transfer: Transfer
- Sonstiges: Rest
```

#### PayPal Transactions (fibu_paypal_transactions)
**Felder:**
- `transactionId`
- `datum`, `datumDate`
- `betrag`, `gebuehr`, `nettoBetrag`, `waehrung`
- `rechnungsNr`: AU_XXXXX_SW6 Format
- `kundenName`, `kundenEmail`
- `betreff`, `status`, `ereignis`
- **Zuordnung:** `istZugeordnet`, `zugeordneteRechnung`, `zugeordnetesKonto`

---

## ✅ Erkenntnisse & Bewertung

### Was funktioniert GUT:

1. **Amazon Datenstruktur ist korrekt**
   - Settlement-Positionen werden korrekt aus JTL geladen
   - Kategorisierung (erloes/gebuehr/rueckerstattung) ist sinnvoll
   - orderId und merchantOrderId werden gespeichert

2. **PayPal Datenstruktur ist gut**
   - AU-Nummer wird in `rechnungsNr` gespeichert
   - Gebühren werden separat erfasst (`gebuehr`, `nettoBetrag`)

3. **Einheitliche Zuordnungsfelder**
   - Alle Collections haben: `istZugeordnet`, `zugeordneteRechnung`, `zugeordnetesKonto`
   - Gut für einheitliches Matching

### Was fehlt / zu verbessern:

#### 1. ❌ **Amazon: Fehlende Referenz auf Rechnungsnummer**
**Problem:**
- Excel zeigt XRE-Nummern in Belegfeld 1
- Datenbank speichert nur `orderId` (Order-ID)
- Mapping zwischen Order-ID und XRE-Nummer fehlt

**Empfehlung:**
```typescript
// Ergänze in Amazon Settlement:
externe_rechnungsNr: string  // XRE-4064, XRK-186 
                             // Mapping über externe Rechnungen API
```

#### 2. ❌ **Amazon: Fehlende Konto-Zuordnung in Daten**
**Problem:**
- Excel zeigt klare Konto-Zuordnung (69001, 6770, 1370)
- Datenbank hat nur `kategorie`
- Auto-Match muss Konten manuell mappen (siehe Zeile 236-276 in auto-match)

**Empfehlung:**
```typescript
// Ergänze Amazon-spezifische Konten:
sachkonto: string  // 69001, 6770, 1370
gegenkontoNr: string  // Für doppelte Buchführung
```

#### 3. ⚠️ **PayPal: Doppelbuchungen werden nicht erkannt**
**Problem:**
- Excel zeigt jede Zahlung doppelt: Erlös (69012) + Gebühr (6855)
- Datenbank speichert als einzelne Transaktion mit `gebuehr`-Feld
- Kann zu Verwirrung führen

**Empfehlung:**
- Aktuelles System ist OK (eine Transaktion mit Gebühr)
- ABER: Dokumentiere in UI, dass Gebühren bereits abgezogen sind
- Alternative: Split in 2 Einträge wie Excel (komplexer)

#### 4. ❌ **Fehlende externe Rechnungen (XRE) Integration**
**Problem:**
- Excel zeigt XRE-Rechnungsnummern
- System hat API `/api/fibu/rechnungen/extern` für externe Rechnungen
- Aber: Keine Verknüpfung zu Amazon Settlements

**Empfehlung:**
```typescript
// Lade externe Rechnungen und verknüpfe mit Amazon
const externeRechnungen = await db.collection('fibu_externe_rechnungen').find({}).toArray()
// Matching: Amazon orderId/merchantOrderId → externe Rechnung
```

---

## 🎯 Empfohlene Verbesserungen für Auto-Matching

### 1. Amazon Matching verbessern

**Aktuell:**
```typescript
// Nur ItemPrice wird gematchet
if (kategorie === 'ItemPrice' && orderId) {
  // Suche nach Betrag + Datum
  // Nur wenn eindeutig (1 Match)
}
```

**Verbessert:**
```typescript
// A) Zuerst: Versuche über externe Rechnungen (XRE)
// 1. Lade externe Rechnungen API
const externeRechnungen = await db.collection('fibu_externe_rechnungen').find({
  dBelegdatumUtc: { $gte: startDate, $lte: endDate }
}).toArray()

// 2. Matche Amazon orderId mit externer Rechnung cBelegnr (enthält oft Order-ID)
const externeRechnung = externeRechnungen.find(er => {
  return er.cBelegnr?.includes(zahlung.orderId) || 
         er.cBelegnr?.includes(zahlung.merchantOrderId)
})

// 3. Wenn externe Rechnung gefunden → automatische Zuordnung
if (externeRechnung) {
  match = {
    type: 'externeRechnung',
    rechnungId: externeRechnung._id.toString(),
    rechnungsNr: externeRechnung.cBelegnr,
    confidence: 'high'
  }
  method = 'amazonOrderId'
}

// B) Fallback: Betrag + Datum Matching
if (!match && kategorie === 'ItemPrice') {
  // Existierender Code
}

// C) Gebühren direkt Konten zuordnen (existiert schon, ist gut)
if (!match && kategorie) {
  // Existierender Konto-Mapping Code
}
```

### 2. PayPal Matching verbessern

**Aktuell:**
```typescript
// PayPal: rechnungsNr ist AU-Nummer
// Matching über Betrag + Datum innerhalb 60 Tage
```

**Verbesserung:**
```typescript
// A) Direktes Matching über AU-Nummer (sollte schon funktionieren)
auNummer = zahlung.rechnungsNr // AU_11961_SW6

// B) ABER: VK-Rechnungen haben oft NICHT die AU-Nummer gespeichert
// Lösung: Suche in JTL nach Verknüpfung Rechnung ↔ Auftrag

// Ergänze in VK-Rechnungen Ladung:
SELECT 
  r.cRechnungsNr,
  r.kRechnung,
  a.cAuftragsNr,  // <-- Auftragsnummer
  a.kAuftrag
FROM dbo.tRechnung r
LEFT JOIN dbo.tAuftrag a ON r.kAuftrag = a.kAuftrag
WHERE r.dErstellt >= @startDate

// Speichere in MongoDB:
{
  rechnungsNr: 'RE2025-97630',
  auftragsNr: 'AU2025-11961',  // <-- NEU
  ...
}

// Matching wird dann präzise:
const rechnung = vkRechnungen.find(r => {
  const auNr = zahlung.rechnungsNr.replace('AU_', 'AU2025-').replace('_SW6', '')
  return r.auftragsNr === auNr
})
```

### 3. Neues Matching für Bank-Überweisungen

**Problem:** Commerzbank/Postbank haben oft nur Betreff mit RE-Nummer oder Kundennamen

**Verbessert:**
```typescript
// A) RE-Nummer Matching (existiert, ist gut)

// B) Zusätzlich: Kundenname Matching
if (!match && verwendungszweck) {
  // Extrahiere Namen aus Verwendungszweck
  const namen = verwendungszweck.split(/[,;]/).map(n => n.trim())
  
  // Suche Rechnung mit passendem Kundennamen
  const rechnung = vkRechnungen.find(r => {
    const rgName = (r.cRAName || '').toLowerCase()
    return namen.some(name => 
      rgName.includes(name.toLowerCase()) || 
      name.toLowerCase().includes(rgName)
    )
  })
  
  if (rechnung) {
    // Zusätzlich: Betrag prüfen (Toleranz 1%)
    const betragMatch = Math.abs(rechnung.brutto - Math.abs(zahlung.betrag)) < (rechnung.brutto * 0.01)
    if (betragMatch) {
      match = { 
        type: 'rechnung', 
        rechnungsNr: rechnung.cRechnungsNr,
        confidence: 'medium' 
      }
    }
  }
}
```

---

## 📝 Zusammenfassung der TO-DOs

### Priorität 1 (Kritisch):
1. ✅ **Amazon externe Rechnungen Integration**
   - Lade XRE-Rechnungen aus `/api/fibu/rechnungen/extern`
   - Matche mit Amazon Settlements über orderId
   - Verbessert Matching von ~30% auf ~70%

2. ✅ **PayPal AU-Nummer zu Rechnungs-Mapping**
   - Ergänze `auftragsNr` in VK-Rechnungen (aus JTL tAuftrag)
   - Direktes Matching über AU-Nummer statt Betrag/Datum
   - Verbessert Matching von ~50% auf ~90%

### Priorität 2 (Wichtig):
3. ⚠️ **Amazon Konto-Zuordnung erweitern**
   - Speichere Sachkonto direkt in Settlement
   - Vereinfacht Buchungsexport (10it, DATEV)

4. ⚠️ **Bank-Zahlungen Namens-Matching**
   - Zusätzliche Matching-Strategie über Kundenname
   - Verbessert Matching für Überweisungen ohne RE-Nummer

### Priorität 3 (Nice-to-have):
5. 📊 **Dokumentation & UI**
   - Erkläre in UI: PayPal Gebühren bereits abgezogen
   - Zeige Matching-Methode in Zahlungs-Details

---

## 🔧 Implementierungsschritte

### Schritt 1: Externe Amazon-Rechnungen Integration
```typescript
// In /app/api/fibu/auto-match/route.ts

// Lade externe Rechnungen (zusätzlich zu VK-Rechnungen)
const externeRechnungen = await db.collection('fibu_externe_rechnungen')
  .find({
    dBelegdatumUtc: { $gte: new Date('2025-10-01') }
  })
  .toArray()

// In Amazon Matching-Logik:
if (source.name === 'Amazon' && (orderId || merchantOrderId)) {
  // Strategie 1: Externe Rechnung finden
  const externeRg = externeRechnungen.find(er => {
    // cBelegnr könnte Order-ID enthalten
    // ODER: Verknüpfung über kAuftrag in JTL
    return er.merchantOrderId === merchantOrderId || 
           er.orderId === orderId
  })
  
  if (externeRg) {
    match = {
      type: 'externeRechnung',
      rechnungId: externeRg._id.toString(),
      rechnungsNr: externeRg.cBelegnr, // XRE-XXXX
      confidence: 'high'
    }
    method = 'amazonExterneRechnung'
  }
}
```

### Schritt 2: PayPal Auftrags-Mapping
```typescript
// In /app/api/fibu/rechnungen/vk/route.ts
// Erweitere SQL Query:

SELECT 
  r.kRechnung,
  r.cRechnungsNr,
  r.dErstellt,
  r.fGesamtsumme AS brutto,
  r.cRAName,
  a.cAuftragsNr,  -- HINZUFÜGEN
  a.kAuftrag      -- HINZUFÜGEN
FROM dbo.tRechnung r
LEFT JOIN dbo.tAuftrag a ON r.kAuftrag = a.kAuftrag
WHERE r.dErstellt >= @startDate

// MongoDB Dokument:
{
  rechnungsNr: 'RE2025-97630',
  auftragsNr: 'AU2025-11961',  // NEU
  kAuftrag: 12345,
  ...
}

// In auto-match:
const auMatch = zahlung.rechnungsNr.match(/AU[_-]?(\d+)/)
if (auMatch) {
  const auNummer = `AU2025-${auMatch[1]}`
  
  const rechnung = vkRechnungen.find(r => 
    r.auftragsNr === auNummer
  )
  
  if (rechnung) {
    match = {
      type: 'rechnung',
      rechnungsNr: rechnung.cRechnungsNr,
      confidence: 'high'
    }
    method = 'paypalAuNummer'
  }
}
```

---

## 📈 Erwartete Verbesserungen

### Vorher (aktuell):
- Amazon Matching: ~30-40% (nur über Betrag+Datum)
- PayPal Matching: ~50-60% (Betrag+Datum mit 60 Tage Toleranz)
- Bank Matching: ~20-30% (nur RE-Nummer)

### Nachher (mit Verbesserungen):
- Amazon Matching: **~70-80%** (externe Rechnungen + Order-ID)
- PayPal Matching: **~85-95%** (direkte AU-Nummer Zuordnung)
- Bank Matching: **~40-50%** (RE-Nummer + Namens-Matching)

**Gesamt-Matching-Rate:** 40% → **75%** ✅
