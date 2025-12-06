# JTL-Wawi Datenbank-Dokumentation & Best Practices

**Offizielle Dokumentation:** https://wawi-db.jtl-software.de/tables/1.10.15.0  
**Version:** 1.10.15.0  
**Letztes Update:** 2025-12-05

---

## 📋 WICHTIGSTE TABELLEN

### **1. KUNDEN (tKunde)**

**Verwendung:** Kundenstammdaten

**Wichtige Spalten:**
```sql
kKunde          INT PRIMARY KEY    -- Kunden-ID
cFirma          NVARCHAR(255)      -- Firmenname
cAnrede         NVARCHAR(255)      -- Anrede (Herr/Frau/Firma)
cVorname        NVARCHAR(255)      -- Vorname
cNachname       NVARCHAR(255)      -- Nachname
cStrasse        NVARCHAR(255)      -- Straße
cPLZ            NVARCHAR(10)       -- Postleitzahl
cOrt            NVARCHAR(255)      -- Ort
cLand           NVARCHAR(255)      -- Land (DE/AT/CH)
cTel            NVARCHAR(255)      -- Telefon
cMobil          NVARCHAR(255)      -- Mobiltelefon
cMail           NVARCHAR(255)      -- E-Mail
cWWW            NVARCHAR(255)      -- Website
cUSTID          NVARCHAR(255)      -- USt-IdNr (wichtig für B2B!)
nIstFirma       INT                -- 1 = Firma, 0 = Privat
nRegistriert    INT                -- 1 = Aktiv, 0 = Gelöscht
dErstellt       DATETIME           -- Erstellungsdatum
```

**Best Practice Query:**
```sql
-- Aktive Kunden mit Umsatz
SELECT 
  k.kKunde,
  k.cFirma,
  k.cVorname,
  k.cNachname,
  k.cMail,
  k.cUSTID,
  k.nIstFirma,
  ISNULL(SUM(b.fGesamtsumme), 0) as GesamtUmsatz
FROM tKunde k
LEFT JOIN tBestellung b ON b.kKunde = k.kKunde 
  AND b.cStatus NOT IN ('storno', 'gelöscht')
WHERE k.nRegistriert = 1
GROUP BY k.kKunde, k.cFirma, k.cVorname, k.cNachname, 
         k.cMail, k.cUSTID, k.nIstFirma
ORDER BY GesamtUmsatz DESC
```

---

### **2. BESTELLUNGEN (tBestellung)**

**Verwendung:** Kopfdaten von Bestellungen/Aufträgen

**Wichtige Spalten:**
```sql
kBestellung     INT PRIMARY KEY    -- Bestellungs-ID
kKunde          INT                -- Kunden-ID (FK)
cBestellNr      NVARCHAR(255)      -- Bestellnummer
cStatus         NVARCHAR(50)       -- Status: 'offen', 'abgeschlossen', 'storno', 'gelöscht'
fGesamtsumme    DECIMAL(18,2)      -- Gesamtsumme BRUTTO
fWarensumme     DECIMAL(18,2)      -- Warensumme NETTO
cZahlungsart    NVARCHAR(255)      -- Zahlungsart (z.B. "PayPal", "Rechnung")
cVersandart     NVARCHAR(255)      -- Versandart
dErstellt       DATETIME           -- Bestelldatum
```

**⚠️ WICHTIG - Status-Filter:**
```sql
-- IMMER storno und gelöscht ausschließen!
WHERE b.cStatus NOT IN ('storno', 'gelöscht')
```

**Best Practice Query:**
```sql
-- Bestellungen eines Kunden
SELECT 
  b.kBestellung,
  b.cBestellNr,
  b.fGesamtsumme,
  b.fWarensumme,
  b.cZahlungsart,
  b.cVersandart,
  b.dErstellt
FROM tBestellung b
WHERE b.kKunde = @kKunde
  AND b.cStatus NOT IN ('storno', 'gelöscht')
ORDER BY b.dErstellt DESC
```

---

### **3. BESTELLPOSITIONEN (tBestellpos)**

