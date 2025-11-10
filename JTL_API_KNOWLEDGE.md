# JTL-Wawi API Wissensdatenbank

## 📚 Überblick
Diese Datei dokumentiert alle Erkenntnisse über die JTL-Wawi MS SQL Datenbank für zukünftige Agents nach dem Forken.

---

## 🔌 Connection Details

**Datenbank:** MS SQL Server  
**Host:** `process.env.MSSQL_HOST` (162.55.235.45)  
**Port:** `process.env.MSSQL_PORT` (1433)  
**Database:** `process.env.MSSQL_DATABASE` (eazybusinesstest)  
**User:** `process.env.MSSQL_USER` (sa)  
**Password:** `process.env.MSSQL_PASSWORD`  

**Connection String:**
```javascript
const config = {
  server: process.env.MSSQL_HOST,
  port: parseInt(process.env.MSSQL_PORT),
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 60000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
}
```

---

## 📊 Haupt-Tabellen & Schema

### 1. **tAuftrag** (Bestellungen/Orders)
**Wichtigste Spalten:**
- `kAuftrag` (INT, PRIMARY KEY) - Auftrags-ID
- `dErstellt` (DATETIME) - Erstellungsdatum
- `cBestellNr` (VARCHAR) - Bestellnummer
- `fGesamtsumme` (DECIMAL) - Gesamtbetrag BRUTTO inkl. Versand
- `fGuthaben` (DECIMAL) - Gutschrift-Betrag (für Erstattungen)
- `cStatus` (VARCHAR) - Status: 'Offen', 'Bezahlt', 'Versandt', etc.
- `kKunde` (INT, FOREIGN KEY) - Kunden-ID
- `kVersandArt` (INT) - Versandart-ID

**WICHTIG - Datenqualitäts-Issues:**
1. ⚠️ **Versandkosten nicht in separater Spalte!** → Müssen aus `tAuftragPosition` extrahiert werden
2. ⚠️ **Stornierte Aufträge:** `fGuthaben > 0` bedeutet Teilerstattung, Vollerstattung wenn `fGuthaben = fGesamtsumme`
3. ⚠️ **"Angebote" werden als Aufträge gespeichert** → Filter mit `cStatus != 'Angebot'`

**Netto-Berechnung:**
```sql
-- FALSCH (gibt oft Netto ohne Versand zurück):
SELECT fGesamtsummeNetto FROM tAuftrag

-- RICHTIG (Netto MIT Versand):
SELECT (fGesamtsumme / (1 + (fMwSt / 100))) AS NettoMitVersand
FROM tAuftrag
WHERE fMwSt IS NOT NULL
```

### 2. **tAuftragPosition** (Bestellpositionen)
**Wichtigste Spalten:**
- `kAuftragPosition` (INT, PRIMARY KEY)
- `kAuftrag` (INT, FOREIGN KEY) → tAuftrag
- `kArtikel` (INT, FOREIGN KEY) → tArtikel
- `cName` (VARCHAR) - Artikel-Name
- `nAnzahl` (INT) - Menge
- `fVKNetto` (DECIMAL) - VK Netto pro Stück
- `fMwSt` (DECIMAL) - MwSt-Satz (7%, 19%)
- `nPosTyp` (INT) - **WICHTIG:** Positionstyp
  - `0` = Normale Artikel
  - `1` = Versandkosten ⚠️
  - `2` = Rabatt
  - `3` = Gutschein

**Versandkosten extrahieren:**
```sql
SELECT SUM(fVKNetto) AS Versandkosten
FROM tAuftragPosition
WHERE kAuftrag = @AuftragsID AND nPosTyp = 1
```

### 3. **tArtikel** (Artikel/Produkte)
**Wichtigste Spalten:**
- `kArtikel` (INT, PRIMARY KEY)
- `cArtNr` (VARCHAR) - Artikelnummer
- `cName` (VARCHAR) - Artikelname
- `cBarcode` (VARCHAR) - EAN/Barcode
- `kArtikelGruppe` (INT) - Warengruppe
- `kHersteller` (INT) - Hersteller-ID
- `fVKNetto` (DECIMAL) - Verkaufspreis Netto
- `fEKNetto` (DECIMAL) - Einkaufspreis Netto (für Marge)
- `nAktiv` (BIT) - 1=aktiv, 0=inaktiv

**WICHTIG - Artikelnamen-Problem:**
- ⚠️ **`cName` enthält manchmal HTML/Sonderzeichen!**
- ⚠️ **Encoding-Probleme bei Umlauten** (ä → Ã¤)
- **Workaround:** Artikelnamen aus `tAuftragPosition.cName` nutzen (ist sauberer!)

