# FIBU SQL-Queries für JTL-Wawi

## 📅 Oktober 2024 Datenimport

### 1. VK-Rechnungen (Ausgangsrechnungen) - Oktober 2024

```sql
-- Hauptabfrage für VK-Rechnungen
SELECT 
  r.kRechnung,
  r.cRechnungsNr,
  r.dErstellt AS Rechnungsdatum,
  r.fGesamtsumme AS Brutto,
  r.fWarensumme AS Netto,
  r.fVersand,
  r.fMwSt,
  r.cStatus,
  k.kKunde,
  k.cFirma AS Kundenname,
  k.cUSTID AS Kunden_UStID,
  k.cLand AS Kundenland,
  za.cName AS Zahlungsart,
  r.kZahlungsart
FROM dbo.tRechnung r
LEFT JOIN dbo.tKunde k ON r.kKunde = k.kKunde
LEFT JOIN dbo.tZahlungsart za ON r.kZahlungsart = za.kZahlungsart
WHERE r.dErstellt >= '2024-10-01' 
  AND r.dErstellt < '2024-11-01'
ORDER BY r.dErstellt
```

### 2. VK-Rechnungspositionen - Oktober 2024

```sql
-- Positionen zu Rechnungen
SELECT
  rp.kRechnungPosition,
  rp.kRechnung,
  rp.kArtikel,
  rp.cName AS Artikelname,
  rp.fAnzahl AS Menge,
  rp.fVKNetto AS Preis_Netto,
  rp.fVKBrutto AS Preis_Brutto,
  rp.fMwSt AS MwSt_Betrag,
  rp.fMwStSatz AS MwSt_Satz
FROM dbo.tRechnungPosition rp
INNER JOIN dbo.tRechnung r ON rp.kRechnung = r.kRechnung
WHERE r.dErstellt >= '2024-10-01' 
  AND r.dErstellt < '2024-11-01'
```

### 3. Externe Rechnungen (Amazon, eBay) - Oktober 2024

```sql
-- Amazon/eBay Rechnungen
SELECT
  er.kExterneRechnung,
  er.cRechnungsNr,
  er.dErstellt,
  er.fBrutto,
  er.cPlattform,  -- 'Amazon', 'eBay', etc.
  er.kAuftrag
FROM Verkauf.lvExterneRechnung er
WHERE er.dErstellt >= '2024-10-01'
  AND er.dErstellt < '2024-11-01'
```

### 4. Zahlungen - Oktober 2024

```sql
-- Alle Zahlungen
SELECT
  z.kZahlung,
  z.kRechnung,
  z.fBetrag,
  z.dZeit AS Zahlungsdatum,
  z.cHinweis AS Verwendungszweck,
  z.kZahlungsart,
  za.cName AS Zahlungsart_Name,
  za.cModulId AS Zahlungsart_Modul,
  r.cRechnungsNr
FROM dbo.tZahlung z
LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
LEFT JOIN dbo.tRechnung r ON z.kRechnung = r.kRechnung
WHERE z.dZeit >= '2024-10-01'
  AND z.dZeit < '2024-11-01'
ORDER BY z.dZeit
```

### 5. EK-Rechnungen (Eingangsrechnungen) - Oktober 2024

```sql
-- Lieferantenrechnungen
SELECT
  er.kEingangsrechnung,
  er.cRechnungsNr,
  er.dEingangsdatum,
  er.dRechnungsdatum,
  er.fBrutto,
  er.fNetto,
  er.fMwSt,
  er.kLieferant,
  l.cFirma AS Lieferantenname,
  l.cLand AS Lieferantenland,
  l.cUSTID AS Lieferanten_UStID
FROM dbo.tEingangsrechnung er
LEFT JOIN dbo.tLieferant l ON er.kLieferant = l.kLieferant
WHERE er.dRechnungsdatum >= '2024-10-01'
  AND er.dRechnungsdatum < '2024-11-01'
ORDER BY er.dRechnungsdatum
```

### 6. EK-Rechnungspositionen - Oktober 2024

