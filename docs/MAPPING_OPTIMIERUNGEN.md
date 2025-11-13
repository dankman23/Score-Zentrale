# Mapping & Parsing Optimierungen

## Übersicht

Dieses Dokument beschreibt Möglichkeiten zur Optimierung des Rechnungs-Parsings und der automatischen Zuordnung im FIBU-Modul.

---

## 1. AKTUELLER STAND

### Parsing-System
- **Hybrid-Ansatz**: Regelbasierte Parser + Gemini AI Fallback
- **Status**: Funktioniert grundsätzlich gut
- **Problem**: Gemini AI hatte falschen Lieferanten erkannt (wurde gefixt)

### Automatische Zuordnung
- **Kreditoren** (Lieferanten): 70% automatisch, 30% manuell
- **Debitoren** (Kunden): 100% regelbasiert nach Zahlungsart
- **Zahlungen**: 48% zugeordnet (Oktober 2025)

---

## 2. OPTIMIERUNGS-MÖGLICHKEITEN

### A. Parsing-Verbesserungen

#### 1. Machine Learning für Lieferanten-Erkennung
**Problem**: Neue/unbekannte Lieferanten werden nicht erkannt

**Lösung**: Trainingsdaten aus historischen Rechnungen
```javascript
// Beispiel-Implementierung
async function trainSupplierRecognition() {
  const historicInvoices = await db.collection('fibu_ek_rechnungen')
    .find({ kreditorKonto: { $exists: true } })
    .toArray()
  
  // Extrahiere Features:
  // - Email-Absender → Lieferant
  // - PDF-Text-Muster → Lieferant
  // - IBAN → Lieferant
  
  // Speichere als Mapping-Tabelle
}
```

**Umsetzung**:
1. Collection `fibu_lieferant_mapping` erstellen
2. Felder: `email`, `iban`, `textPattern`, `kreditorKonto`
3. Bei neuem PDF: Erst Mapping prüfen, dann Gemini

**Erwarteter Erfolg**: 90%+ automatische Zuordnung

---

#### 2. PDF-Template-Erkennung
**Problem**: Jeder Lieferant hat eigenes PDF-Layout

**Lösung**: Template-basiertes Parsing
```javascript
// Erkenne Template anhand PDF-Struktur
const template = detectPDFTemplate(pdfBase64)

if (template === 'KLINGSPOR') {
  // Nutze Klingspor-spezifische Regeln
  rechnungsnummer = extractFromPosition(pdf, x=100, y=200)
} else if (template === 'PFERD') {
  rechnungsnummer = extractFromPosition(pdf, x=150, y=180)
}
```

**Umsetzung**:
1. PDF-Struktur-Fingerprint erstellen (Schriftarten, Positionen, Keywords)
2. Template-Bibliothek aufbauen
3. Fallback zu Gemini bei unbekannten Templates

**Erwarteter Erfolg**: 95%+ Parsing-Genauigkeit

---

#### 3. Gemini-Prompt-Optimierung
**Status**: Bereits verbessert (Score-Problematik gelöst)

**Weitere Verbesserungen**:
```python
# Aktueller Prompt
"""
Extrahiere aus dieser Rechnung: Lieferant, Rechnungsnummer, Datum, Betrag
WICHTIG: Score Schleifwerkzeuge ist der Empfänger, NICHT der Lieferant
"""

# Verbesserter Prompt
"""
Du bist ein Buchhaltungs-Experte. Analysiere diese Rechnung.

KONTEXT:
- Empfänger: Score Schleifwerkzeuge GmbH
- Aufgabe: Finde den LIEFERANTEN (wer stellt die Rechnung aus)

EXTRAHIERE:
1. Lieferant: Name der ausstellenden Firma (NICHT Score Schleifwerkzeuge)
2. Rechnungsnummer: Eindeutige ID der Rechnung
3. Rechnungsdatum: Format YYYY-MM-DD
4. Gesamtbetrag: Bruttobetrag inkl. MwSt.
5. Nettobetrag: Betrag ohne MwSt.
6. MwSt.-Satz: 19%, 7%, oder 0%
7. IBAN: Bankverbindung des Lieferanten

VALIDIERUNG:
- Lieferant darf NIEMALS "Score Schleifwerkzeuge" sein
- Wenn unsicher: Markiere mit "UNSICHER: [Wert]"

Ausgabe als JSON.
"""
```

