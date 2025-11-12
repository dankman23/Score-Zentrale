# JTL-Wawi Datenbank Dokumentation

## 🔗 Offizielle JTL-Wawi Datenbank-Dokumentation
**URL**: https://wawi-db.jtl-software.de/tables/1.10.15.0

⚠️ **WICHTIG**: Diese Dokumentation gilt für ALLE JTL-Datenbank-Abfragen, nicht nur FIBU!
- Bei Bedarf Version prüfen und URL anpassen
- Aktuelle Version: 1.10.15.0

## 📊 Wichtige Tabellen für FIBU

### VK-Rechnungen (Ausgangsrechnungen)
| Tabelle | Schema | Beschreibung | Link |
|---------|--------|--------------|------|
| `tRechnung` | dbo | Rechnungen (Haupt-Tabelle) | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/dbo/tRechnung) |
| `lvRechnungsverwaltung` | Verkauf | Rechnungsverwaltung (View) | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/Verkauf/lvRechnungsverwaltung) |
| `lvRechnungsposition` | Verkauf | Rechnungspositionen | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/Verkauf/lvRechnungsposition) |
| `lvExterneRechnung` | Verkauf | Externe Rechnungen (Amazon, eBay) | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/Verkauf/lvExterneRechnung) |

### EK-Rechnungen (Eingangsrechnungen)
| Tabelle | Schema | Beschreibung | Link |
|---------|--------|--------------|------|
| `tEingangsrechnung` | dbo | Eingangsrechnungen | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/dbo/tEingangsrechnung) |
| `tEingangsrechnungPos` | dbo | Eingangsrechnungspositionen | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/dbo/tEingangsrechnungPos) |

### Zahlungen & Zahlungsarten
| Tabelle | Schema | Beschreibung | Link |
|---------|--------|--------------|------|
| `tZahlung` | dbo | Zahlungen | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/dbo/tZahlung) |
| `tZahlungsart` | dbo | Zahlungsarten | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/dbo/tZahlungsart) |

### Kunden & Lieferanten
| Tabelle | Schema | Beschreibung | Link |
|---------|--------|--------------|------|
| `tKunde` | dbo | Kunden | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/dbo/tKunde) |
| `tLieferant` | dbo | Lieferanten | [Doku](https://wawi-db.jtl-software.de/tables/1.10.15.0/dbo/tLieferant) |

### Marketplace-spezifisch
| Tabelle | Schema | Beschreibung |
|---------|--------|--------------|
| `tAmazonPayment` | dbo | Amazon Zahlungen |
| `tEbayPayment` | dbo | eBay Zahlungen |
| `tPayPalZahlung` | dbo | PayPal Zahlungen |

## 📅 Datenimport für Oktober 2024

### Zeitraum
- **Start**: 2024-10-01
- **Ende**: 2024-10-31
- **Ziel**: Alle Rechnungs- und Zahlungsdaten für Oktober importieren

### Import-Reihenfolge
1. ✅ **Kontenplan** (aus Excel bereits analysiert)
2. 🔄 **VK-Rechnungen** Oktober (aus `lvRechnungsverwaltung`)
3. 🔄 **EK-Rechnungen** Oktober (Upload + aus `tEingangsrechnung`)
4. 🔄 **Zahlungen** Oktober (aus `tZahlung`)
5. 🔄 **Marketplace-Zahlungen** (Amazon, eBay, PayPal)

### Wichtige Felder für FIBU

#### VK-Rechnung (tRechnung)
```sql
SELECT 
  kRechnung,           -- ID
  cRechnungsNr,        -- Rechnungsnummer
  dErstellt,           -- Rechnungsdatum
  fGesamtsumme,        -- Bruttosumme
  fWarensumme,         -- Nettosumme Waren
  fVersand,            -- Versandkosten
  fMwSt,               -- MwSt-Betrag
  cStatus,             -- Status (bezahlt, offen, etc.)
  kKunde               -- Kunden-ID
FROM dbo.tRechnung
WHERE dErstellt >= '2024-10-01' 
  AND dErstellt < '2024-11-01'
```

#### Zahlungen (tZahlung)
```sql
SELECT
  kZahlung,            -- ID
  kRechnung,           -- Zugeordnete Rechnung
  fBetrag,             -- Zahlungsbetrag
  dZeit,               -- Zahlungsdatum
  cHinweis,            -- Verwendungszweck
  kZahlungsart         -- Zahlungsart-ID
FROM dbo.tZahlung
WHERE dZeit >= '2024-10-01'
  AND dZeit < '2024-11-01'
```

## 🎯 Sammeldebitoren-Konfiguration

### Zahlungsarten (aus Screenshot)
- **70001**: Vorkasse (bereits bezahlt)
- **70004**: PayPal
- **70006**: Rechnung
- **70011**: Lastschrift
- **70103**: Amazon Payments
- **70104**: Mollie
- **70108**: eBay Managed Payments
- etc.

### Regel für Sammeldebitoren
- **Standard**: Sammeldebitoren nach Zahlungsart
- **Ausnahme**: Innergemeinschaftliche Lieferungen → Einzeldebitoren (wegen USt-ID)

## 🔧 API-Endpunkte (geplant)

```
GET  /api/fibu/rechnungen/vk?from=2024-10-01&to=2024-10-31
GET  /api/fibu/rechnungen/ek?from=2024-10-01&to=2024-10-31
GET  /api/fibu/zahlungen?from=2024-10-01&to=2024-10-31
GET  /api/fibu/kontenplan
POST /api/fibu/kontenplan
POST /api/fibu/rechnungen/ek/upload
GET  /api/fibu/export/10it?from=2024-10-01&to=2024-10-31
```

## 📝 10it Export-Format

### EXTF-Buchungsstapel
- **Header**: EXTF;700;21;"Buchungsstapel"...
- **116 Spalten** pro Buchungszeile
- **Wichtigste Felder**:
  - Umsatz (Soll/Haben)
  - Konto / Gegenkonto
  - Belegdatum
  - Buchungstext
  - BU-Schlüssel
  - EU-Land + USt-ID
  - Steuersatz

### Belegliste
- **38 Spalten**
- Wichtig: HEFT_ID, DATUM, BRUTTO, KONTO, GKONTO, BELEGFELD_1, TEXT

## 🚀 Implementierungsstatus

### ✅ Abgeschlossen
- [ ] Kontenplan aus Excel importiert
- [ ] JTL-Datenbank-Struktur analysiert
- [ ] Dokumentation erstellt

### 🔄 In Arbeit
- [ ] FIBU-Modul UI
- [ ] VK-Rechnungen Import
- [ ] EK-Rechnungen Upload
- [ ] Zahlungsdaten-Integration

### 📋 Geplant
- [ ] Oktober-Daten komplett importiert
- [ ] 10it Export-Funktion
- [ ] E-Mail-Upload für EK-Rechnungen
- [ ] Automatische Buchungserstellung

---

**Wichtig**: Diese Dokumentation wird kontinuierlich aktualisiert während der Entwicklung.
