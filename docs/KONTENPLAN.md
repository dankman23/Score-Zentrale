# Kontenplan - SKR04 Verwaltung

## 🎯 Überblick

Der Kontenplan basiert auf dem deutschen **SKR04 (Abschlussgliederungsprinzip)** und umfasst 137+ Konten in 7 Hauptklassen.

## 📊 SKR04-Struktur

### Hierarchie

```
Kontenklasse (1-stellig)
  └─ Kontengruppe (2-stellig)
      └─ Kontenuntergruppe (3-stellig)
          └─ Konto (4-stellig)
```

### Beispiel

```
Klasse 1: Umlaufvermögen
  └─ Gruppe 18: Bank
      └─ Untergruppe 180: Bankkonten
          ├─ Konto 1802: Postbank
          ├─ Konto 1810: PayPal
          └─ Konto 1813: Commerzbank
```

## 📑 Kontenklassen

### Klasse 0: Anlagevermögen
```
0650 - EDV-Software
0670 - PKW
0690 - Büroeinrichtung
```
**Typ:** Aktiv  
**Verwendung:** Langfristige Vermögenswerte

### Klasse 1: Umlaufvermögen
```
1200 - Waren (Bestand)
1301 - Forderungen aus Lieferungen und Leistungen
1460 - Abziehbare Vorsteuer 19%
1802 - Postbank
1810 - PayPal
1813 - Commerzbank
1814 - eBay Payments
1815-1820 - Amazon Sammelkonten (IT/FR/DE/NL/ES/BE)
```
**Typ:** Aktiv  
**Verwendung:** Kurzfristige Vermögenswerte, Bank, Kasse

### Klasse 2: Eigenkapital (fehlt teilweise)
```
2020 - Eigenkapital
2050 - Kommanditkapital
2070 - Rücklagen
```
**Typ:** Passiv  
**Status:** ⚠️ 6 Konten fehlen noch in DB

### Klasse 3: Fremdkapital
```
3035 - Gesellschafter-Darlehen
3150 - Sonstige Rückstellungen
3300 - Verbindlichkeiten ggü Kreditinstituten
3720 - Verbindlichkeiten aus Lieferungen und Leistungen
3845 - Umsatzsteuer 19%
```
**Typ:** Passiv  
**Verwendung:** Rückstellungen, Verbindlichkeiten, Steuern

### Klasse 4: Betriebliche Erträge
```
4400 - Umsatzerlöse
4736 - Steuerfreie innergemeinschaftliche Lieferungen
4830 - Erlöse 19% USt
```
**Typ:** Ertrag  
**Verwendung:** Umsatzerlöse, steuerfreie/steuerpflichtige Umsätze

### Klasse 5: Betriebliche Aufwendungen
```
5900 - Wareneingang 19% Vorsteuer
5923 - Innergemeinschaftlicher Erwerb
```
**Typ:** Aufwand  
**Verwendung:** Wareneinkauf, Erlösschmälerungen

### Klasse 6: Betriebliche Aufwendungen
```
6130 - Gehälter
6325 - Gesetzliche soziale Aufwendungen
6700 - Werbekosten
6837 - Porto
6850 - Telefon
```
**Typ:** Aufwand  
**Verwendung:** Personal, Raumkosten, Fahrzeuge, Marketing, Verwaltung

### Klasse 7: Weitere Erträge/Aufwendungen
```
7000 - Rechts- und Beratungskosten
7320 - Abschluss- und Prüfungskosten
7610 - Buchführungskosten
```
**Typ:** Aufwand  
**Verwendung:** Sonderposten, außerordentliche Aufwendungen

### Klasse 9: Vorträge & Statistik
```
9000 - Saldenvorträge Sachkonten
9008 - Saldenvorträge Debitoren
9009 - Saldenvorträge Kreditoren
```
**Typ:** Sonder  
**Verwendung:** Jahresabschluss, Vortragssystem

## 💾 MongoDB-Schema

### Collection: `fibu_konten`

```javascript
{
  _id: ObjectId("..."),
  kontonummer: "1802",              // 4-stellig, unique
  bezeichnung: "Postbank",
  kontenklasse: 1,                  // 0-9
  kontengruppe: "18",               // 2-stellig
  kontenuntergruppe: "180",         // 3-stellig
  kontenklasseBezeichnung: "Umlaufvermögen",
  kontenklasseTyp: "aktiv",         // aktiv/passiv/ertrag/aufwand/sonder
  steuerrelevant: false,
  istAktiv: true,
  istSystemkonto: true,             // Nicht löschbar
  bemerkung: null,
  created_at: ISODate("2025-11-14T17:41:10.351Z"),
  updated_at: ISODate("2025-11-14T17:41:19.888Z")
}
```

### Indizes

```javascript
db.fibu_konten.createIndex({ kontonummer: 1 }, { unique: true })
db.fibu_konten.createIndex({ kontenklasse: 1, kontengruppe: 1 })
db.fibu_konten.createIndex({ bezeichnung: "text" })  // Volltextsuche
db.fibu_konten.createIndex({ istAktiv: 1 })
```

## 🛠️ CRUD-Operationen

