# Bank-Import - CSV-Transaktionen importieren

## 🎯 Überblick

Der Bank-Import ermöglicht das Einlesen von Kontoauszügen im CSV-Format und die Integration in die FIBU-Zahlungsübersicht.

## 📊 Unterstützte Formate

### Postbank CSV

Das System unterstützt das Standard-CSV-Format der Postbank:

```csv
Buchungstag;Wertstellung;Umsatzart;Buchungsdetails;Auftraggeber;Empfänger;Betrag;Saldo;Währung
15.10.2025;15.10.2025;Überweisung;Rechnung 12345;ACME GmbH;Musterfirma;-500,00;2500,00;EUR
16.10.2025;16.10.2025;Gutschrift;Zahlung Kunde;Kunde XY;Musterfirma;1000,00;3500,00;EUR
```

### Format-Details

| Spalte | Beschreibung | Beispiel |
|--------|--------------|----------|
| Buchungstag | Buchungsdatum | 15.10.2025 |
| Wertstellung | Valuta-Datum | 15.10.2025 |
| Umsatzart | Transaktionstyp | Überweisung |
| Buchungsdetails | Verwendungszweck | Rechnung 12345 |
| Auftraggeber | Zahler | ACME GmbH |
| Empfänger | Zahlungsempfänger | Musterfirma |
| Betrag | Betrag (Soll/Haben) | -500,00 |
| Saldo | Kontostand nach Buchung | 2500,00 |
| Währung | Währungscode | EUR |

## 🔄 Import-Prozess

### 1. CSV-Upload

```javascript
// Frontend: Datei auswählen
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  
  const formData = new FormData()
  formData.append('csv', file)
  
  const response = await fetch('/api/fibu/bank-import', {
    method: 'POST',
    body: formData
  })
  
  const result = await response.json()
  console.log(`${result.imported} Transaktionen importiert`)
}
```

### 2. CSV-Parsing (Backend)

```javascript
// /app/api/fibu/bank-import/route.ts
import { parse } from 'csv-parse/sync'

export async function POST(request) {
  // 1. Datei aus FormData extrahieren
  const formData = await request.formData()
  const file = formData.get('csv')
  const csvText = await file.text()
  
  // 2. CSV parsen
  const records = parse(csvText, {
    columns: true,              // Erste Zeile als Header
    delimiter: ';',             // Postbank nutzt Semikolon
    skip_empty_lines: true,
    trim: true
  })
  
  // 3. Jede Zeile verarbeiten
  const transaktionen = []
  const fehler = []
  
  for (const [index, record] of records.entries()) {
    try {
      const transaktion = parsePostbankRecord(record)
      transaktionen.push(transaktion)
    } catch (error) {
      fehler.push({
        zeile: index + 2,  // +2 wegen Header und 0-Index
        fehler: error.message,
        daten: record
      })
    }
  }
  
  // 4. In MongoDB speichern
  if (transaktionen.length > 0) {
    await db.collection('fibu_bank_transaktionen')
      .insertMany(transaktionen)
  }
  
  return Response.json({
    ok: true,
    imported: transaktionen.length,
    errors: fehler
  })
}
```

### 3. Datums- und Betrags-Parsing

```javascript
function parsePostbankRecord(record) {
  // Datum parsen: "15.10.2025" -> Date
  const [tag, monat, jahr] = record.Buchungstag.split('.')
  const buchungsdatum = new Date(`${jahr}-${monat}-${tag}`)
  
  // Betrag parsen: "-500,00" -> -500.00
  const betragStr = record.Betrag
    .replace('.', '')      // Tausender-Punkt entfernen
    .replace(',', '.')     // Komma durch Punkt ersetzen
  const betrag = parseFloat(betragStr)
  
  // Saldo parsen
  const saldoStr = record.Saldo
    .replace('.', '')
    .replace(',', '.')
  const saldo = parseFloat(saldoStr)
  
  return {
    buchungsdatum,
    wertstellung: parseDatum(record.Wertstellung),
    umsatzart: record.Umsatzart,
    verwendungszweck: record.Buchungsdetails,
    auftraggeber: record.Auftraggeber,
    empfaenger: record.Empfaenger,
    betrag,
    saldo,
    waehrung: record.Währung || 'EUR',
    quelle: 'postbank_csv',
    imported_at: new Date()
  }
}
```

## 💾 MongoDB-Schema

### Collection: `fibu_bank_transaktionen`

