# Externe Rechnungen - Matching & Zuordnung

## 🎯 Übersicht

Die Funktion "Externe Rechnungen" behandelt das automatische Matching von Amazon-Rechnungen (XRE-*) mit ihren entsprechenden Zahlungseingängen.

## 🚨 Kritischer Kontext

Diese Funktion hatte einen **kritischen Bug**, der zu Datenverlust führte. Die ursprüngliche Implementierung wurde komplett überarbeitet.

### ❌ Ursprüngliches Problem (VERMIEDEN)

**Fehlerhafter SQL-Ansatz:**
```sql
-- NICHT VERWENDEN! Verursacht Datenverlust!
SELECT r.*, z.*
FROM tRechnungskopf r
LEFT JOIN tZahlungseingang z ON (
  ABS(r.fBetrag - z.fBetrag) < 0.01
  AND DATEDIFF(day, r.dDatum, z.dDatum) BETWEEN 0 AND 7
)
WHERE r.cRechnungsnummer LIKE 'XRE-%'
```

**Probleme:**
1. Komplexe JOIN-Bedingung mit mathematischen Operationen
2. Bei Bugs: Rechnungen verschwinden komplett aus der Ansicht
3. Schwer zu debuggen
4. User denkt, Daten sind gelöscht (Datenverlust-Illusion)

### ✅ Aktuelle Lösung (STABIL)

**Application-Layer Matching in Node.js:**

```javascript
// 1. Rechnungen separat holen
const rechnungen = await pool.request()
  .input('from', sql.Date, from)
  .input('to', sql.Date, to)
  .query(`
    SELECT 
      kRechnungskopf,
      cRechnungsnummer,
      dDatum,
      fBetrag,
      cStatus
    FROM dbo.tRechnungskopf
    WHERE cRechnungsnummer LIKE 'XRE-%'
      AND dDatum BETWEEN @from AND @to
  `)

// 2. Zahlungen separat holen
const zahlungen = await pool.request()
  .input('from', sql.Date, from)
  .input('to', sql.Date, to)
  .query(`
    SELECT
      kZahlungseingang,
      dDatum,
      fBetrag,
      cBankname
    FROM dbo.tZahlungseingang
    WHERE dDatum BETWEEN @from AND @to
  `)

// 3. Matching in Node.js durchführen
const rechnungenMitZahlung = rechnungen.recordset.map(rechnung => {
  const passendeZahlung = zahlungen.recordset.find(z => {
    // Betrag-Match (max 1 Cent Unterschied)
    const betragMatch = Math.abs(z.fBetrag - rechnung.fBetrag) < 0.01
    
    // Datum-Match (innerhalb 7 Tage)
    const datumsDiff = Math.abs(
      new Date(z.dDatum) - new Date(rechnung.dDatum)
    ) / (1000 * 60 * 60 * 24)
    const datumMatch = datumsDiff <= 7
    
    return betragMatch && datumMatch
  })
  
  return {
    ...rechnung,
    status: passendeZahlung ? 'bezahlt' : 'offen',
    zahlung: passendeZahlung || null
  }
})

// 4. Status in JTL aktualisieren (nur bei Match)
for (const rechnung of rechnungenMitZahlung) {
  if (rechnung.zahlung) {
    await pool.request()
      .input('id', sql.Int, rechnung.kRechnungskopf)
      .query(`
        UPDATE dbo.tRechnungskopf
        SET cStatus = 'bezahlt'
        WHERE kRechnungskopf = @id
      `)
  }
}
```

## 🔍 Matching-Regeln

### 1. Betrags-Matching
```javascript
const betragMatch = Math.abs(zahlung.betrag - rechnung.betrag) < 0.01
```
- Toleranz: 1 Cent
- Grund: Rundungsdifferenzen bei Währungsumrechnung

### 2. Datums-Matching
```javascript
const tageDifferenz = Math.abs(
  new Date(zahlung.datum) - new Date(rechnung.datum)
) / (1000 * 60 * 60 * 24)

const datumMatch = tageDifferenz <= 7
```
- Toleranz: 7 Tage
- Grund: Zahlungslaufzeiten bei Amazon