**Verwendung:** Einzelne Artikel in einer Bestellung

**Wichtige Spalten:**
```sql
kBestellpos     INT PRIMARY KEY    -- Positions-ID
kBestellung     INT                -- Bestellungs-ID (FK)
kArtikel        INT                -- Artikel-ID (FK)
cName           NVARCHAR(255)      -- Artikelname
cArtNr          NVARCHAR(255)      -- Artikelnummer
fAnzahl         DECIMAL(18,2)      -- Menge
fVKNetto        DECIMAL(18,2)      -- VK-Preis NETTO pro Stück
nTyp            INT                -- 0 = Artikel, 1 = Versandposition, 2 = Gutschein
```

**⚠️ WICHTIG - nTyp-Filter:**
```sql
-- Nur echte Artikel, keine Versandkosten/Gutscheine
WHERE bp.nTyp = 0
```

**Best Practice Query:**
```sql
-- Top-Produkte eines Kunden
SELECT TOP 10
  a.cName as Produktname,
  a.cArtNr as Artikelnummer,
  SUM(bp.fAnzahl) as GesamtMenge,
  SUM(bp.fAnzahl * bp.fVKNetto) as GesamtUmsatz
FROM tBestellung b
INNER JOIN tBestellpos bp ON bp.kBestellung = b.kBestellung
INNER JOIN tArtikel a ON a.kArtikel = bp.kArtikel
WHERE b.kKunde = @kKunde
  AND b.cStatus NOT IN ('storno', 'gelöscht')
  AND bp.nTyp = 0  -- Nur Artikel
GROUP BY a.cName, a.cArtNr
ORDER BY GesamtUmsatz DESC
```

---

### **4. ARTIKEL (tArtikel)**

**Verwendung:** Produktstammdaten

**Wichtige Spalten:**
```sql
kArtikel        INT PRIMARY KEY    -- Artikel-ID
cArtNr          NVARCHAR(255)      -- Artikelnummer
cName           NVARCHAR(255)      -- Artikelname
cBeschreibung   NTEXT              -- Beschreibung
fVKNetto        DECIMAL(18,2)      -- Standard-VK NETTO
fLagerbestand   DECIMAL(18,2)      -- Lagerbestand
cAktiv          CHAR(1)            -- Y = Aktiv, N = Inaktiv
```

**Best Practice Query:**
```sql
-- Aktive Artikel mit Lagerbestand
SELECT 
  a.kArtikel,
  a.cArtNr,
  a.cName,
  a.fVKNetto,
  a.fLagerbestand
FROM tArtikel a
WHERE a.cAktiv = 'Y'
  AND a.fLagerbestand > 0
ORDER BY a.cName
```

---

### **5. ARTIKEL-ATTRIBUTE (tArtikelAttribut)**

**Verwendung:** Zusätzliche Artikel-Eigenschaften (Custom Fields)

**Wichtige Spalten:**
```sql
kArtikelAttribut  INT PRIMARY KEY  -- Attribut-ID
kArtikel          INT               -- Artikel-ID (FK)
cName             NVARCHAR(255)     -- Attribut-Name (z.B. "Produktkategorie", "Hersteller")
cWert             NTEXT             -- Attribut-Wert
```

**⚠️ WICHTIG - Attribut-Namen:**
- JTL speichert Custom Fields als Attribute
- Präfix oft `attr_` oder `cust_`
- Beispiele:
  - `attr_produktkategorie` → "Schleifbänder"
  - `attr_hersteller` → "Klingspor"
  - `attr_material` → "Edelstahl"

**Best Practice Query:**
```sql
-- Artikel mit Produktkategorie
SELECT 
  a.kArtikel,
  a.cName,
  aa.cWert as Produktkategorie
FROM tArtikel a
LEFT JOIN tArtikelAttribut aa ON aa.kArtikel = a.kArtikel 
  AND aa.cName = 'attr_produktkategorie'
WHERE a.cAktiv = 'Y'
```

---

### **6. RECHNUNGEN (tRechnung)**

