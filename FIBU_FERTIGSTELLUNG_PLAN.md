# FIBU-Modul Fertigstellung Plan
## Ziel: Oktober 2025 vollständig exportierbar machen

**Inspiration:** Lexoffice-Automatisierung (ChatGPT Deep Research)
**Deadline:** Vollständiger Export von Oktober 2025 möglich
**Architektur:** Next.js API Routes + MongoDB + MSSQL (JTL)

---

## Phase 1: Auto-Matching Kern-Engine ⭐ (Höchste Priorität)
**Dauer:** 2-3 Tage
**Ziel:** Automatische Zuordnung von Zahlungen zu Belegen mit Confidence-Score

### 1.1 Matching-Strategien implementieren

#### a) Rechnungsnummer-Matching (Regex)
```javascript
// Muster: RE2025-84503, RE-2025/01-2596, etc.
const patterns = [
  /RE\s*(\d{4})[\/\-](\d+)/i,
  /Rechnung\s+(\d+)/i,
  /Invoice\s+([A-Z0-9\-]+)/i
]
```
**Confidence:** HIGH (95%)

#### b) AU-Nummern-Matching (Auftragsnummer)
```javascript
// Muster: AU-18279-S, AU2024-62889
const auPattern = /AU[\-\s]?(\d+)[\-\s]?([A-Z])?/i
```
**Confidence:** HIGH (90%)

#### c) Amazon Order-ID Matching
```javascript
// Muster: 304-5637397-9461931
const amazonPattern = /\d{3}-\d{7}-\d{7}/
```
**Confidence:** HIGH (90%)

#### d) Betrag + Datum Heuristik
```javascript
// ±0,50 € Toleranz, ±7 Tage
const tolerance = {
  betrag: 0.50,
  tageVorher: 7,
  tageNachher: 3
}
```
**Confidence:** MEDIUM (60-80%)

#### e) Teilzahlungs-Erkennung
```javascript
// Wenn Zahlung < Rechnungsbetrag um >5%
if (zahlung < rechnung * 0.95) {
  // Teilzahlung
}
```
**Confidence:** MEDIUM (70%)

### 1.2 MongoDB Collections

```javascript
// fibu_matching_rules (Lern-Datenbank)
{
  _id: ObjectId,
  pattern: String,          // z.B. "Lieferant XYZ"
  matchType: String,        // "vendor", "category", "keyword"
  targetKonto: String,      // z.B. "6825"
  targetSteuersatz: Number, // 19, 7, 0
  confidence: Number,       // 0.0 - 1.0
  usageCount: Number,       // Wie oft verwendet
  lastUsed: Date,
  createdBy: String,        // "auto" oder "manual"
  createdAt: Date
}

// fibu_matching_history (für Learning)
{
  _id: ObjectId,
  zahlungId: String,
  belegId: String,
  matchMethod: String,      // "re_nummer", "au_nummer", etc.
  confidence: Number,
  isCorrect: Boolean,       // User-Feedback
  createdAt: Date
}
```

### 1.3 API Endpoints

**POST /api/fibu/auto-match**
```typescript
Input: {
  zeitraum?: string,      // "2025-10-01_2025-10-31"
  dryRun?: boolean,       // Test-Modus
  limit?: number,         // Max. zu verarbeitende Items
  sources?: string[]      // ["paypal", "bank", "amazon"]
}

Output: {
  matched: [
    {
      zahlungId: string,
      belegId: string,
      method: string,
      confidence: number,
      details: object
    }
  ],
  stats: {
    totalZahlungen: number,
    matched: number,
    byMethod: object,
    byConfidence: {
      high: number,
      medium: number,
      low: number
    }
  }
}
```

**GET /api/fibu/matching-suggestions**
```typescript
// Für Frontend: Zeige offene Zuordnungsvorschläge
Output: [
  {
    zahlung: object,
    suggestions: [
      {
        beleg: object,
        confidence: number,
        reason: string
      }
    ]
  }
]
```