```sql
-- Positionen zu Eingangsrechnungen
SELECT
  erp.kEingangsrechnungPos,
  erp.kEingangsrechnung,
  erp.kArtikel,
  erp.cName AS Artikelname,
  erp.fAnzahl AS Menge,
  erp.fPreis AS Preis_Netto,
  erp.fMwSt AS MwSt_Betrag
FROM dbo.tEingangsrechnungPos erp
INNER JOIN dbo.tEingangsrechnung er ON erp.kEingangsrechnung = er.kEingangsrechnung
WHERE er.dRechnungsdatum >= '2024-10-01'
  AND er.dRechnungsdatum < '2024-11-01'
```

## 🔍 Hilfstabellen

### Zahlungsarten (alle)

```sql
SELECT 
  kZahlungsart,
  cName,
  cModulId,
  nSort,
  cISO  -- Währung
FROM dbo.tZahlungsart
ORDER BY nSort
```

### Kunden mit USt-ID (für Sammeldebitoren-Regel)

```sql
-- Nur Kunden mit USt-ID (innergemeinschaftlich)
SELECT
  kKunde,
  cFirma,
  cUSTID,
  cLand
FROM dbo.tKunde
WHERE cUSTID IS NOT NULL
  AND cUSTID != ''
  AND cLand != 'DE'  -- Nicht Deutschland
```

## 📊 Aggregierte Statistiken Oktober 2024

### Umsatz nach Zahlungsart

```sql
SELECT
  za.cName AS Zahlungsart,
  COUNT(r.kRechnung) AS Anzahl_Rechnungen,
  SUM(r.fGesamtsumme) AS Gesamt_Brutto,
  SUM(r.fWarensumme) AS Gesamt_Netto,
  SUM(r.fMwSt) AS Gesamt_MwSt
FROM dbo.tRechnung r
LEFT JOIN dbo.tZahlungsart za ON r.kZahlungsart = za.kZahlungsart
WHERE r.dErstellt >= '2024-10-01'
  AND r.dErstellt < '2024-11-01'
GROUP BY za.cName
ORDER BY Gesamt_Brutto DESC
```

### Offene Rechnungen Oktober

```sql
SELECT
  r.cRechnungsNr,
  r.dErstellt,
  r.fGesamtsumme,
  k.cFirma AS Kunde,
  ISNULL(SUM(z.fBetrag), 0) AS Bezahlt,
  r.fGesamtsumme - ISNULL(SUM(z.fBetrag), 0) AS Offen
FROM dbo.tRechnung r
LEFT JOIN dbo.tKunde k ON r.kKunde = k.kKunde
LEFT JOIN dbo.tZahlung z ON r.kRechnung = z.kRechnung
WHERE r.dErstellt >= '2024-10-01'
  AND r.dErstellt < '2024-11-01'
GROUP BY r.kRechnung, r.cRechnungsNr, r.dErstellt, r.fGesamtsumme, k.cFirma
HAVING r.fGesamtsumme - ISNULL(SUM(z.fBetrag), 0) > 0
```

## 🎯 Spezielle Marketplace-Queries

### Amazon Zahlungen

```sql
-- Wenn tAmazonPayment existiert
SELECT * FROM dbo.tAmazonPayment
WHERE dZeit >= '2024-10-01' AND dZeit < '2024-11-01'
```

### eBay Zahlungen

```sql
-- Wenn tEbayPayment existiert
SELECT * FROM dbo.tEbayPayment  
WHERE dZeit >= '2024-10-01' AND dZeit < '2024-11-01'
```

### PayPal Zahlungen

```sql
-- Wenn tPayPalZahlung existiert
SELECT * FROM dbo.tPayPalZahlung
WHERE dZeit >= '2024-10-01' AND dZeit < '2024-11-01'
```

## 🔧 Technische Hinweise

### Datumsformate
- JTL speichert Daten als `datetime`
- Filter immer mit `>=` und `<` für Monats-Range
- Beispiel: `WHERE dErstellt >= '2024-10-01' AND dErstellt < '2024-11-01'`

### Schemas
- `dbo` - Hauptschema (Standard-Tabellen)
- `Verkauf` - Views für Verkaufsdaten
- `Einkauf` - Views für Einkaufsdaten

### Performance
- Indices auf Datumsspalten nutzen
- `TOP 1000` für erste Tests
- Bei großen Mengen: Pagination mit `OFFSET`/`FETCH NEXT`

---

**Wichtig**: Alle Queries für Oktober 2024 anpassen wenn nötig!
**Stand**: November 2024