### 4. **tKunde** (Kunden)
**Wichtigste Spalten:**
- `kKunde` (INT, PRIMARY KEY)
- `cFirma` (VARCHAR) - Firmenname
- `cVorname` (VARCHAR)
- `cNachname` (VARCHAR)
- `cMail` (VARCHAR)
- `cTel` (VARCHAR)
- `cPLZ` (VARCHAR)
- `cOrt` (VARCHAR)
- `dErstellt` (DATETIME) - Erstellt am
- `dLetzteAenderung` (DATETIME) - Zuletzt geändert

### 5. **tPlattform** (Verkaufsplattformen)
**Wichtigste Spalten:**
- `kPlattform` (INT, PRIMARY KEY)
- `cName` (VARCHAR) - Platform-Name (z.B. "Amazon", "eBay", "Webshop")

**Mapping zu tAuftrag:**
```sql
-- Über tAuftrag.kKunde → tKunde.cFirma oder tAuftrag.cHinweis
-- KEIN direktes Feld! Plattform muss aus Kontext erkannt werden
```

### 6. **tHersteller** (Hersteller/Marken)
**Wichtigste Spalten:**
- `kHersteller` (INT, PRIMARY KEY)
- `cName` (VARCHAR) - Hersteller-Name (z.B. "Pferd", "Rhodius", "Norton")

### 7. **tArtikelGruppe** (Warengruppen/Kategorien)
**Wichtigste Spalten:**
- `kArtikelGruppe` (INT, PRIMARY KEY)
- `cName` (VARCHAR) - Kategorie-Name
- `kOberArtikelGruppe` (INT) - Parent-Kategorie (für Hierarchie)

---

## 🎯 Häufige Query-Patterns

### Pattern 1: Umsatz mit Versandkosten
```sql
SELECT 
  a.kAuftrag,
  a.dErstellt,
  a.fGesamtsumme AS Brutto,
  CAST((a.fGesamtsumme / (1 + (a.fMwSt / 100))) AS DECIMAL(10,2)) AS NettoMitVersand,
  ISNULL(v.Versandkosten, 0) AS Versandkosten,
  CAST(((a.fGesamtsumme / (1 + (a.fMwSt / 100))) - ISNULL(v.Versandkosten, 0)) AS DECIMAL(10,2)) AS NettoOhneVersand
FROM tAuftrag a
LEFT JOIN (
  SELECT kAuftrag, SUM(fVKNetto) AS Versandkosten
  FROM tAuftragPosition
  WHERE nPosTyp = 1
  GROUP BY kAuftrag
) v ON a.kAuftrag = v.kAuftrag
WHERE a.cStatus != 'Angebot'
  AND (a.fGuthaben = 0 OR a.fGuthaben IS NULL)
  AND a.dErstellt >= @StartDate
  AND a.dErstellt < @EndDate
```

### Pattern 2: Rohertragsmarge berechnen
```sql
SELECT 
  SUM(pos.nAnzahl * pos.fVKNetto) AS Umsatz,
  SUM(pos.nAnzahl * art.fEKNetto) AS Einkauf,
  SUM(pos.nAnzahl * (pos.fVKNetto - art.fEKNetto)) AS Rohertrag,
  CAST(
    (SUM(pos.nAnzahl * (pos.fVKNetto - art.fEKNetto)) / 
    NULLIF(SUM(pos.nAnzahl * pos.fVKNetto), 0) * 100)
  AS DECIMAL(5,2)) AS MarginProzent
FROM tAuftragPosition pos
JOIN tArtikel art ON pos.kArtikel = art.kArtikel
WHERE pos.kAuftrag IN (
  SELECT kAuftrag FROM tAuftrag 
  WHERE dErstellt >= @StartDate AND dErstellt < @EndDate
    AND cStatus != 'Angebot'
)
  AND pos.nPosTyp = 0
```

### Pattern 3: Top-Produkte mit Hersteller
```sql
SELECT TOP 10
  art.cName AS Produktname,
  art.cArtNr AS Artikelnummer,
  h.cName AS Hersteller,
  SUM(pos.nAnzahl) AS VerkaufteMenge,
  SUM(pos.nAnzahl * pos.fVKNetto) AS UmsatzNetto
FROM tAuftragPosition pos
JOIN tArtikel art ON pos.kArtikel = art.kArtikel
LEFT JOIN tHersteller h ON art.kHersteller = h.kHersteller
WHERE pos.kAuftrag IN (
  SELECT kAuftrag FROM tAuftrag 
  WHERE dErstellt >= @StartDate AND dErstellt < @EndDate
)
  AND pos.nPosTyp = 0
GROUP BY art.cName, art.cArtNr, h.cName
ORDER BY UmsatzNetto DESC
```

---

## ⚡ Performance-Optimierung

