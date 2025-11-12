# 10it Export Format - Detaillierte Analyse

## Dateiformat
- **Separator:** Semikolon (;)
- **Encoding:** UTF-8 mit BOM
- **Dateiformat:** CSV
- **Alle Werte:** In Anführungszeichen

## Spaltenstruktur (10 Spalten)

| Nr | Spaltenname | Beschreibung | Beispiele |
|----|-------------|--------------|-----------|
| 1  | Konto | Kontonummer | "1200", "520", "70197" |
| 2  | Kontobezeichnung | Name des Kontos | "Forderungen aus Lieferungen und Leistungen", "Idealo" |
| 3  | Datum | Buchungsdatum | "31.01.2025" (Format: DD.MM.YYYY) |
| 4  | Belegnummer | Belegnummer/Referenz | "99012594", "AU-18279-S", "RE2025-84503" |
| 5  | Text | Buchungstext | "Zahlungseing.: RE2025-84503 - DE" |
| 6  | Gegenkonto | Gegenkonto-Nummer | "6222", "64264", "3806" |
| 7  | Soll | Soll-Betrag | "22,80" oder "0,00" (Format: x.xxx,xx) |
| 8  | Haben | Haben-Betrag | "35,00" oder "0,00" (Format: x.xxx,xx) |
| 9  | Steuer | Steuersatz in % | "19,00" oder "0,00" |
| 10 | Steuerkonto | Steuerkonto-Nummer | "3806" (USt), "1406" (VSt), "" (keine) |

## Buchungsmuster

### 1. VK-Rechnung (Verkaufsrechnung erstellen)
```
Konto: 1200 (Forderungen)
Kontobezeichnung: Forderungen aus Lieferungen und Leistungen
Datum: Rechnungsdatum
Belegnummer: Kundenbestellnummer (z.B. "028-0067753-7446734")
Text: Rechnungsnummer - Land (z.B. "RE2025-84454 - DE")
Gegenkonto: Debitorenkonto (5-stellig, z.B. "64239")
Soll: Bruttobetrag
Haben: 0,00
Steuer: 19,00 (oder 0,00 für EU mit USt-ID, oder 7,00)
Steuerkonto: 3806 (bei 19%), leer bei 0%
```

### 2. VK-Zahlungseingang (Kunde zahlt)
```
Konto: 1200 (Forderungen)
Kontobezeichnung: Forderungen aus Lieferungen und Leistungen
Datum: Zahlungsdatum
Belegnummer: Zahlungsbeleg-Nummer (z.B. "AU-18279-S")
Text: Zahlungseing.: RE2025-XXXXX - Land
Gegenkonto: Debitorenkonto (5-stellig)
Soll: 0,00
Haben: Zahlungsbetrag
Steuer: 0,00
Steuerkonto: (leer)
```

### 3. EK-Rechnung (Lieferantenrechnung)
```
Konto: Kreditorenkonto (5-stellig, z.B. "70197")
Kontobezeichnung: Lieferantenname (z.B. "Idealo")
Datum: Rechnungsdatum
Belegnummer: Lieferanten-Rechnungsnummer (z.B. "20845818")
Text: Lieferantenname + Beschreibung (z.B. "Idealo Werbung")
Gegenkonto: Aufwandskonto (z.B. "6600" für Werbung, "5200" für Waren)
Soll: 0,00
Haben: Bruttobetrag
Steuer: 19,00 (oder 7,00, 0,00)
Steuerkonto: 1406 (Vorsteuer 19%)
```

### 4. EK-Zahlungsausgang (Lieferant wird bezahlt)
```
Konto: Kreditorenkonto (5-stellig)
Kontobezeichnung: Lieferantenname
Datum: Zahlungsdatum
Belegnummer: Referenz zur Rechnung
Text: Zahlungsausg.: Lieferant + Bankverbindung + Details
Gegenkonto: 1802 (Bankkonto)
Soll: Zahlungsbetrag
Haben: 0,00
Steuer: 0,00
Steuerkonto: (leer)
```

## Kontenplan-Nummern aus Beispieldatei

### Aktiva
- **1200** - Forderungen aus Lieferungen und Leistungen
- **1802** - Bankkonto

### Passiva
- **520** - Pkw (Anlagevermögen)
- **6222** - AfA-Konto

### Aufwand
- **5200** - Wareneinkauf
- **6600** - Werbekosten
- **6825** - Beratungskosten

### Ertrag/Sachkonten
- **3806** - Umsatzsteuer 19%
- **1406** - Vorsteuer 19%
- **64xxx** - Debitorenkonten (Kunden)
- **70xxx** - Kreditorenkonten (Lieferanten)

## Daten-Mapping: Was wir haben vs. was wir brauchen

### ✅ VK-RECHNUNGEN (aus JTL MS SQL - lvRechnungsverwaltung)

**Vorhanden:**
- ✅ Rechnungsnummer: `cRechnungsnummer` (z.B. "RE2025-84503")
- ✅ Datum: `dErstellt` 
- ✅ Bruttobetrag: `fGesamtsumme`
- ✅ Kunde Land: `cLand`
- ✅ Kunde USt-ID: Über Join möglich
- ✅ Debitorenkonto: Via `getDebitorKonto()` in fibu-utils.ts
- ✅ Sachkonto: Via `getSachkonto()` in fibu-utils.ts
- ⚠️  Kundenbestellnummer: `cBestellNr` (als Belegnummer verwenden)

