# 10it Export - Implementierungsplan

## 📊 Status: Was haben wir, was fehlt?

### ✅ VORHANDEN - Kann direkt verwendet werden

#### VK-Rechnungen (Verkauf)
- ✅ Rechnungsnummer, Datum, Kunde
- ✅ Bruttobetrag
- ✅ Debitorenkonto (via Business-Logik)
- ✅ Sachkonto (via Business-Logik)
- ⚠️  **MUSS BERECHNEN:** Netto, Steuer (aus Brutto)

#### VK-Zahlungen
- ✅ Zahlungsdatum, Betrag
- ✅ Zuordnung zur Rechnung
- ⚠️  **MUSS GENERIEREN:** Belegnummer ("AU-XXXXX-S")

#### Kontenplan
- ✅ Alle Kontostammdaten in MongoDB
- ✅ Kontonummer → Kontobezeichnung Mapping

### ❌ FEHLT - Muss implementiert werden

#### EK-Rechnungen (Einkauf)
- ✅ PDF-Daten vorhanden (Gemini geparst)
- ❌ **FEHLT:** Kreditorenkonto-Nummer (70xxx)
- ❌ **FEHLT:** Aufwandskonto (Gegenkonto)
- ❌ **FEHLT:** Lieferanten-Stammdaten System

#### EK-Zahlungen
- ❌ **KOMPLETT FEHLT** - Später implementieren

---

## 🎯 Implementierungs-Strategie (3 Phasen)

### PHASE 1: Export-Basis schaffen ⭐ PRIORITÄT
**Ziel:** Einfacher Export nur mit VK-Daten (Rechnungen + Zahlungen)

**Schritte:**
1. ✅ VK-Rechnungen API erweitern
   - Netto/Steuer-Berechnung hinzufügen
   - Steuersatz-Logik (19% DE, 0% EU mit USt-ID)

2. ✅ VK-Zahlungen API erweitern
   - Belegnummer-Generierung
   - Join mit Rechnungen für vollständige Daten

3. ✅ Export-API erstellen: `/api/fibu/export/10it`
   - Input: Datumsbereich (startDate, endDate)
   - Output: CSV-Datei im 10it-Format
   - Zunächst nur VK-Daten

4. ✅ Frontend: Export-Button in FibuModule
   - Datepicker für Zeitraum
   - Download-Funktion

**Output:** Funktionierender Export für Verkaufsseite

---

### PHASE 2: Lieferanten-Stammdaten 📦
**Ziel:** EK-Rechnungen in Export integrieren

**Schritte:**
1. ✅ MongoDB Collection `kreditoren` erstellen
   ```json
   {
     "_id": "uuid",
     "kreditorenNummer": "70197",
     "lieferantenName": "Idealo",
     "standardAufwandskonto": "6600",
     "createdAt": "2025-01-15T10:00:00Z"
   }
   ```

2. ✅ API `/api/fibu/kreditoren`:
   - GET: Liste aller Lieferanten
   - POST: Neuen Lieferanten anlegen
   - Auto-Nummerierung (70001, 70002, ...)

3. ✅ EK-Upload Flow erweitern:
   - Nach PDF-Parse: Lieferant-Matching
   - Falls neu: Lieferant anlegen
   - Aufwandskonto zuordnen (UI-Dropdown)

4. ✅ Export-API erweitern:
   - EK-Rechnungen hinzufügen

**Output:** Export mit VK + EK Rechnungen

---

### PHASE 3: Zahlungsausgänge (Optional)
**Ziel:** Vollständiger Export mit allen Zahlungen

**Später implementieren:**
- Manuelle Erfassung EK-Zahlungen
- Oder SEPA-Datei Import

---

## 📝 Detaillierte Aufgaben für Phase 1

### 1. VK-Rechnungen API erweitern

**Datei:** `/app/api/fibu/rechnungen/vk/route.ts`

**Änderungen:**
```typescript
// Zusätzliche Berechnungen:
const brutto = rechnung.fGesamtsumme;
const steuersatz = getSteuersatz(kunde); // 19 oder 0
const netto = steuersatz > 0 ? brutto / 1.19 : brutto;
const steuer = brutto - netto;

return {
  ...rechnung,
  netto,
  steuer,
  steuersatz,
  steuerkonto: steuersatz === 19 ? '3806' : ''
};
```

### 2. VK-Zahlungen API erweitern