```javascript
{
  _id: ObjectId("..."),
  buchungsdatum: ISODate("2025-10-15T00:00:00Z"),
  wertstellung: ISODate("2025-10-15T00:00:00Z"),
  umsatzart: "Überweisung",
  verwendungszweck: "Rechnung 12345",
  auftraggeber: "ACME GmbH",
  empfaenger: "Musterfirma",
  betrag: -500.00,           // Negativ = Abgang, Positiv = Zugang
  saldo: 2500.00,
  waehrung: "EUR",
  quelle: "postbank_csv",
  imported_at: ISODate("2025-11-16T10:30:00Z")
}
```

### Indizes

```javascript
// Performance-Optimierung
db.fibu_bank_transaktionen.createIndex({ buchungsdatum: -1 })
db.fibu_bank_transaktionen.createIndex({ betrag: 1 })
db.fibu_bank_transaktionen.createIndex({ quelle: 1 })

// Duplikate vermeiden (optional)
db.fibu_bank_transaktionen.createIndex(
  { buchungsdatum: 1, betrag: 1, verwendungszweck: 1 },
  { unique: true, sparse: true }
)
```

## 🔗 Integration in Zahlungsübersicht

### API: `/api/fibu/zahlungen`

Die Zahlungsübersicht kombiniert Daten aus JTL und MongoDB:

```javascript
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  
  // 1. JTL-Zahlungen holen
  const jtlZahlungen = await fetchJTLZahlungen(from, to)
  
  // 2. MongoDB Bank-Transaktionen holen
  const bankTransaktionen = await db
    .collection('fibu_bank_transaktionen')
    .find({
      buchungsdatum: {
        $gte: new Date(from),
        $lte: new Date(to)
      }
    })
    .sort({ buchungsdatum: -1 })
    .toArray()
  
  // 3. Bank-Transaktionen in Zahlungs-Format konvertieren
  const bankZahlungen = bankTransaktionen.map(t => ({
    id: `bank_${t._id}`,
    datum: t.buchungsdatum,
    betrag: t.betrag,
    verwendungszweck: t.verwendungszweck,
    quelle: 'Postbank Import',
    typ: t.betrag > 0 ? 'Eingang' : 'Ausgang',
    raw: t
  }))
  
  // 4. Kombinieren und sortieren
  const alleZahlungen = [
    ...jtlZahlungen,
    ...bankZahlungen
  ].sort((a, b) => b.datum - a.datum)
  
  return Response.json({
    ok: true,
    zahlungen: alleZahlungen
  })
}
```

## ⚙️ Validierung

### Pflichtfelder

```javascript
function validateRecord(record, index) {
  const errors = []
  
  // Buchungsdatum
  if (!record.Buchungstag) {
    errors.push('Buchungsdatum fehlt')
  } else if (!isValidDate(record.Buchungstag)) {
    errors.push('Ungültiges Datumsformat')
  }
  
  // Betrag
  if (!record.Betrag) {
    errors.push('Betrag fehlt')
  } else if (isNaN(parseBetrag(record.Betrag))) {
    errors.push('Ungültiges Betragsformat')
  }
  
  // Saldo (optional, aber wenn vorhanden -> validieren)
  if (record.Saldo && isNaN(parseBetrag(record.Saldo))) {
    errors.push('Ungültiges Saldoformat')
  }
  
  if (errors.length > 0) {
    throw new Error(
      `Zeile ${index}: ${errors.join(', ')}`
    )
  }
}
```

### Duplikate erkennen

```javascript
async function checkDuplicates(transaktionen) {
  const existing = await db
    .collection('fibu_bank_transaktionen')
    .find({
      buchungsdatum: {
        $in: transaktionen.map(t => t.buchungsdatum)
      }
    })
    .toArray()
  
  const duplicates = transaktionen.filter(neu => 
    existing.some(alt => 
      alt.buchungsdatum.getTime() === neu.buchungsdatum.getTime() &&
      Math.abs(alt.betrag - neu.betrag) < 0.01 &&
      alt.verwendungszweck === neu.verwendungszweck
    )
  )
  
  return duplicates
}
```

## 🚦 API-Dokumentation

### Endpoint

```
POST /api/fibu/bank-import
Content-Type: multipart/form-data
```

### Request

```javascript
const formData = new FormData()
formData.append('csv', fileBlob, 'kontoauszug.csv')

fetch('/api/fibu/bank-import', {
  method: 'POST',
  body: formData
})
```

### Response (Erfolg)

```json
{
  "ok": true,
  "imported": 45,
  "errors": [],
  "message": "45 Transaktionen erfolgreich importiert"
}
```

### Response (Mit Fehlern)

```json
{
  "ok": true,
  "imported": 42,
  "errors": [
    {
      "zeile": 5,
      "fehler": "Ungültiges Datumsformat",
      "daten": { "Buchungstag": "invalid", "..." }
    },
    {
      "zeile": 12,
      "fehler": "Betrag fehlt",
      "daten": { "Buchungstag": "15.10.2025", "..." }
    }
  ],
  "message": "42 von 45 Transaktionen importiert (3 Fehler)"
}
```