### 1.4 Autonome Testphase 1
**Test-Script:** `/app/scripts/test-auto-matching.js`

```javascript
// Test-Cases:
1. PayPal mit AU-Nummer → Rechnung (erwarte: HIGH confidence)
2. Bank mit RE-Nummer → Rechnung (erwarte: HIGH confidence)
3. Amazon Order-ID → XRE-Rechnung (erwarte: HIGH confidence)
4. Betrag+Datum ohne Referenz → (erwarte: MEDIUM confidence)
5. Teilzahlung erkennen → (erwarte: MEDIUM confidence, partial=true)
6. Keine Übereinstimmung → (erwarte: null Match)
```

**Erfolgskriterien:**
- ✅ Mindestens 80% der Zahlungen mit HIGH confidence zugeordnet
- ✅ Keine False Positives (falsche Zuordnungen)
- ✅ Dry-Run funktioniert ohne DB-Änderungen
- ✅ Alle Test-Cases bestanden

---

## Phase 2: Lernfähiges Konto-Mapping 🧠
**Dauer:** 2 Tage
**Ziel:** Intelligente Kontenzuordnung mit Lerneffekt

### 2.1 Kontierungs-Regeln (Statisch)

```javascript
// /app/lib/fibu/konto-mappings.ts
export const KONTO_MAPPINGS = {
  // Amazon
  'Commission': { konto: '4970', steuer: 19, bezeichnung: 'Provisionen' },
  'AdvertisingFee': { konto: '4630', steuer: 19, bezeichnung: 'Werbekosten' },
  'FBAFee': { konto: '4950', steuer: 19, bezeichnung: 'FBA-Gebühren' },
  'Refund': { konto: '8200', steuer: 19, bezeichnung: 'Erlösschmälerungen' },
  
  // PayPal
  'PayPal Fee': { konto: '4950', steuer: 19, bezeichnung: 'PayPal-Gebühren' },
  
  // Bank
  'Telekom': { konto: '6825', steuer: 19, bezeichnung: 'Telekommunikation' },
  'Miete': { konto: '6400', steuer: 0, bezeichnung: 'Mieten' },
  'Versicherung': { konto: '6300', steuer: 19, bezeichnung: 'Versicherungen' }
}
```

### 2.2 Learning-Algorithmus

```typescript
async function suggestKonto(zahlung: Zahlung): Promise<KontoSuggestion> {
  // 1. Prüfe statische Mappings
  const staticMatch = checkStaticMappings(zahlung);
  if (staticMatch) return { ...staticMatch, confidence: 0.95 };
  
  // 2. Prüfe Learning-Database
  const learnedMatch = await findLearnedPattern(zahlung);
  if (learnedMatch) return { ...learnedMatch, confidence: 0.85 };
  
  // 3. Keyword-basierte Suche
  const keywordMatch = await keywordSearch(zahlung.verwendungszweck);
  if (keywordMatch) return { ...keywordMatch, confidence: 0.70 };
  
  // 4. Vendor-basierte Suche (gleicher Lieferant wie vorher)
  const vendorMatch = await findByVendor(zahlung.gegenpartei);
  if (vendorMatch) return { ...vendorMatch, confidence: 0.75 };
  
  return null; // Keine Zuordnung gefunden
}
```

### 2.3 User-Feedback Loop

**POST /api/fibu/zahlungen/zuordnen**
```typescript
Input: {
  zahlungId: string,
  konto: string,
  steuersatz: number,
  saveAsRule?: boolean  // Als Lern-Regel speichern
}

// Bei saveAsRule=true:
// 1. Extrahiere Pattern (Vendor, Kategorie, Keywords)
// 2. Speichere in fibu_matching_rules
// 3. Erhöhe usageCount bei jedem weiteren Match
```