### API: `/api/fibu/kontenplan`

#### GET - Alle Konten abrufen

```typescript
GET /api/fibu/kontenplan

Response:
{
  ok: true,
  konten: [
    {
      kontonummer: "1802",
      bezeichnung: "Postbank",
      kontenklasse: 1,
      // ...
    }
  ],
  total: 137
}
```

#### GET - Einzelnes Konto

```typescript
GET /api/fibu/kontenplan?kontonummer=1802

Response:
{
  ok: true,
  konto: {
    kontonummer: "1802",
    bezeichnung: "Postbank",
    // ...
  }
}
```

#### POST - Neues Konto anlegen

```typescript
POST /api/fibu/kontenplan
Content-Type: application/json

Body:
{
  "kontonummer": "1899",
  "bezeichnung": "Neues Bankkonto",
  "kontenklasse": 1,
  "kontengruppe": "18",
  "kontenuntergruppe": "189",
  "kontenklasseBezeichnung": "Umlaufvermögen",
  "kontenklasseTyp": "aktiv",
  "steuerrelevant": false
}

Response:
{
  ok: true,
  konto: { ... },
  message: "Konto 1899 erfolgreich angelegt"
}
```

#### PUT - Konto bearbeiten

```typescript
PUT /api/fibu/kontenplan?kontonummer=1899
Content-Type: application/json

Body:
{
  "bezeichnung": "Geänderter Name",
  "istAktiv": true,
  "bemerkung": "Test-Konto"
}

Response:
{
  ok: true,
  message: "Konto 1899 aktualisiert"
}
```

#### DELETE - Konto löschen

```typescript
DELETE /api/fibu/kontenplan?kontonummer=1899

Response:
{
  ok: true,
  message: "Konto 1899 gelöscht"
}

// Fehler bei Systemkonten:
{
  ok: false,
  error: "Systemkonten können nicht gelöscht werden"
}
```

## 🎨 Frontend-Komponente

### KontenplanView.js - Hierarchische Darstellung

```javascript
export default function KontenplanView() {
  const [konten, setKonten] = useState([])
  const [activeKlasse, setActiveKlasse] = useState(1)
  
  useEffect(() => {
    loadKonten()
  }, [])
  
  const loadKonten = async () => {
    const res = await fetch('/api/fibu/kontenplan')
    const data = await res.json()
    setKonten(data.konten)
  }
  
  // Gruppierung nach Klasse
  const kontenNachKlasse = konten.reduce((acc, konto) => {
    if (!acc[konto.kontenklasse]) {
      acc[konto.kontenklasse] = []
    }
    acc[konto.kontenklasse].push(konto)
    return acc
  }, {})
  
  return (
    <div>
      {/* Tabs für Klassen */}
      <div className="tabs">
        {[0,1,3,4,5,6,7,9].map(klasse => (
          <button
            key={klasse}
            onClick={() => setActiveKlasse(klasse)}
            className={activeKlasse === klasse ? 'active' : ''}
          >
            Klasse {klasse}
          </button>
        ))}
      </div>
      
      {/* Konten der aktiven Klasse */}
      <KontenAccordion konten={kontenNachKlasse[activeKlasse] || []} />
    </div>
  )
}
```

### Accordion für Hierarchie

```javascript
function KontenAccordion({ konten }) {
  // Gruppierung nach Gruppe
  const gruppen = konten.reduce((acc, konto) => {
    if (!acc[konto.kontengruppe]) {
      acc[konto.kontengruppe] = []
    }
    acc[konto.kontengruppe].push(konto)
    return acc
  }, {})
  
  return (
    <div className="accordion">
      {Object.entries(gruppen).map(([gruppe, konten]) => (
        <details key={gruppe}>
          <summary>
            Gruppe {gruppe} ({konten.length} Konten)
          </summary>
          <ul>
            {konten.map(konto => (
              <li key={konto.kontonummer}>
                <strong>{konto.kontonummer}</strong> - {konto.bezeichnung}
                {konto.steuerrelevant && <span title="Steuerrelevant">💰</span>}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
```

## 🔍 Validierung

### Backend-Validierung

```javascript
function validateKonto(konto) {
  const errors = []
  
  // Kontonummer: 4-stellig, numerisch
  if (!/^\d{4}$/.test(konto.kontonummer)) {
    errors.push('Kontonummer muss 4-stellig sein')
  }
  
  // Bezeichnung: Nicht leer
  if (!konto.bezeichnung || konto.bezeichnung.trim() === '') {
    errors.push('Bezeichnung ist erforderlich')
  }
  
  // Kontenklasse: 0-9
  if (konto.kontenklasse < 0 || konto.kontenklasse > 9) {
    errors.push('Kontenklasse muss zwischen 0 und 9 liegen')
  }
  
  // Kontengruppe: 2-stellig
  if (!/^\d{2}$/.test(konto.kontengruppe)) {
    errors.push('Kontengruppe muss 2-stellig sein')
  }
  
  // Konsistenz: Gruppe muss mit Klasse beginnen
  if (!konto.kontengruppe.startsWith(String(konto.kontenklasse))) {
    errors.push('Kontengruppe muss mit Kontenklasse beginnen')
  }
  
  return errors
}
```