### Response (Komplett fehlgeschlagen)

```json
{
  "ok": false,
  "error": "CSV-Datei konnte nicht gelesen werden",
  "details": "Unexpected token at line 1"
}
```

## 🎨 Frontend-Komponente

### BankImport.js

```javascript
export default function BankImport() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  
  const handleImport = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    setImporting(true)
    setResult(null)
    
    try {
      const formData = new FormData()
      formData.append('csv', file)
      
      const response = await fetch('/api/fibu/bank-import', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      setResult(data)
      
      if (data.ok && data.imported > 0) {
        // Erfolg: Liste neu laden
        loadTransaktionen()
      }
    } catch (error) {
      setResult({
        ok: false,
        error: error.message
      })
    } finally {
      setImporting(false)
    }
  }
  
  return (
    <div>
      <input
        type="file"
        accept=".csv"
        onChange={handleImport}
        disabled={importing}
      />
      
      {importing && <p>Importiere...</p>}
      
      {result && (
        <div className={result.ok ? 'success' : 'error'}>
          {result.ok ? (
            <>
              <p>✅ {result.imported} Transaktionen importiert</p>
              {result.errors.length > 0 && (
                <details>
                  <summary>{result.errors.length} Fehler</summary>
                  <ul>
                    {result.errors.map((err, i) => (
                      <li key={i}>
                        Zeile {err.zeile}: {err.fehler}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p>❌ {result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

## 🧪 Testing

### Test-CSV erstellen

```csv
Buchungstag;Wertstellung;Umsatzart;Buchungsdetails;Auftraggeber;Empfänger;Betrag;Saldo;Währung
15.10.2025;15.10.2025;Überweisung;Test 1;Firma A;Firma B;-100,00;1000,00;EUR
16.10.2025;16.10.2025;Gutschrift;Test 2;Firma C;Firma B;500,00;1500,00;EUR
17.10.2025;17.10.2025;Überweisung;Test 3;Firma B;Firma D;-250,50;1249,50;EUR
```

### Manuelle Tests

1. **Happy Path**
   - Korrekte CSV hochladen
   - Erwartung: Alle Zeilen importiert

2. **Fehlende Spalten**
   - CSV ohne "Betrag"-Spalte
   - Erwartung: Fehler-Response

3. **Ungültige Datumsformate**
   - "32.13.2025" (ungültiges Datum)
   - Erwartung: Zeile übersprungen, Fehler geloggt

4. **Duplikate**
   - Gleiche Datei zweimal hochladen
   - Erwartung: Duplikate erkannt

5. **Große Dateien**
   - CSV mit 1000+ Zeilen
   - Erwartung: < 5s Import-Zeit

## 🔐 Sicherheit

### File-Upload-Validierung

```javascript
// Nur CSV-Dateien erlauben
if (!file.name.endsWith('.csv')) {
  return Response.json({
    ok: false,
    error: 'Nur CSV-Dateien erlaubt'
  }, { status: 400 })
}

// Dateigröße limitieren (z.B. 10 MB)
if (file.size > 10 * 1024 * 1024) {
  return Response.json({
    ok: false,
    error: 'Datei zu groß (max 10 MB)'
  }, { status: 400 })
}
```

### SQL-Injection-Schutz

NICHT relevant, da:
- Keine SQL-Datenbank für Import
- MongoDB nutzt sichere Query-API
- Keine String-Konkatenation

### XSS-Schutz

Beim Anzeigen importierter Daten:
```javascript
// React escaped automatisch
<td>{transaktion.verwendungszweck}</td>
```

## 📊 Performance

### Batch-Insert

```javascript
// NICHT: Einzeln inserieren
for (const t of transaktionen) {
  await db.collection('fibu_bank_transaktionen').insertOne(t)
}

// BESSER: Batch-Insert
await db.collection('fibu_bank_transaktionen')
  .insertMany(transaktionen)
```

### Streaming für große Dateien

```javascript
import { pipeline } from 'stream/promises'
import { parse } from 'csv-parse'

const parser = parse({
  columns: true,
  delimiter: ';'
})

const transaktionen = []

parser.on('data', (record) => {
  const transaktion = parsePostbankRecord(record)
  transaktionen.push(transaktion)
  
  // Batch inserieren alle 100 Zeilen
  if (transaktionen.length >= 100) {
    await db.collection('fibu_bank_transaktionen')
      .insertMany(transaktionen.splice(0, 100))
  }
})

await pipeline(fileStream, parser)
```

---

**Hinweis:** Für andere Banken (Commerzbank, Sparkasse, etc.) muss das Parsing-Schema angepasst werden.