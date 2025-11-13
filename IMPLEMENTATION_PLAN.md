# FIBU Vollständige Implementierung - Plan

## Aktuelle Situation (Analysiert)

### Datenquellen in JTL-Wawi

#### RECHNUNGEN (3 Quellen):
1. **dbo.tRechnung** - Normale Ausgangsrechnungen (RE2025-XXXXX)
   - Oktober 2025: 789 Rechnungen
   - ✅ Bereits implementiert

2. **Rechnung.tExternerBeleg** - Externe Rechnungen (XRE-XXXXX)  
   - Oktober 2025: 1.140 externe Rechnungen (VCS-Lite = Amazon erstellt)
   - ❌ FEHLT - muss implementiert werden

3. **dbo.tgutschrift** - Gutschriften (GU2025-XXXXX)
   - Oktober 2025: 26 Gutschriften
   - ❌ FEHLT - muss implementiert werden

#### ZAHLUNGEN (2 Quellen):
1. **dbo.tZahlung** - Standard-Zahlungen
   - ✅ Implementiert mit dualer Zuordnung (kRechnung + kBestellung)

2. **dbo.tZahlungsabgleichUmsatz** - Bank-Transaktionen
   - ✅ Implementiert (Commerzbank, PayPal Bank, etc.)

#### POSTBANK (Neue Anforderung):
- ❌ Nicht in JTL vorhanden
- Lösung: CSV-Import-Feature wie Email-Inbox-Poller
- Alternative: Manuelle Zuordnung über cReferenz

## Implementierungsschritte

### PHASE 1: Externe Rechnungen & Gutschriften
1. Neuer API-Endpunkt `/api/fibu/rechnungen/extern` für externe Belege
2. Neuer API-Endpunkt `/api/fibu/gutschriften` für Gutschriften
3. VK-Rechnungen erweitern um UNION mit externen Rechnungen
4. Frontend: Tab für "Nicht zugeordnet" hinzufügen

### PHASE 2: Postbank CSV-Import
1. Neuer API-Endpunkt `/api/fibu/bank-import`
2. CSV-Parser für Postbank-Format
3. MongoDB Collection `fibu_bank_transaktionen`
4. Automatisches Matching über cReferenz/Verwendungszweck

### PHASE 3: Verknüpfungen & Übersicht
1. Alle Zahlungs-Rechnungs-Verknüpfungen aus JTL laden
2. Übersichts-Dashboard "Nicht zugeordnet"
3. Manuelle Zuordnungs-UI

### PHASE 4: 10it Export vervollständigen
1. Externe Rechnungen integrieren
2. Gutschriften integrieren
3. Postbank-Transaktionen integrieren
4. Finale Tests

## Technische Details

### Externe Rechnungen (Rechnung.tExternerBeleg)
```sql
SELECT 
  eb.kExternerBeleg,
  eb.cBelegnr,                    -- XRE-XXXXX
  eb.dBelegdatumUtc,              
  eb.nBelegtyp,                   -- 0=Rechnung, 1=Korrektur, 2=Storno
  eb.cHerkunft,                   -- VCS-Lite, VCS, IDU
  eb.kKunde,
  eb.kZahlungsart,
  eck.fBrutto,
  eck.fNetto,
  eck.fMwSt
FROM Rechnung.tExternerBeleg eb
LEFT JOIN Rechnung.tExternerBelegEckdaten eck ON eb.kExternerBeleg = eck.kExternerBeleg
```

### Gutschriften (dbo.tgutschrift)
```sql
SELECT
  g.kGutschrift,
  g.cGutschriftNr,               -- GU2025-XXXXX
  g.dErstellt,
  g.kRechnung,                   -- Verknüpfung zur Originalrechnung!
  g.kKunde,
  g.fPreis AS brutto,            -- Bruttobetrag
  g.fMwSt,
  g.nStorno
FROM dbo.tgutschrift g
```

### Postbank CSV-Format (geschätzt):
```csv
Buchungstag;Wertstellung;Buchungstext;Auftraggeber;Verwendungszweck;Betrag;Währung
01.10.2025;01.10.2025;Überweisung;Kunde Name;AU_12345_SW6;-150,00;EUR
```

## Priorität
1. **HOCH:** Externe Rechnungen (1.140 fehlen!)
2. **HOCH:** Gutschriften (für korrekte Buchhaltung)
3. **MITTEL:** Postbank CSV-Import
4. **HOCH:** Nicht-zugeordnet-Übersicht
5. **HOCH:** 10it Export Vervollständigung