### Duplikat-Prüfung

```javascript
async function checkDuplicate(kontonummer) {
  const existing = await db.collection('fibu_konten')
    .findOne({ kontonummer })
  
  if (existing) {
    throw new Error(
      `Konto ${kontonummer} existiert bereits: ${existing.bezeichnung}`
    )
  }
}
```

## 📦 Import-Skript

### scripts/import-kontenplan-skr04.js

Dieses Skript importiert die 137 Standard-SKR04-Konten:

```javascript
const { MongoClient } = require('mongodb')

const skr04Konten = [
  {
    kontonummer: "0650",
    bezeichnung: "EDV-Software",
    kontenklasse: 0,
    kontengruppe: "06",
    kontenuntergruppe: "065",
    kontenklasseBezeichnung: "Anlagevermögen",
    kontenklasseTyp: "aktiv",
    steuerrelevant: false,
    istAktiv: true,
    istSystemkonto: true
  },
  // ... 136 weitere Konten
]

async function importKontenplan() {
  const client = await MongoClient.connect(process.env.MONGO_URL)
  const db = client.db('fibu')
  
  // Löschen bestehender Konten (Vorsicht!)
  await db.collection('fibu_konten').deleteMany({})
  
  // Alle Konten importieren
  const result = await db.collection('fibu_konten').insertMany(
    skr04Konten.map(konto => ({
      ...konto,
      created_at: new Date(),
      updated_at: new Date()
    }))
  )
  
  console.log(`✅ ${result.insertedCount} Konten importiert`)
  
  await client.close()
}

importKontenplan().catch(console.error)
```

### Ausführen

```bash
node scripts/import-kontenplan-skr04.js
```

## ⚠️ Wichtige Hinweise

### Systemkonten

Konten mit `istSystemkonto: true` dürfen **nicht gelöscht** werden:
- Standard-SKR04-Konten
- Alle importierten Konten

### Löschen nur für:
- Manuell angelegte Konten
- Test-Konten
- Nicht mehr benötigte Custom-Konten

### Deaktivieren statt Löschen

Besser: Konten deaktivieren (`istAktiv: false`) statt löschen:
```javascript
PUT /api/fibu/kontenplan?kontonummer=1899
Body: { "istAktiv": false }
```

Vorteile:
- Historische Buchungen bleiben gültig
- Konto kann reaktiviert werden
- Keine Datenintegritäts-Probleme

## 🔗 Integration mit anderen Modulen

### Zahlungseinstellungen

Zahlungseinstellungen referenzieren Konten:

```javascript
{
  name: "Amazon Payment",
  debitorKonto: "69002",   // → muss in fibu_konten existieren
  bankKonto: "1817",       // → muss in fibu_konten existieren
  gebuehrenKonto: "4985"   // → muss in fibu_konten existieren
}
```

### Kreditoren

Kreditoren werden Konten zugeordnet:

```javascript
{
  name: "Lieferant XY",
  kontoNummer: "3720"      // → Kreditorenkonto aus fibu_konten
}
```

### Buchungen (zukünftig)

Buchungen referenzieren immer Konten:

```javascript
{
  datum: "2025-10-15",
  sollKonto: "5900",       // Wareneingang
  habenKonto: "1802",      // Postbank
  betrag: 1000.00
}
```

## 📊 Statistiken

### Konten pro Klasse

```javascript
const stats = await db.collection('fibu_konten').aggregate([
  {
    $group: {
      _id: "$kontenklasse",
      anzahl: { $sum: 1 },
      aktiv: {
        $sum: { $cond: ["$istAktiv", 1, 0] }
      }
    }
  },
  { $sort: { _id: 1 } }
]).toArray()

// Ergebnis:
[
  { _id: 0, anzahl: 3, aktiv: 3 },
  { _id: 1, anzahl: 30, aktiv: 30 },
  { _id: 3, anzahl: 25, aktiv: 25 },
  // ...
]
```

### Steuerrelevante Konten

```javascript
const steuerkonten = await db.collection('fibu_konten')
  .find({ steuerrelevant: true })
  .count()

console.log(`${steuerkonten} steuerrelevante Konten`)
```

## 🚀 Zukünftige Erweiterungen

### 1. Konten-Historie

Tracken von Änderungen:

```javascript
// Collection: fibu_konten_history
{
  kontonummer: "1802",
  aenderung: "bezeichnung",
  alt: "Postbank alt",
  neu: "Postbank neu",
  geaendert_von: "user@example.com",
  geaendert_am: ISODate()
}
```

### 2. Konten-Templates

Vordefinierte Kontenpläne:
- SKR03 (Prozessgliederung)
- SKR04 (Abschlussgliederung) ✓
- IKR (Industriekontenrahmen)

### 3. Konten-Gruppen

Logische Gruppierung für Reports:

```javascript
{
  gruppe: "Liquide Mittel",
  konten: ["1802", "1810", "1813", "1814"]
}
```

---

**Letzte Aktualisierung:** November 2025  
**Konten-Stand:** 137 Konten