### 2.4 Autonome Testphase 2
**Test-Script:** `/app/scripts/test-konto-mapping.js`

```javascript
// Test-Cases:
1. Amazon Commission → erwarte: 4970, 19% Steuer
2. PayPal Gebühr → erwarte: 4950, 19% Steuer
3. Unbekannter Vendor (erstmals) → erwarte: null
4. Gleicher Vendor (2. Mal nach manuellem Mapping) → erwarte: gelerntes Konto
5. Keyword "Miete" → erwarte: 6400, 0% Steuer
```

**Erfolgskriterien:**
- ✅ Alle statischen Mappings korrekt
- ✅ Learning funktioniert nach 1x manueller Zuordnung
- ✅ Keyword-Matching findet 60%+ der Fälle
- ✅ Vendor-Matching funktioniert

---

## Phase 3: DATEV/10it Export 📤
**Dauer:** 3 Tage
**Ziel:** Korrekter EXTF-Format Export

### 3.1 Export-Struktur (basierend auf Excel-Analyse)

**11 Felder:**
```
1. Konto (z.B. "1200" - Forderungen)
2. Kontobezeichnung (z.B. "Forderungen aus LuL")
3. Datum (TT.MM.JJJJ - z.B. "01.01.2025")
4. Belegnummer (z.B. "RE2025-84503" oder "AU-18279-S")
5. Buchungstext (z.B. "Zahlungseingang: RE2025-84503 - DE")
6. Gegenkonto (z.B. "1820" - PayPal, "8400" - Erlöse)
7. Betrag Soll (z.B. "119,00")
8. Betrag Haben (z.B. "0,00")
9. Steuersatz (z.B. "19,00" oder "0,00")
10. Steuerkonto (z.B. "3806" - USt 19%, leer bei 0%)
11. Land/USt-ID (z.B. "DE", "AT", "FR" - für IGL-Kunden)
```

### 3.2 Sammeldebitoren-Logik

```typescript
function getDebitorKonto(rechnung: VKRechnung): string {
  // IGL-Kunden mit USt-ID → Einzeldebitor
  if (rechnung.ustId && rechnung.land !== 'DE') {
    return getOrCreateDebitorForCustomer(rechnung.kunde);
  }
  
  // Sammeldebitoren nach Zahlungsart
  const sammeldebitorenMap = {
    'paypal': '10100',      // Sammeldebitor PayPal
    'amazon': '10200',      // Sammeldebitor Amazon
    'mollie': '10300',      // Sammeldebitor Mollie
    'bank': '10400',        // Sammeldebitor Überweisung
    'ebay': '10500'         // Sammeldebitor eBay
  };
  
  return sammeldebitorenMap[rechnung.zahlungsart] || '10999'; // Fallback
}
```

### 3.3 Buchungssatz-Generierung

```typescript
// VK-Rechnung (2 Buchungssätze)
function createVKBuchungen(rechnung: VKRechnung): Buchung[] {
  const debitorKonto = getDebitorKonto(rechnung);
  const erlösKonto = getErlösKonto(rechnung.land, rechnung.ustId);
  const steuersatz = getSteuersatz(rechnung.land, rechnung.ustId);
  
  // 1. Rechnung: Forderung an Erlös
  const rechnungBuchung = {
    konto: debitorKonto,
    kontoBezeichnung: getKontoName(debitorKonto),
    datum: formatDate(rechnung.rechnungsdatum),
    belegnummer: rechnung.cRechnungsNr,
    buchungstext: `${rechnung.cRechnungsNr} - ${rechnung.land}`,
    gegenkonto: erlösKonto,
    sollBetrag: rechnung.brutto,
    habenBetrag: 0,
    steuersatz: steuersatz,
    steuerkonto: getSteuerkonto('ust', steuersatz),
    land: rechnung.land
  };
  
  // 2. Zahlung: Bank an Forderung (nur wenn bezahlt)
  const zahlungBuchung = rechnung.istBezahlt ? {
    konto: debitorKonto,
    kontoBezeichnung: getKontoName(debitorKonto),
    datum: formatDate(rechnung.zahlungsdatum),
    belegnummer: rechnung.zahlungsreferenz,
    buchungstext: `Zahlungseingang: ${rechnung.cRechnungsNr} - ${rechnung.land}`,
    gegenkonto: getBankKonto(rechnung.zahlungsart),
    sollBetrag: 0,
    habenBetrag: rechnung.brutto,
    steuersatz: 0, // Zahlung ist steuerfrei
    steuerkonto: '',
    land: rechnung.land
  } : null;
  
  return [rechnungBuchung, zahlungBuchung].filter(Boolean);
}
```