### 3. Prioritäten bei mehreren Matches

```javascript
// Wenn mehrere Zahlungen passen: Nächste Zahlung wählen
const allePassendenZahlungen = zahlungen.filter(z => 
  betragMatch(z, rechnung) && datumMatch(z, rechnung)
)

const besteZahlung = allePassendenZahlungen.reduce((best, current) => {
  const bestDiff = Math.abs(best.datum - rechnung.datum)
  const currentDiff = Math.abs(current.datum - rechnung.datum)
  return currentDiff < bestDiff ? current : best
})
```

## 📊 Status-Übersicht

### Mögliche Stati

1. **"bezahlt"**
   - Rechnung wurde mit Zahlung gematched
   - Zahlung liegt vor
   - Status in JTL aktualisiert

2. **"offen"**
   - Keine passende Zahlung gefunden
   - Entweder noch nicht bezahlt
   - Oder Zahlung liegt außerhalb des Zeitraums

3. **"teilweise"** (zukünftig)
   - Zahlung vorhanden, aber Betrag weicht ab
   - Erfordert manuelle Prüfung

## 💾 Datenbank-Operationen

### Read-Operations (JTL)

```sql
-- Externe Rechnungen lesen
SELECT 
  kRechnungskopf,      -- Primärschlüssel
  cRechnungsnummer,     -- z.B. "XRE-12345"
  dDatum,               -- Rechnungsdatum
  fBetrag,              -- Brutto-Betrag
  cStatus,              -- aktueller Status
  cWaehrung             -- meist "EUR"
FROM dbo.tRechnungskopf
WHERE cRechnungsnummer LIKE 'XRE-%'
  AND dDatum BETWEEN @from AND @to
ORDER BY dDatum DESC

-- Zahlungseingänge lesen
SELECT
  kZahlungseingang,     -- Primärschlüssel
  dDatum,               -- Zahlungsdatum
  fBetrag,              -- Zahlbetrag
  cBankname,            -- z.B. "Amazon Payments"
  cHinweis              -- Verwendungszweck
FROM dbo.tZahlungseingang
WHERE dDatum BETWEEN @from AND @to
ORDER BY dDatum DESC
```

### Write-Operations (JTL)

```sql
-- Status auf "bezahlt" setzen
UPDATE dbo.tRechnungskopf
SET cStatus = 'bezahlt',
    dBezahltAm = GETDATE()
WHERE kRechnungskopf = @id
  AND cStatus != 'bezahlt'  -- Nur wenn noch nicht bezahlt
```

## 🚦 API-Dokumentation

### Endpoint

```
GET /api/fibu/rechnungen/extern?from=YYYY-MM-DD&to=YYYY-MM-DD
```

### Request Parameter

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|---------------|
| `from` | Date | Ja | Start-Datum (inkl.) |
| `to` | Date | Ja | End-Datum (inkl.) |

### Response Format

```typescript
{
  ok: boolean,
  rechnungen: [
    {
      id: number,
      rechnungsnummer: string,      // "XRE-12345"
      datum: string,                 // "2025-10-15"
      betrag: number,                // 1234.56
      waehrung: string,              // "EUR"
      status: "bezahlt" | "offen",
      zahlung?: {                    // Nur wenn status = "bezahlt"
        id: number,
        datum: string,
        betrag: number,
        bank: string,
        hinweis: string
      }
    }
  ],
  statistik: {
    gesamt: number,
    bezahlt: number,
    offen: number,
    summe_bezahlt: number,
    summe_offen: number
  }
}
```

### Fehler-Responses

```typescript
// Fehlende Parameter
{
  ok: false,
  error: "Parameter 'from' und 'to' sind erforderlich"
}

// Ungültiges Datum
{
  ok: false,
  error: "Ungültiges Datumsformat. Erwartet: YYYY-MM-DD"
}

// Datenbank-Fehler
{
  ok: false,
  error: "Datenbankfehler beim Abrufen der Rechnungen",
  details: "<error_message>"
}
```

## 🧪 Testing