**Erwarteter Erfolg**: 98%+ Parsing-Genauigkeit

---

### B. Automatische Zuordnungs-Optimierungen

#### 4. Intelligent Matching für Zahlungen → Rechnungen
**Problem**: 1.609 Zahlungen nicht zugeordnet (Oktober)

**Lösung 1: Fuzzy Matching**
```javascript
// Matching-Algorithmus
function matchPaymentToInvoice(zahlung, rechnungen) {
  const candidates = []
  
  for (const rechnung of rechnungen) {
    let score = 0
    
    // 1. Betrag-Matching (±5€ Toleranz)
    if (Math.abs(zahlung.betrag - rechnung.brutto) < 5) {
      score += 50
    }
    
    // 2. Datum-Matching (±7 Tage)
    const daysDiff = Math.abs(
      (new Date(zahlung.datum) - new Date(rechnung.datum)) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff <= 7) {
      score += 30
    }
    
    // 3. Hinweis enthält Rechnungsnummer?
    if (zahlung.hinweis?.includes(rechnung.cRechnungsNr)) {
      score += 100
    }
    
    // 4. Kunde-Matching
    if (zahlung.kundenName === rechnung.kundenName) {
      score += 20
    }
    
    candidates.push({ rechnung, score })
  }
  
  // Beste Übereinstimmung
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.score > 100 ? candidates[0].rechnung : null
}
```

**Lösung 2: Bank-Import mit Referenznummern**
```javascript
// Postbank CSV hat oft Referenzen
function extractReferences(verwendungszweck) {
  const patterns = [
    /RE[-\s]?\d{4}-\d+/,     // RE2025-12345
    /AU[-\s]?\d{4}-\d+/,     // AU2025-12345
    /Rechnung\s+(\d+)/,      // Rechnung 12345
    /Invoice\s+([A-Z0-9]+)/  // Invoice ABC123
  ]
  
  for (const pattern of patterns) {
    const match = verwendungszweck.match(pattern)
    if (match) return match[0]
  }
  return null
}
```

**Umsetzung**:
1. Script erstellen: `/app/scripts/auto-match-zahlungen.js`
2. Täglich via Cron ausführen
3. Manuelle Freigabe bei Score < 150

**Erwarteter Erfolg**: 80%+ automatische Zuordnung

---

#### 5. Lieferanten-Whitelist & Blacklist
**Problem**: Unbekannte Lieferanten verzögern Prozess

**Lösung**: Vertrauensliste
```javascript
// fibu_lieferanten_whitelist Collection
{
  name: "KLINGSPOR Schleifsysteme GmbH & Co.KG",
  kreditorKonto: "70004",
  autoAssign: true,
  email: "info@klingspor.com",
  iban: "DE12345...",
  confidence: 100  // %
}

// fibu_lieferanten_blacklist Collection
{
  name: "Score Schleifwerkzeuge",  // Eigene Firma!
  reason: "Ist der Empfänger, nicht Lieferant",
  block: true
}
```

**Umsetzung**:
1. Bei PDF-Import: Prüfe erst Whitelist
2. Bei Gemini-Ergebnis: Prüfe Blacklist
3. Admin-UI für Verwaltung

**Erwarteter Erfolg**: 95%+ automatische Zuordnung

---

### C. Datenqualität-Verbesserungen

#### 6. Duplikat-Erkennung
**Problem**: Gleiche Rechnung wird mehrfach importiert

**Lösung**: Hash-basierte Erkennung
```javascript
async function checkDuplicate(pdfBase64, rechnungsnummer) {
  // 1. Hash des PDFs
  const pdfHash = crypto.createHash('sha256').update(pdfBase64).digest('hex')
  
  // 2. Prüfe in DB
  const existing = await db.collection('fibu_ek_rechnungen').findOne({
    $or: [
      { pdfHash },
      { rechnungsNummer, lieferantName }  // Gleiche RgNr + Lieferant
    ]
  })
  
  if (existing) {
    return { isDuplicate: true, existingId: existing._id }
  }
  return { isDuplicate: false }
}
```

**Umsetzung**:
1. Feld `pdfHash` zu `fibu_ek_rechnungen` hinzufügen
2. Vor Import: Duplikat-Check
3. UI-Warnung bei Duplikat

**Erwarteter Erfolg**: 100% keine Duplikate

---