### 3.4 CSV-Generierung

```typescript
function generate10itCSV(buchungen: Buchung[]): string {
  // UTF-8 BOM
  let csv = '\uFEFF';
  
  // Header (DATEV EXTF)
  csv += '"EXTF";"300";"21";"Buchungsstapel";"1";"'+ new Date().toISOString() +'";"RE1";"Score Schleifwerkzeuge"\n';
  csv += '"Konto";"Kontobezeichnung";"Belegdatum";"Belegnummer";"Buchungstext";"Gegenkonto";"Soll";"Haben";"Steuersatz";"Steuerkonto";"Land"\n';
  
  // Buchungszeilen
  buchungen.forEach(b => {
    csv += `"${b.konto}";"${b.kontoBezeichnung}";"${b.datum}";"${b.belegnummer}";"${b.buchungstext}";"${b.gegenkonto}";"${formatBetrag(b.sollBetrag)}";"${formatBetrag(b.habenBetrag)}";"${formatBetrag(b.steuersatz)}";"${b.steuerkonto}";"${b.land}"\n`;
  });
  
  return csv;
}

function formatBetrag(betrag: number): string {
  // Deutsches Format: 1.234,56
  return betrag.toFixed(2).replace('.', ',');
}
```

### 3.5 API Endpoint

**GET /api/fibu/export/10it**
```typescript
Input Query Params: {
  from: "2025-10-01",
  to: "2025-10-31",
  type: "alle" | "vk" | "ek"
}

Output: CSV-Datei (application/csv)
Response Headers:
  Content-Type: text/csv; charset=utf-8
  Content-Disposition: attachment; filename="Buchungsstapel_2025-10.csv"
```

### 3.6 Autonome Testphase 3
**Test-Script:** `/app/scripts/test-10it-export.js`

```javascript
// Test-Cases:
1. Export Oktober 2025 VK-Rechnungen:
   - Prüfe: Alle Rechnungen ab 01.10.2025 enthalten
   - Prüfe: Sammeldebitoren korrekt (PayPal → 10100, Amazon → 10200)
   - Prüfe: IGL-Kunden mit USt-ID haben Einzeldebitor
   - Prüfe: Steuersätze korrekt (DE 19%, AT/FR/IT nach Land)

2. Export Oktober 2025 Zahlungen:
   - Prüfe: Zahlungsdatum korrekt
   - Prüfe: Bank-Konten richtig (PayPal → 1820, Commerzbank → 1800)
   - Prüfe: Keine Doppelbuchungen

3. CSV-Format:
   - Prüfe: UTF-8 BOM vorhanden
   - Prüfe: Semikolon-Trennzeichen
   - Prüfe: Deutsches Zahlenformat (Komma)
   - Prüfe: Alle Felder in Anführungszeichen
   
4. Vergleich mit Vorlage:
   - Lade Excel "EXTF_Buchungsstapel_2605_2025_01 aus 10it_ohne_Jahresübertrag.xlsx"
   - Vergleiche Struktur und Format
   - Prüfe Konsistenz
```

