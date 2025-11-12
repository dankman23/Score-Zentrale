# Zahlungen für 10it Export - Mapping-Dokumentation

## Wie werden Zahlungen den Rechnungen zugeordnet?

### In JTL (Automatisch):
- Zahlungen haben Feld `kRechnung` (Foreign Key zur Rechnung)
- Beim Zahlungseingang wird automatisch die Rechnung verknüpft
- Status: Rechnung wechselt von "Offen" zu "Bezahlt" (`cBezahlt = 'Y'`)

### Für 10it Export:

**VK-Zahlungseingang** wird als **2 Buchungen** exportiert:

**1. Rechnung erstellen (SOLL-Buchung):**
```
Konto: 1200 (Forderungen aus LuL)
Datum: Rechnungsdatum
Belegnummer: Kundenbestellnummer
Text: Rechnungsnummer - Land
Gegenkonto: Sachkonto (z.B. 4400 Erlöse)
Soll: Bruttobetrag
Haben: 0
Steuer: 19% oder 0%
Steuerkonto: 3806 (USt) oder leer
```

**2. Zahlungseingang verbuchen (HABEN-Buchung):**
```
Konto: 1200 (Forderungen aus LuL)
Datum: Zahlungsdatum
Belegnummer: Zahlungsreferenz (PayPal-ID, Überweisungsreferenz etc.)
Text: "Zahlungseingang: RE2025-XXXXX"
Gegenkonto: 1800/1802 (Bankkonto je nach Anbieter)
Soll: 0
Haben: Zahlungsbetrag
Steuer: 0
Steuerkonto: leer
```

### Gegenkonto-Zuordnung nach Zahlungsanbieter:

| Zahlungsanbieter | Gegenkonto | Kontobezeichnung |
|------------------|------------|------------------|
| PayPal | 1820 | PayPal-Konto |
| Amazon Payment | 1825 | Amazon-Konto |
| Commerzbank | 1802 | Commerzbank Girokonto |
| Mollie | 1830 | Mollie-Konto |
| eBay Managed Payments | 1840 | eBay-Konto |
| Kreditkarte | 1850 | Kreditkartenkonto |
| Barzahlung | 1600 | Kasse |

### Beispiel - PayPal Zahlung:

**Rechnung erstellt (01.11.2025):**
```csv
"1200";"Forderungen aus LuL";"01.11.2025";"028-12345";"RE2025-98000 - DE";"4400";"119,00";"0,00";"19,00";"3806"
```

**Zahlung eingegangen via PayPal (05.11.2025):**
```csv
"1200";"Forderungen aus LuL";"05.11.2025";"PayPal-TX-123456";"Zahlungseingang: RE2025-98000";"1820";"0,00";"119,00";"0,00";""
```

**Ergebnis:**
- Forderung (1200) steigt um 119 € (Soll)
- Bei Zahlungseingang sinkt Forderung (1200) um 119 € (Haben)
- PayPal-Konto (1820) steigt um 119 €

### Automatische Zuordnung im System:

**Aktuell implementiert:**
- ✅ VK-Rechnungen werden aus JTL geholt
- ✅ VK-Zahlungen werden aus JTL geholt
- ✅ Zuordnung via `kRechnung` ist vorhanden
- ✅ Zahlungsanbieter wird erkannt

**Für 10it Export benötigt:**
- ✅ Rechnungsnummer aus `tRechnung.cRechnungsNr`
- ✅ Zahlungsdatum aus `tZahlung.dDatum`
- ✅ Zahlungsbetrag aus `tZahlung.fBetrag`
- ✅ Zahlungsanbieter aus `tZahlungsart.cName`
- ⚠️ Belegnummer: Aus `tZahlung.cHinweis` (enthält oft PayPal-ID, Referenz)
- ❌ Gegenkonto (Bankkonto): Muss noch gemappt werden

### Noch zu implementieren:

**1. Gegenkonto-Mapping:**
```typescript
function getBankKonto(zahlungsanbieter: string): string {
  if (zahlungsanbieter.includes('PayPal')) return '1820'
  if (zahlungsanbieter.includes('Amazon')) return '1825'
  if (zahlungsanbieter.includes('Commerzbank')) return '1802'
  if (zahlungsanbieter.includes('Mollie')) return '1830'
  if (zahlungsanbieter.includes('eBay')) return '1840'
  return '1800' // Default: Bank
}
```

**2. Export-API erweitern:**
- Zahlungen zu VK-Rechnungen in `/api/fibu/export/10it` hinzufügen
- Für jede Rechnung: Prüfen ob Zahlung vorhanden
- Falls ja: Zahlungsbuchung mit in Export aufnehmen

**3. Belegnummer-Generierung:**
- Aus `cHinweis` extrahieren (PayPal-ID, Transaktions-ID)
- Format: Wenn leer → `ZE-{Zahlungs-ID}`
- Beispiel: `PayPal-4R0XXXXX` oder `ZE-143908`

### Status:

**Daten vorhanden:** ✅
- Alle benötigten Daten sind in JTL vorhanden
- Zuordnung Zahlung → Rechnung funktioniert
- Zahlungsanbieter sind erkennbar

**Noch zu tun:**
1. Gegenkonto-Mapping nach Zahlungsanbieter
2. Export-API um Zahlungsbuchungen erweitern
3. Belegnummer sauber extrahieren/generieren

**Priorität:** HOCH - Für vollständigen 10it Export notwendig