**Fehlend:**
- ❌ Nettobetrag (berechnen: Brutto / 1.19)
- ❌ Steuerbetrag (berechnen: Brutto - Netto)
- ❌ Steuersatz: Hardcoded 19% (DE) oder 0% (EU mit USt-ID)
- ❌ Kontobezeichnung für Debitorenkonto: "Forderungen..." statisch

### ✅ VK-ZAHLUNGEN (aus JTL MS SQL - tZahlungseingang)

**Vorhanden:**
- ✅ Zahlungsdatum: `dZeit`
- ✅ Zahlungsbetrag: `fBetrag`
- ✅ Zuordnung zur Rechnung: `kRechnung` (Foreign Key)

**Fehlend:**
- ❌ Belegnummer für Zahlungseingang (Format "AU-XXXXX-S")
  - **Lösung:** Generieren aus `kZahlungseingang` ID: `"AU-" + kZahlungseingang + "-S"`
- ❌ Rechnungsnummer für Text: Muss via Join geholt werden

### ⚠️  EK-RECHNUNGEN (aus MongoDB - Gemini geparste PDFs)

**Vorhanden:**
- ✅ Rechnungsnummer: Von Gemini extrahiert
- ✅ Datum: Von Gemini extrahiert
- ✅ Lieferantenname: Von Gemini extrahiert
- ✅ Gesamtbetrag: Von Gemini extrahiert

**Fehlend:**
- ❌ **Kreditorenkonto-Nummer** (5-stellig 70xxx)
  - **Lösung:** Neues System: Lieferanten-Stammdaten in MongoDB
  - Auto-generieren: Nächste freie 70xxx Nummer
- ❌ **Aufwandskonto** (Gegenkonto)
  - **Lösung:** UI zur Zuordnung bei PDF-Upload
  - Default: 5200 (Wareneinkauf)
- ❌ Netto/Steuer getrennt
  - **Lösung:** Gemini Prompt erweitern oder berechnen

### ❌ EK-ZAHLUNGEN

**Status:** Komplett fehlend
- Keine Datenquelle
- **Lösung:** Später implementieren (manuelles Eingabesystem)

## Fehlende Stammdaten

### 1. Debitorenstamm (Kunden)
- Aktuell: Nur Kontonummern via Business-Logik
- **Benötigt:** Mapping Kunde → Debitorenkonto → Kontobezeichnung
- **Lösung:** Aus Kontenplan-MongoDB wenn vorhanden, sonst "Debitor [KdNr]"

### 2. Kreditorenstamm (Lieferanten)
- Aktuell: Nicht vorhanden
- **Benötigt:** 
  - Lieferantenname → Kreditorenkonto-Nummer (70xxx)
  - Mapping zu Standard-Aufwandskonto
- **Lösung:** Neue MongoDB Collection `kreditoren`

### 3. Kontobezeichnungen
- Aktuell: In Kontenplan vorhanden
- **Zugriff:** Via MongoDB bei Export

### 4. Standardkonten
- **1200** - Forderungen (statisch)
- **1802** - Bankkonto (statisch oder aus Config)
- **3806** - USt 19% (statisch)
- **1406** - VSt 19% (statisch)

## Implementierungsplan

### Phase 1: Daten anreichern ✅ TEILWEISE
1. VK-Rechnungen API erweitern:
   - Berechnung Netto = Brutto / 1.19
   - Berechnung Steuer = Brutto - Netto
   - Steuersatz-Logik (19% DE, 0% EU)

2. VK-Zahlungen API:
   - Belegnummer generieren
   - Join mit Rechnungen für Rechnungsnummer

### Phase 2: Lieferanten-Stammdaten ❌ NEU
1. MongoDB Collection `kreditoren`:
   ```json
   {
     "_id": "uuid",
     "kreditorenNummer": "70197",
     "name": "Idealo",
     "standardAufwandskonto": "6600"
   }
   ```

2. API Endpoint `/api/fibu/kreditoren`:
   - GET: Liste aller Lieferanten
   - POST: Neuen Lieferanten anlegen (auto-increment 70xxx)
   - PUT: Lieferant bearbeiten

3. EK-Rechnungen Upload erweitern:
   - Nach PDF-Parse: Lieferant suchen oder neu anlegen
   - Kreditorenkonto zuordnen
   - Aufwandskonto auswählen (UI)

### Phase 3: Export-API ❌ NEU
1. Endpoint `/api/fibu/export/10it`:
   - Parameter: `startDate`, `endDate`
   - Sammelt:
     - VK-Rechnungen
     - VK-Zahlungen
     - EK-Rechnungen
   - Formatiert zu 10it CSV
   - Download als Datei

2. Format-Logik:
   - CSV mit Semikolon
   - UTF-8 BOM
   - Deutsche Zahlenformatierung (Komma)
   - Alle Werte in Anführungszeichen

### Phase 4: Frontend UI
1. Lieferanten-Verwaltung in FibuModule
2. Export-Button mit Datumsauswahl
3. EK-Upload mit Konto-Zuordnung

## Offene Fragen

1. ⚠️  **Sachkonto-Zuordnung bei VK:** 
   - Aktuell: Basiert auf Produktkategorie
   - Frage: Sind alle Produktkategorien abgedeckt?
   
2. ⚠️  **Debitorenkonto-Nummern:**
   - Werden diese bereits in JTL verwaltet?
   - Oder eigene Logik zur Generierung?

3. ⚠️  **Steuersätze:**
   - Nur 19% und 0%?
   - Was ist mit 7% (ermäßigt)?

4. ⚠️  **EK-Zahlungen:**
   - Manuelle Erfassung oder SEPA-Import?