**Erfolgskriterien:**
- ✅ CSV parsebar durch DATEV/10it
- ✅ Alle VK-Rechnungen korrekt exportiert
- ✅ Sammeldebitoren-Logik funktioniert
- ✅ IGL-Kunden separat geführt
- ✅ Zahlen im deutschen Format
- ✅ Kein Fehler beim Import in 10it (Manueller Test)

---

## Phase 4: Synchronisation & Persistenz 🔄
**Dauer:** 1-2 Tage
**Ziel:** Alle Zahlungen für Oktober 2025 vollständig vorhanden

### 4.1 Synchronisations-Übersicht

```typescript
// Quellen für Oktober 2025:
const sources = [
  { name: 'JTL', status: '✅ Vorhanden (MSSQL)' },
  { name: 'Commerzbank', status: '✅ JTL-Abgleich' },
  { name: 'Postbank', status: '✅ CSV-Import' },
  { name: 'PayPal', status: '⚠️ API-Sync prüfen' },
  { name: 'Mollie', status: '⚠️ API-Sync prüfen' },
  { name: 'Amazon Settlements', status: '✅ JTL + MongoDB' },
  { name: 'eBay Payment', status: '⚠️ API-Sync prüfen' }
];
```

### 4.2 Vollständigkeits-Check

**GET /api/fibu/sync/status**
```typescript
Output: {
  zeitraum: { from: "2025-10-01", to: "2025-10-31" },
  sources: [
    {
      name: "PayPal",
      lastSync: "2025-11-29T10:00:00Z",
      transactionsCount: 450,
      isComplete: true,
      gaps: [] // Zeiträume ohne Daten
    },
    // ... weitere Quellen
  ],
  completeness: {
    percentage: 95,
    missingDays: ["2025-10-15", "2025-10-16"],
    warning: "PayPal: 2 Tage Lücke"
  }
}
```

### 4.3 Manueller Sync-Button (Frontend)

```typescript
// POST /api/fibu/sync/trigger
async function triggerSync(source: string, zeitraum: {from, to}) {
  // Beispiel für PayPal
  if (source === 'paypal') {
    const transactions = await fetchPayPalTransactions(zeitraum);
    await saveToMongo('fibu_paypal_transactions', transactions);
  }
  
  // Duplikaterkennung via unique Index
  // Index auf: { datum, betrag, referenz }
}
```

### 4.4 Autonome Testphase 4
**Test-Script:** `/app/scripts/test-synchronisation.js`

```javascript
// Test-Cases:
1. Vollständigkeits-Check Oktober 2025:
   - Prüfe: Alle Quellen haben Daten für jeden Tag
   - Prüfe: Keine Lücken > 1 Tag
   
2. Duplikaterkennung:
   - Importiere gleiche Zahlung 2x
   - Erwarte: Nur 1x in DB (unique constraint)
   
3. Sync-Trigger:
   - Trigger manuellen Sync für PayPal
   - Erwarte: Neue Transaktionen in MongoDB
```

**Erfolgskriterien:**
- ✅ Alle Quellen haben Daten für Oktober 2025
- ✅ Keine Lücken > 1 Tag
- ✅ Duplikaterkennung funktioniert
- ✅ Manueller Sync funktioniert

---

## Phase 5: End-to-End Integration & Test 🎯
**Dauer:** 2 Tage
**Ziel:** Vollständiger Export Oktober 2025

### 5.1 Integrations-Workflow

```
1. Synchronisation
   ↓ Alle Zahlungsquellen für Oktober 2025
   
2. Auto-Matching
   ↓ Zahlungen → Belege zuordnen
   
3. Konto-Mapping
   ↓ Nicht-zugeordnete Zahlungen → Konten
   
4. Manuelle Nachbearbeitung (falls nötig)
   ↓ User korrigiert Vorschläge
   
5. Export
   ↓ CSV für DATEV/10it
   
6. Import in 10it
   ✅ Erfolg!
```

### 5.2 Gesamt-Test-Script

