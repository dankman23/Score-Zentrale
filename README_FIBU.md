# FIBU Modul - Dokumentation

## Übersicht
Das FIBU (Finanzbuchhaltung) Modul importiert Rechnungs- und Zahlungsdaten aus der JTL-Wawi Datenbank zur Vorbereitung für den Export in Buchhaltungssoftware (10it).

## Wichtige Erkenntnisse

### JTL Rechnungsstruktur
JTL speichert Rechnungen in **ZWEI verschiedenen Tabellen**:

1. **`dbo.tRechnung`** - Normale Rechnungen
   - Rechnungsnummern: `RE2025-XXXXX`
   - Von JTL-Wawi selbst erstellt
   - Aktuell **768 Rechnungen** im Oktober 2025

2. **`Rechnung.tExternerBeleg`** - Externe Rechnungen
   - Rechnungsnummern: `XRE-XXXXX` (Amazon VCS-Lite)
   - Von Amazon selbst erstellt
   - **1.140 externe Belege** im Oktober 2025
   - **WIRD AKTUELL NICHT IMPORTIERT** ❌

### JTL Zahlungsstruktur
Zahlungen sind ebenfalls in **ZWEI Quellen** gespeichert:

1. **`dbo.tZahlung`** - Standard-Zahlungen
   - PayPal, eBay, Amazon Payment, etc.
   - **~1.900 Zahlungen** im Oktober 2025
   - Zuordnung über:
     - **Direkt:** `kRechnung` → `tRechnung.kRechnung`
     - **Indirekt:** `kBestellung` → `tBestellung` → `tRechnung`

2. **`dbo.tZahlungsabgleichUmsatz`** - Bank-Transaktionen
   - Commerzbank, PayPal Bank, eBay Bank
   - **~700 Transaktionen** im Oktober 2025
   - Zuordnung über `cReferenz` (z.B. "AU_12345_SW6")

## Status Quo

### ✅ Bereits implementiert
- **VK-Rechnungen** aus `dbo.tRechnung` (normale Rechnungen)
- **Zahlungen** aus beiden Quellen (`tZahlung` + `tZahlungsabgleichUmsatz`)
- **EK-Rechnungen** (Lieferantenrechnungen via PDF-Upload + AI)
- **10it Export** (teilweise)

### ❌ Fehlt noch
- **Externe Rechnungen** aus `Rechnung.tExternerBeleg` (XRE-XXXXX)
- **Zuordnung** zwischen externen Rechnungen und Zahlungen
- **Integration** der externen Rechnungen in 10it Export

## Datenbank Schema (JTL 1.10.15.0)

### Rechnung.tExternerBeleg
Wichtige Spalten:
- `kExternerBeleg` (PK)
- `cBelegnr` (z.B. "XRE-5105")
- `dBelegdatumUtc` (Rechnungsdatum)
- `nBelegtyp` (0 = Rechnung, 1 = Korrektur, 2 = Storno)
- `cHerkunft` ("VCS-Lite", "VCS", "IDU")
- `kKunde` (Kundennummer)
- `kZahlungsart` (meist 8 = Amazon Payment)
- `cRAName`, `cRALandISO`, `cKaeuferUstId` (Rechnungsadresse)

### Rechnung.tExternerBelegEckdaten
- `kExternerBeleg` (FK)
- Brutto/Netto/MwSt Beträge (genaue Spaltennamen noch zu prüfen)

### Rechnung.tExternerBelegPosition
- `kExternerBelegPosition` (PK)
- `kExternerBeleg` (FK)
- `nPositionsNr`, `cArtikelNr`, `nAnzahl`, `fEinzelpreisBrutto`

## Referenzen
- **JTL-DB Dokumentation:** https://wawi-db.jtl-software.de/tables/1.10.15.0
- **JTL Guide - Externe Belege:** https://guide.jtl-software.com/jtl-wawi/verkauf/detailbeschreibung-ordner-externe-belege/
- **JTL Forum:** https://forum.jtl-software.de/ (bei speziellen Fragen)

## Nächste Schritte
1. API-Endpunkt für externe Rechnungen erstellen
2. Frontend-Integration (Tab "VK-Rechnungen" erweitern)
3. 10it Export um externe Rechnungen erweitern
4. Zuordnung zwischen externen Rechnungen und Zahlungen implementieren