**Datei:** `/app/api/fibu/zahlungen/route.ts`

**Änderungen:**
```typescript
// Belegnummer generieren:
const belegnummer = `AU-${zahlung.kZahlungseingang}-S`;

// Join mit Rechnungen:
SELECT 
  z.kZahlungseingang,
  z.dZeit,
  z.fBetrag,
  r.cRechnungsnummer,
  r.kKunde
FROM tZahlungseingang z
LEFT JOIN tRechnung r ON z.kRechnung = r.kRechnung
WHERE z.dZeit BETWEEN @startDate AND @endDate
```

### 3. Export-API erstellen

**Neue Datei:** `/app/api/fibu/export/10it/route.ts`

**Funktionalität:**
```typescript
export async function GET(request: Request) {
  // 1. Query-Parameter auslesen
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // 2. Daten sammeln
  const vkRechnungen = await fetchVKRechnungen(startDate, endDate);
  const vkZahlungen = await fetchVKZahlungen(startDate, endDate);
  
  // 3. Zu 10it Format konvertieren
  const bookings = [
    ...convertVKRechnungen(vkRechnungen),
    ...convertVKZahlungen(vkZahlungen)
  ];
  
  // 4. CSV generieren
  const csv = generateCSV(bookings);
  
  // 5. Download Response
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Export_${startDate}_${endDate}.csv"`
    }
  });
}
```

**CSV-Format:**
```typescript
function generateCSV(bookings) {
  // UTF-8 BOM
  let csv = '\ufeff';
  
  // Header
  csv += '"Konto";"Kontobezeichnung";"Datum";"Belegnummer";"Text";"Gegenkonto";"Soll";"Haben";"Steuer";"Steuerkonto"\n';
  
  // Zeilen
  bookings.forEach(b => {
    csv += `"${b.konto}";"${b.bezeichnung}";"${formatDate(b.datum)}";"${b.beleg}";"${b.text}";"${b.gegenkonto}";"${formatAmount(b.soll)}";"${formatAmount(b.haben)}";"${formatAmount(b.steuer)}";"${b.steuerkonto}"\n`;
  });
  
  return csv;
}

function formatDate(date) {
  // DD.MM.YYYY
  return new Date(date).toLocaleDateString('de-DE');
}

function formatAmount(amount) {
  // x.xxx,xx (deutsches Format)
  return amount.toLocaleString('de-DE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}
```

### 4. Frontend: Export-Button

**Datei:** `/app/components/FibuModule.js`

**UI-Ergänzung:**
```jsx
const [exportStartDate, setExportStartDate] = useState('2025-01-01');
const [exportEndDate, setExportEndDate] = useState('2025-01-31');

const handleExport = async () => {
  const response = await fetch(
    `/api/fibu/export/10it?startDate=${exportStartDate}&endDate=${exportEndDate}`
  );
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Export_${exportStartDate}_${exportEndDate}.csv`;
  a.click();
};

// UI
<div className="export-section">
  <h3>10it Export</h3>
  <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} />
  <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} />
  <button onClick={handleExport}>CSV Exportieren</button>
</div>
```

---

## 🧪 Testing-Strategie

### Phase 1 Tests:
1. VK-Rechnungen mit Netto/Steuer-Berechnung
2. VK-Zahlungen mit Belegnummer
3. CSV-Export Format (Spalten, Encoding, Zahlenformat)
4. Download-Funktionalität im Frontend

### Validierung:
- Export-CSV mit Beispieldatei vergleichen
- In 10it Software importieren (wenn möglich)

---

## 🚀 Nächste Schritte - JETZT STARTEN

**Ich schlage vor, mit Phase 1 zu beginnen:**

1. Zuerst: VK-Rechnungen & Zahlungen APIs erweitern
2. Dann: Export-API implementieren
3. Zuletzt: Frontend Export-Button

**Nach Phase 1:** Funktionierender Export für die Verkaufsseite (VK)

**Phase 2 & 3:** Können später gemacht werden, wenn Phase 1 läuft

---

## ❓ Offene Fragen an Sie

1. **Steuersätze:** Reicht 19% (DE) und 0% (EU)? Oder auch 7% ermäßigt?
2. **Debitorenkonten:** Sind die 5-stelligen Nummern schon in JTL oder generieren wir selbst?
3. **Priorität:** Soll ich sofort mit Phase 1 starten?