**`/app/scripts/test-oktober-2025-export.js`**

```javascript
async function testOktober2025Export() {
  console.log('🚀 Starte Gesamt-Test für Oktober 2025 Export\n');
  
  // 1. Daten-Check
  console.log('📊 Phase 1: Daten-Vollständigkeit');
  const syncStatus = await fetch('/api/fibu/sync/status?from=2025-10-01&to=2025-10-31').then(r => r.json());
  assert(syncStatus.completeness.percentage >= 95, 'Mindestens 95% Vollständigkeit');
  console.log('✅ Daten vollständig\n');
  
  // 2. Auto-Matching
  console.log('🔗 Phase 2: Auto-Matching');
  const matchResult = await fetch('/api/fibu/auto-match', {
    method: 'POST',
    body: JSON.stringify({
      zeitraum: '2025-10-01_2025-10-31',
      dryRun: false
    })
  }).then(r => r.json());
  assert(matchResult.stats.matched / matchResult.stats.totalZahlungen >= 0.8, 'Min. 80% zugeordnet');
  console.log(`✅ ${matchResult.stats.matched} von ${matchResult.stats.totalZahlungen} Zahlungen zugeordnet\n`);
  
  // 3. Konto-Mapping
  console.log('📝 Phase 3: Konto-Mapping für Rest');
  const unmapped = matchResult.stats.totalZahlungen - matchResult.stats.matched;
  // TODO: Konto-Mapping für verbleibende Zahlungen
  console.log(`✅ ${unmapped} Zahlungen benötigen Konto-Mapping\n`);
  
  // 4. Export-Test
  console.log('📤 Phase 4: Export generieren');
  const exportResponse = await fetch('/api/fibu/export/10it?from=2025-10-01&to=2025-10-31&type=alle');
  assert(exportResponse.ok, 'Export erfolgreich');
  
  const csv = await exportResponse.text();
  
  // CSV-Format prüfen
  assert(csv.startsWith('\uFEFF'), 'UTF-8 BOM vorhanden');
  assert(csv.includes('EXTF'), 'DATEV Header vorhanden');
  assert(csv.split('\n').length > 100, 'Mindestens 100 Buchungssätze');
  
  // Speichere Export für manuelle Prüfung
  await fs.writeFile('/tmp/Buchungsstapel_Oktober_2025.csv', csv);
  console.log('✅ Export generiert: /tmp/Buchungsstapel_Oktober_2025.csv\n');
  
  // 5. Format-Validierung
  console.log('✔️  Phase 5: Format-Validierung');
  const lines = csv.split('\n');
  const dataLines = lines.slice(2); // Skip Header
  
  dataLines.forEach((line, i) => {
    if (!line.trim()) return;
    const fields = line.split(';').map(f => f.replace(/"/g, ''));
    assert(fields.length === 11, `Zeile ${i+3}: Erwarte 11 Felder, habe ${fields.length}`);
    
    // Prüfe Datumsformat
    const datum = fields[2];
    assert(/\d{2}\.\d{2}\.\d{4}/.test(datum), `Zeile ${i+3}: Datum ungültig: ${datum}`);
    
    // Prüfe Betragsformat (Komma als Dezimaltrennzeichen)
    const soll = fields[6];
    const haben = fields[7];
    assert(/^\d{1,10},\d{2}$/.test(soll) || soll === '0,00', `Zeile ${i+3}: Soll-Betrag ungültig: ${soll}`);
    assert(/^\d{1,10},\d{2}$/.test(haben) || haben === '0,00', `Zeile ${i+3}: Haben-Betrag ungültig: ${haben}`);
  });
  
  console.log('✅ Format-Validierung bestanden\n');
  
  // 6. Statistik
  console.log('📈 Statistik:');
  console.log(`- Zeitraum: Oktober 2025`);
  console.log(`- Buchungssätze: ${dataLines.length - 1}`);
  console.log(`- Auto-Match-Rate: ${(matchResult.stats.matched / matchResult.stats.totalZahlungen * 100).toFixed(1)}%`);
  console.log(`- Export-Datei: /tmp/Buchungsstapel_Oktober_2025.csv`);
  
  console.log('\n🎉 ALLE TESTS BESTANDEN! Oktober 2025 ist exportierbar.');
  
  return {
    success: true,
    exportPath: '/tmp/Buchungsstapel_Oktober_2025.csv',
    stats: {
      buchungssätze: dataLines.length - 1,
      autoMatchRate: (matchResult.stats.matched / matchResult.stats.totalZahlungen * 100).toFixed(1) + '%'
    }
  };
}
```