### Langsame Queries vermeiden:
1. **IMMER Datum-Filter verwenden!** → `WHERE dErstellt >= @StartDate AND dErstellt < @EndDate`
2. **Index nutzen:** Primärschlüssel (kAuftrag, kArtikel) sind indexiert
3. **AVOID:** `SELECT *` → Nur benötigte Spalten
4. **AVOID:** Verschachtelte Subqueries → Nutze JOINs

### Caching-Strategie:
- **Date-Range:** 1 Stunde Cache
- **KPIs:** 5 Minuten Cache
- **Top-Lists:** 15 Minuten Cache
- **Static Data** (Hersteller, Kategorien): 24 Stunden Cache

---

## 🐛 Bekannte Issues & Workarounds

### Issue 1: Doppelte Aufträge am 03.11.2025
**Problem:** Inkonsistente Daten für diesen Tag  
**Workaround:** Validierung mit mehreren Queries, manuelle Prüfung

### Issue 2: Plattform-Namen fehlen
**Problem:** Keine direkte Plattform-Zuordnung in tAuftrag  
**Workaround:** 
- Parsing aus `tKunde.cFirma` (z.B. "Amazon Kunde")
- Oder aus `tAuftrag.cHinweis`
- Default: "Webshop"

### Issue 3: Artikelnamen mit HTML/Encoding
**Problem:** `tArtikel.cName` hat HTML-Tags und falsche Umlaute  
**Workaround:** Nutze `tAuftragPosition.cName` (ist bereinigt)

### Issue 4: Angebote als Aufträge
**Problem:** Angebote werden wie normale Aufträge gespeichert  
**Workaround:** `WHERE cStatus != 'Angebot'`

---

## 📝 Best Practices

1. **Immer stornierte Aufträge filtern:**
   ```sql
   WHERE (fGuthaben = 0 OR fGuthaben IS NULL)
   ```

2. **Versandkosten IMMER separat berechnen:**
   ```sql
   LEFT JOIN (
     SELECT kAuftrag, SUM(fVKNetto) AS Versandkosten
     FROM tAuftragPosition WHERE nPosTyp = 1 GROUP BY kAuftrag
   ) v ON a.kAuftrag = v.kAuftrag
   ```

3. **NULL-Handling:**
   ```sql
   ISNULL(spalte, 0) -- für Berechnungen
   NULLIF(nenner, 0) -- für Divisionen
   ```

4. **Date-Range für Performance:**
   ```sql
   WHERE dErstellt >= @StartDate AND dErstellt < DATEADD(day, 1, @EndDate)
   ```

5. **Margin-Berechnung nur auf echte Artikel:**
   ```sql
   WHERE pos.nPosTyp = 0 -- keine Versandkosten, Rabatte, Gutscheine
   ```

---

## 🔧 Debugging-Queries

### Prüfe Daten-Konsistenz:
```sql
-- Finde Aufträge ohne Positionen
SELECT a.* FROM tAuftrag a
LEFT JOIN tAuftragPosition p ON a.kAuftrag = p.kAuftrag
WHERE p.kAuftragPosition IS NULL

-- Finde Versandkosten-Positionen
SELECT * FROM tAuftragPosition WHERE nPosTyp = 1

-- Prüfe Stornierungen
SELECT * FROM tAuftrag WHERE fGuthaben > 0
```

### Schema-Inspektion:
```sql
-- Alle Tabellen anzeigen
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'

-- Spalten einer Tabelle
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tAuftrag'
```

---

## 📚 API-Endpunkte Reference

Alle JTL-APIs unter `/app/app/api/jtl/*`:

- `GET /api/jtl/sales/date-range` - Min/Max Datum
- `GET /api/jtl/sales/kpi` - KPIs mit Versandkosten
- `GET /api/jtl/sales/timeseries` - Tagesumsätze
- `GET /api/jtl/sales/top-products` - Bestseller
- `GET /api/jtl/sales/top-categories` - Top Kategorien
- `GET /api/jtl/sales/top-platforms` - Plattform-Umsätze
- `GET /api/jtl/sales/top-manufacturers` - Top Hersteller
- `GET /api/jtl/orders/kpi/margin` - Rohertragsmarge
- `GET /api/jtl/orders/kpi/shipping-split` - Versandkosten-Split

Siehe `/app/lib/db/mssql.ts` für Connection-Handling.

---

## 🎓 Learnings für neue Agents

1. **JTL-Wawi ist NICHT perfekt normalisiert** → Viele Workarounds nötig
2. **Versandkosten sind versteckt** → Immer aus Positionen extrahieren
3. **Encoding-Issues existieren** → Nutze bereinigte Daten wo möglich
4. **Performance ist kritisch** → Immer Date-Filter, Caching nutzen
5. **Datenqualität prüfen** → Nicht blind auf Werte vertrauen

---

**Version:** 1.0  
**Zuletzt aktualisiert:** 10.11.2025  
**Maintainer:** Score Zentrale Team