**Verwendung:** Rechnungen (nicht Bestellungen!)

**⚠️ WICHTIG:**
- `tRechnung` ≠ `tBestellung`
- Für Umsatzanalysen: **`tBestellung` verwenden**
- `tRechnung` nur für Buchhaltungs-Daten

**Wichtige Spalten:**
```sql
kRechnung       INT PRIMARY KEY    -- Rechnungs-ID
kKunde          INT                -- Kunden-ID (FK)
cRechnungsNr    NVARCHAR(255)      -- Rechnungsnummer
fGesamtsumme    DECIMAL(18,2)      -- Gesamtsumme
cStatus         NVARCHAR(50)       -- Status
dErstellt       DATETIME           -- Rechnungsdatum
```

---

## 🎯 BEST PRACTICES

### **1. Performance-Optimierung**

**❌ NICHT:**
```sql
-- Langsam: Alle Daten laden
SELECT * FROM tBestellung
```

**✅ BESSER:**
```sql
-- Schnell: Nur benötigte Spalten
SELECT 
  kBestellung, 
  fGesamtsumme, 
  dErstellt 
FROM tBestellung
WHERE kKunde = @kKunde  -- Mit WHERE!
```

**✅ TOP verwenden:**
```sql
-- Limit für große Ergebnisse
SELECT TOP 100 * FROM tBestellung
ORDER BY dErstellt DESC
```

---

### **2. Status-Filter (KRITISCH!)**

**Bestellungen:**
```sql
WHERE b.cStatus NOT IN ('storno', 'gelöscht')
```

**Artikel:**
```sql
WHERE a.cAktiv = 'Y'
```

**Kunden:**
```sql
WHERE k.nRegistriert = 1
```

---

### **3. Aggregationen mit ISNULL**

**❌ NICHT:**
```sql
SUM(b.fGesamtsumme)  -- NULL bei 0 Bestellungen!
```

**✅ BESSER:**
```sql
ISNULL(SUM(b.fGesamtsumme), 0)  -- Immer 0 statt NULL
```

---

### **4. LEFT JOIN für optionale Daten**

**❌ NICHT:**
```sql
INNER JOIN tBestellung  -- Kunden ohne Bestellungen fehlen!
```

**✅ BESSER:**
```sql
LEFT JOIN tBestellung  -- Alle Kunden, auch ohne Bestellungen
```

---

### **5. Datums-Filter**

**Letzte 30 Tage:**
```sql
WHERE b.dErstellt >= DATEADD(DAY, -30, GETDATE())
```

**Zeitraum:**
```sql
WHERE b.dErstellt BETWEEN @von AND @bis
```

---

## 📊 HÄUFIGE QUERIES

### **Q1: Kunden mit Gesamtumsatz**
```sql
SELECT 
  k.kKunde,
  k.cFirma,
  k.cVorname + ' ' + k.cNachname as Name,
  k.cMail,
  COUNT(DISTINCT b.kBestellung) as AnzahlBestellungen,
  ISNULL(SUM(b.fGesamtsumme), 0) as GesamtUmsatz,
  MAX(b.dErstellt) as LetzteBestellung
FROM tKunde k
LEFT JOIN tBestellung b ON b.kKunde = k.kKunde 
  AND b.cStatus NOT IN ('storno', 'gelöscht')
WHERE k.nRegistriert = 1
GROUP BY k.kKunde, k.cFirma, k.cVorname, k.cNachname, k.cMail
ORDER BY GesamtUmsatz DESC
```

---

### **Q2: Top-Produkte eines Kunden**
```sql
SELECT TOP 10
  a.cName,
  a.cArtNr,
  SUM(bp.fAnzahl) as Menge,
  SUM(bp.fAnzahl * bp.fVKNetto) as Umsatz,
  aa.cWert as Produktkategorie
FROM tBestellung b
INNER JOIN tBestellpos bp ON bp.kBestellung = b.kBestellung
INNER JOIN tArtikel a ON a.kArtikel = bp.kArtikel
LEFT JOIN tArtikelAttribut aa ON aa.kArtikel = a.kArtikel 
  AND aa.cName = 'attr_produktkategorie'
WHERE b.kKunde = @kKunde
  AND b.cStatus NOT IN ('storno', 'gelöscht')
  AND bp.nTyp = 0
GROUP BY a.cName, a.cArtNr, aa.cWert
ORDER BY Umsatz DESC
```