### 5.3 Manuelle Validierung

**Checkliste für User:**
```
□ CSV in 10it importieren
□ Keine Fehler beim Import
□ Sammeldebitoren korrekt zugeordnet
□ IGL-Kunden mit USt-ID haben Einzeldebitor
□ Steuersätze plausibel (DE 19%, EU-Ausland nach Land)
□ Buchungssummen stimmen mit Oktober 2025 überein
□ Keine Doppelbuchungen
```

### 5.4 Erfolgskriterien Gesamt

- ✅ Oktober 2025 vollständig exportiert
- ✅ CSV-Import in 10it erfolgreich
- ✅ Auto-Match-Rate > 80%
- ✅ Kein manueller Aufwand für Standard-Fälle
- ✅ Alle Sammeldebitoren korrekt
- ✅ Steuersätze korrekt
- ✅ Buchungssummen plausibel

---

## Zeitplan & Meilensteine

| Phase | Dauer | Abschluss | Meilenstein |
|-------|-------|-----------|-------------|
| Phase 1 | 2-3 Tage | Tag 3 | Auto-Matching funktioniert |
| Phase 2 | 2 Tage | Tag 5 | Konto-Mapping mit Learning |
| Phase 3 | 3 Tage | Tag 8 | 10it Export korrekt |
| Phase 4 | 1-2 Tage | Tag 10 | Alle Daten synchronisiert |
| Phase 5 | 2 Tage | Tag 12 | **Oktober 2025 exportierbar** |

**Gesamt: ~12 Arbeitstage**

---

## Autonome Test-Strategie

Jede Phase hat einen **eigenen Test-Script**, der:
1. Automatisch alle Testfälle durchläuft
2. Erfolgskriterien prüft
3. Bei Fehlern: Detailliertes Debugging-Log
4. Bei Erfolg: Nächste Phase freischalten

**Test-Execution:**
```bash
# Phase 1
node /app/scripts/test-auto-matching.js

# Phase 2
node /app/scripts/test-konto-mapping.js

# Phase 3
node /app/scripts/test-10it-export.js

# Phase 4
node /app/scripts/test-synchronisation.js

# Phase 5 (Gesamt)
node /app/scripts/test-oktober-2025-export.js
```

---

## Technische Voraussetzungen

### MongoDB Collections (neu):
- `fibu_matching_rules` (Lern-Datenbank)
- `fibu_matching_history` (Learning-Feedback)
- `fibu_debitoren` (Stammdaten Kunden)
- `fibu_kreditoren` (Stammdaten Lieferanten)

### API Routes (neu):
- `POST /api/fibu/auto-match`
- `GET /api/fibu/matching-suggestions`
- `POST /api/fibu/zahlungen/zuordnen`
- `GET /api/fibu/sync/status`
- `POST /api/fibu/sync/trigger`
- `GET /api/fibu/export/10it` (verbessert)

### Libraries:
- CSV-Parser/Generator
- Regex-Utils für Pattern-Matching
- Date-Utils für Perioden-Logik

---

## Nächster Schritt

**Beginnen mit Phase 1: Auto-Matching Kern-Engine**

Soll ich jetzt direkt mit der Implementierung starten? 🚀