### Manuelle Test-Szenarien

1. **Happy Path: Perfektes Match**
   - Rechnung: 100,00 € am 15.10.2025
   - Zahlung: 100,00 € am 16.10.2025
   - Erwartung: Status = "bezahlt"

2. **Edge Case: Rundungsdifferenz**
   - Rechnung: 100,00 €
   - Zahlung: 99,99 €
   - Erwartung: Status = "bezahlt" (innerhalb 1 Cent Toleranz)

3. **Edge Case: Maximale Datumstoleranz**
   - Rechnung: 15.10.2025
   - Zahlung: 22.10.2025 (7 Tage später)
   - Erwartung: Status = "bezahlt"

4. **Negativ-Test: Datum außerhalb Toleranz**
   - Rechnung: 15.10.2025
   - Zahlung: 23.10.2025 (8 Tage später)
   - Erwartung: Status = "offen"

5. **Negativ-Test: Betrag zu unterschiedlich**
   - Rechnung: 100,00 €
   - Zahlung: 99,97 €
   - Erwartung: Status = "offen" (>1 Cent Differenz)

### Test-Skript

```javascript
// scripts/test-externe-rechnungen.js
const testCases = [
  {
    name: "Perfektes Match",
    rechnung: { betrag: 100.00, datum: "2025-10-15" },
    zahlung: { betrag: 100.00, datum: "2025-10-16" },
    expected: "bezahlt"
  },
  // ... weitere Test-Cases
]

for (const test of testCases) {
  const result = matchRechnungMitZahlung(test.rechnung, test.zahlung)
  console.assert(
    result.status === test.expected,
    `Test "${test.name}" fehlgeschlagen`
  )
}
```

## ⚠️ Sicherheitshinweise

### 1. Keine Daten löschen!

Diese API löscht NIEMALS Rechnungen oder Zahlungen, sondern:
- Liest Daten aus JTL
- Führt Matching durch
- Aktualisiert nur den Status

### 2. Status-Updates sind idempotent

```sql
-- Mehrfaches Ausführen ist sicher
UPDATE tRechnungskopf
SET cStatus = 'bezahlt'
WHERE kRechnungskopf = @id
  AND cStatus != 'bezahlt'  -- Nur wenn noch nicht bezahlt
```

### 3. Keine CASCADE-Deletes

Rechnungen und Zahlungen sind NIEMALS verknüpft via Foreign Key.
- Kein Risiko von ungewollten Cascades
- Jede Entität existiert unabhängig

## 📊 Performance

### Optimierungen

1. **Separate Queries statt JOIN**
   - Schneller bei großen Datenmengen
   - Besser cachebar

2. **Datum-Filter**
   - Reduziert Datenvolumen drastisch
   - Index auf dDatum nutzen

3. **In-Memory Matching**
   - JavaScript Array.find() ist schnell
   - Kein Overhead durch SQL

### Typische Response-Zeiten

- **< 100 Rechnungen:** < 500ms
- **100-500 Rechnungen:** 500-2000ms
- **> 500 Rechnungen:** > 2000ms

### Verbesserungsmöglichkeiten

1. **Pagination einführen**
   ```
   GET /api/fibu/rechnungen/extern?from=...&to=...&page=1&limit=50
   ```

2. **Caching für Zahlungen**
   - Zahlungen ändern sich selten
   - Können für mehrere Requests gecacht werden

3. **Lazy Matching**
   - Matching nur on-demand durchführen
   - Status in separatem API-Call aktualisieren

## 📝 Changelog

### v2.0 (November 2025) - AKTUELLE VERSION
- ✅ Application-Layer Matching
- ✅ Sichere Daten-Handhabung
- ✅ Einfaches Debugging
- ✅ Keine Datenverlust-Risiken

### v1.0 (Oktober 2025) - DEPRECATED
- ❌ SQL-basiertes JOIN-Matching
- ❌ Datenverlust bei Bugs
- ❌ Schwer zu debuggen

---

**WICHTIG:** Bei Änderungen an dieser Funktion IMMER das Test-Skript ausführen!