#### 7. Validierungs-Regeln
**Problem**: Fehlerhafte Daten (z.B. Datum in Zukunft)

**Lösung**: Automatische Validierung
```javascript
function validateInvoice(rechnung) {
  const errors = []
  
  // 1. Datum nicht in der Zukunft
  if (new Date(rechnung.rechnungsdatum) > new Date()) {
    errors.push('Rechnungsdatum liegt in der Zukunft')
  }
  
  // 2. Betrag > 0
  if (rechnung.gesamtBetrag <= 0) {
    errors.push('Betrag muss positiv sein')
  }
  
  // 3. MwSt. plausibel
  const expectedMwst = rechnung.nettoBetrag * (rechnung.steuersatz / 100)
  if (Math.abs(rechnung.steuerbetrag - expectedMwst) > 1) {
    errors.push('MwSt.-Berechnung stimmt nicht')
  }
  
  // 4. Lieferant vorhanden
  if (!rechnung.lieferantName || rechnung.lieferantName === 'Score Schleifwerkzeuge') {
    errors.push('Lieferant fehlt oder ungültig')
  }
  
  return errors
}
```

**Umsetzung**:
1. Bei PDF-Import: Validierung
2. Bei Fehler: Markieren für manuelle Prüfung
3. Dashboard: "X Rechnungen benötigen Prüfung"

**Erwarteter Erfolg**: 99%+ Datenqualität

---

## 3. PRIORISIERUNG

### Kurzfristig (1-2 Wochen)
1. ✅ **Gemini-Prompt-Optimierung** (bereits erledigt)
2. **Fuzzy Matching für Zahlungen** (höchste Priorität - 1.609 offene Zahlungen)
3. **Duplikat-Erkennung** (verhindert Doppelbuchungen)

### Mittelfristig (1 Monat)
4. **Lieferanten-Whitelist** (beschleunigt täglichen Import)
5. **Validierungs-Regeln** (verbessert Datenqualität)
6. **PDF-Template-Erkennung** (für Top 10 Lieferanten)

### Langfristig (3 Monate)
7. **Machine Learning** (wenn genug Trainingsdaten vorhanden)
8. **OCR-Verbesserung** (für schlechte Scan-Qualität)

---

## 4. ERWARTETE ERGEBNISSE

**Vor Optimierung (Oktober 2025)**:
- EK-Rechnungen: 70 von 107 nicht zugeordnet (34% Erfolgsquote)
- Zahlungen: 1.609 von 3.088 nicht zugeordnet (52% Erfolgsquote)
- Manuelle Arbeit: ~4 Stunden/Monat

**Nach Optimierung (Ziel)**:
- EK-Rechnungen: 95%+ automatisch zugeordnet
- Zahlungen: 80%+ automatisch zugeordnet
- Manuelle Arbeit: <30 Minuten/Monat

---

## 5. TECHNISCHE UMSETZUNG

### Benötigte Scripts
```
/app/scripts/
├── auto-match-zahlungen.js           # Fuzzy Matching
├── detect-duplicates.js              # Duplikat-Erkennung
├── validate-invoices.js              # Validierung
└── train-supplier-recognition.js     # ML-Training
```

### Neue Collections
```
fibu_lieferant_mapping                # Email/IBAN → Kreditor
fibu_lieferanten_whitelist           # Vertrauensliste
fibu_lieferanten_blacklist           # Sperrliste
fibu_parsing_history                 # Parsing-Erfolgsquote Tracking
```

### Admin-UI Erweiterungen
- Tab "Mapping-Regeln" im FIBU-Dashboard
- Whitelist/Blacklist-Verwaltung
- Matching-Vorschläge mit Confidence-Score
- Parsing-Fehler-Log

---

## 6. KOSTEN-NUTZEN

**Investition**:
- Entwicklungszeit: ~2-3 Tage für alle Optimierungen
- Testing: ~1 Tag
- Gesamt: ~4 Arbeitstage

**Nutzen**:
- Zeitersparnis: ~3,5 Stunden/Monat
- ROI: Nach 1 Monat
- Verbesserte Datenqualität: Weniger Fehler in Buchhaltung
- Schnellerer Monatsabschluss: Von 4 Stunden auf 30 Minuten

---

**Status**: Konzept fertig, bereit für Umsetzung
**Nächster Schritt**: Priorisierung mit Stakeholder abstimmen