---

### **Q3: Meist gekaufte Produktkategorie**
```sql
SELECT TOP 1
  ISNULL(aa.cWert, 'Sonstige') as Hauptkategorie,
  SUM(bp.fAnzahl * bp.fVKNetto) as Umsatz
FROM tBestellung b
INNER JOIN tBestellpos bp ON bp.kBestellung = b.kBestellung
INNER JOIN tArtikel a ON a.kArtikel = bp.kArtikel
LEFT JOIN tArtikelAttribut aa ON aa.kArtikel = a.kArtikel 
  AND aa.cName = 'attr_produktkategorie'
WHERE b.kKunde = @kKunde
  AND b.cStatus NOT IN ('storno', 'gelöscht')
  AND bp.nTyp = 0
GROUP BY ISNULL(aa.cWert, 'Sonstige')
ORDER BY Umsatz DESC
```

---

### **Q4: Kanal-Erkennung aus Bestellnummer**
```sql
SELECT 
  b.cBestellNr,
  b.cZahlungsart,
  b.cVersandart,
  CASE
    WHEN b.cBestellNr LIKE '302-%' OR b.cBestellNr LIKE '303-%' THEN 'Amazon'
    WHEN b.cBestellNr LIKE '%eBay%' THEN 'eBay'
    WHEN b.cZahlungsart LIKE '%PayPal%' THEN 'Shop'
    WHEN b.cZahlungsart LIKE '%Rechnung%' THEN 'Direktvertrieb'
    ELSE 'Unbekannt'
  END as Kanal
FROM tBestellung b
WHERE b.kKunde = @kKunde
  AND b.cStatus NOT IN ('storno', 'gelöscht')
ORDER BY b.dErstellt DESC
```

---

## ⚠️ HÄUFIGE FEHLER

### **1. Falsche Spaltennamen**
```sql
❌ fGesamtsummeNetto    -- Existiert nicht!
❌ fGesamtsummeNetter   -- Tippfehler!
✅ fGesamtsumme         -- Korrekt (BRUTTO)
✅ fWarensumme          -- Korrekt (NETTO)
```

### **2. Status vergessen**
```sql
❌ SELECT * FROM tBestellung
✅ SELECT * FROM tBestellung WHERE cStatus NOT IN ('storno', 'gelöscht')
```

### **3. nTyp vergessen**
```sql
❌ SELECT * FROM tBestellpos
✅ SELECT * FROM tBestellpos WHERE nTyp = 0  -- Nur Artikel
```

### **4. INNER JOIN statt LEFT JOIN**
```sql
❌ INNER JOIN tBestellung  -- Kunden ohne Bestellungen fehlen!
✅ LEFT JOIN tBestellung   -- Alle Kunden
```

---

## 🔗 BEZIEHUNGEN (Foreign Keys)

```
tKunde (kKunde)
  ↓
tBestellung (kKunde → kKunde)
  ↓
tBestellpos (kBestellung → kBestellung)
  ↓
tArtikel (kArtikel → kArtikel)
  ↓
tArtikelAttribut (kArtikel → kArtikel)
```

---

## 📚 WEITERE RESSOURCEN

**Offizielle Doku:** https://wawi-db.jtl-software.de/  
**JTL-Forum:** https://forum.jtl-software.de/  
**SQL-Connection:** `app/lib/db/mssql.ts`

---

## 🆕 CHANGELOG

**2025-12-05:**
- Initial-Dokumentation erstellt
- Best Practices hinzugefügt
- Häufige Fehler dokumentiert

---

**Bei Fragen oder Ergänzungen:** Bitte diese Datei aktualisieren!
