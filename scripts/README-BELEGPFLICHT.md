# Kontenplan & Belegpflicht - Dokumentation

## Übersicht

Das FIBU-System verwendet einen **SKR04-Kontenplan** mit account-basierter **Belegpflicht**-Logik zur Bestimmung des Zuordnungsstatus von Transaktionen.

## Aktive Datenbank-Collection

**✅ AKTIV: `kontenplan`**
- Enthält alle SKR04-Konten mit vollständiger Struktur
- Wird von der API `/api/fibu/kontenplan` verwendet
- Alle CRUD-Operationen (GET, POST, PUT, DELETE) arbeiten mit dieser Collection

**📦 ARCHIVIERT: `_ARCHIV_fibu_kontenplan_deprecated`**
- Alte, nicht mehr verwendete Collection
- Wurde archiviert, da sie zu Daten-Inkonsistenzen führte

## Belegpflicht-Logik

### Was ist Belegpflicht?

Die `belegpflicht` ist ein Boolean-Flag auf jedem Konto, das bestimmt, ob für Buchungen auf diesem Konto ein Beleg (z.B. Rechnung, Lieferschein) erforderlich ist.

### Zuordnungsstatus-Berechnung

Für jede Transaktion wird der `zuordnungs_status` basierend auf dem zugeordneten Konto berechnet:

```javascript
if (!transaktion.zugeordnetes_konto) {
  status = 'offen'  // Kein Konto zugeordnet
} else if (konto.belegpflicht === false) {
  status = 'zugeordnet'  // Konto ohne Belegpflicht → sofort zugeordnet
} else if (konto.belegpflicht === true && transaktion.beleg_ids.length > 0) {
  status = 'zugeordnet'  // Beleg vorhanden → zugeordnet
} else {
  status = 'beleg_fehlt'  // Beleg erforderlich, aber fehlt
}
```

### Konten OHNE Belegpflicht (belegpflicht=false)

**Bank- und Zahlungskonten (Klasse 1):**
- 1370 - Durchlaufende Posten
- 1460 - Geldtransit
- 1600 - Verrechnungskonten
- 1701 - Privates Verrechnungskonto
- 1800 - Bank
- 1801 - PayPal
- 1802 - Stripe
- 1810 - Commerzbank
- 1811 - Postbank
- 1813 - Mollie
- 1814 - eBay Managed Payments
- 1815 - Amazon Settlement
- 1816 - Kaufland
- 1819 - Otto
- 1820 - Kreditkarten
- 1821 - Ratepay
- 1825 - Kasse

**Verbindlichkeiten und Steuern (Klasse 3):**
- 3720 - Verbindlichkeiten aus Lohn und Gehalt
- 3730 - Umsatzsteuer-Zahllast
- 3740 - Sonstige Verbindlichkeiten
- 3790 - Durchlaufende Posten (Passiva)
- 3804 - Umsatzsteuer Vorjahr
- 3806 - Umsatzsteuer 19 %
- 3817 - Umsatzsteuer aus ig. Erwerb 19 %
- 3820 - Umsatzsteuer Vorjahre
- 3837 - Umsatzsteuer Vorauszahlungen

**Löhne und Sozialaufwand (Klasse 6):**
- 6020 - Gehälter
- 6035 - Gesetzliche soziale Aufwendungen
- 6110 - Lohnfortzahlung

**Sammeldebitoren (Klasse 6):**
- 69001-69020 - Diverse Sammelkonten nach Zahlungsart

### Konten MIT Belegpflicht (belegpflicht=true)

**Alle anderen Konten**, insbesondere:
- Sachkonten für Wareneinkauf (5xxx)
- Betriebskosten (6xxx, außer oben genannte)
- Erlöskonten (4xxx)
- Debitorenkonten (1xxx)
- Kreditorenkonten (7xxx)

## Scripts

### Setup & Migration

**`setup-kontenplan-belegpflicht.js`** (AKTUELL)
- Setzt `belegpflicht` für alle Konten in der `kontenplan` Collection
- Logik:
  1. Alle Konten → `belegpflicht = true` (Basis)
  2. Spezifische Systemkonten → `belegpflicht = false`
- **Verwendung:**
  ```bash
  cd /app && node scripts/setup-kontenplan-belegpflicht.js
  ```

**`cleanup-old-kontenplan.js`**
- Archiviert die alte `fibu_kontenplan` Collection
- Verifiziert die aktive `kontenplan` Collection
- **Einmalig ausgeführt** (nicht mehr nötig)

### Archivierte Scripts

**`_ARCHIV/setup-kontenplan-belegpflicht-OLD.js`**
- Alte Version, die nicht korrekt funktionierte
- Problem: Verwendete `$nin` mit fehlgeschlagenen Updates
- **Nicht mehr verwenden!**

**`_ARCHIV/migrate-belegpflicht.js`**
- Frühere Versionen der Migration
- Veraltet und archiviert

## API-Endpunkte

### GET /api/fibu/kontenplan
Liefert alle Konten mit `belegpflicht` Flag.

**Query-Parameter:**
- `klasse` - Filter nach Kontenklasse (0-9)
- `gruppe` - Filter nach Kontengruppe
- `aktiv` - Nur aktive Konten
- `search` - Suchbegriff (Kontonummer oder Bezeichnung)

**Response:**
```json
{
  "ok": true,
  "konten": [
    {
      "kontonummer": "1200",
      "bezeichnung": "Forderungen...",
      "klasse": "1",
      "belegpflicht": true
    }
  ],
  "grouped": [...],
  "total": 82
}
```

### POST /api/fibu/kontenplan
Erstellt oder aktualisiert ein Konto.

**Body:**
```json
{
  "kontonummer": "6770",
  "bezeichnung": "Amazongebühren",
  "klasse": 6,
  "belegpflicht": true,
  "istAktiv": true
}
```

### PUT /api/fibu/kontenplan
Aktualisiert ein bestehendes Konto.

**Body:**
```json
{
  "kontonummer": "6770",
  "belegpflicht": false  // Toggle
}
```

### DELETE /api/fibu/kontenplan
Löscht ein Konto (nur wenn nicht Systemkonto).

**Query-Parameter:**
- `kontonummer` - Die zu löschende Kontonummer

## Frontend-Integration

### KontenplanView.js

Die Kontenplan-Ansicht zeigt:
- 6 Tabs nach SKR04-Kontenklassen (0-6)
- Tabelle mit Spalten: Kontonummer, Bezeichnung, Klasse, **Belegpflicht**, Aktionen
- Toggle-Button in der Belegpflicht-Spalte:
  - **✓ Ja** (grün) = Beleg erforderlich
  - **✗ Nein** (grau) = Kein Beleg nötig

**Toggle-Funktion:**
Beim Klick auf den Button wird ein POST-Request gesendet, der die `belegpflicht` umschaltet.

### ZahlungenMasterDetail.js

Die Umsätze-Ansicht verwendet die `belegpflicht` zur Farbcodierung:
- 🔴 **Rot** - `offen` (kein Konto zugeordnet)
- 🟡 **Gelb** - `beleg_fehlt` (Konto mit Belegpflicht, aber kein Beleg)
- 🟢 **Grün** - `zugeordnet` (Konto ohne Belegpflicht ODER Beleg vorhanden)

## Troubleshooting

### Problem: Alle Konten zeigen "✓ Ja" an

**Ursache:** Datenbank-Werte sind `undefined` statt `true`/`false`

**Lösung:**
```bash
cd /app && node scripts/setup-kontenplan-belegpflicht.js
```

### Problem: Toggle speichert nicht

**Ursache:** API schreibt in falsche Collection

**Lösung:** Prüfen Sie `/app/app/api/fibu/kontenplan/route.ts`:
- Alle Methoden müssen `db.collection('kontenplan')` verwenden
- **NICHT** `fibu_kontenplan`!

### Problem: Inkonsistente Daten

**Ursache:** Mehrere Collections existieren

**Lösung:**
```bash
cd /app && node scripts/cleanup-old-kontenplan.js
```

## Änderungshistorie

### 2025-11-30 - Major Fix
- **Problem:** Alle Konten zeigten `belegpflicht=true` an
- **Root Cause:** 
  1. API-Inkonsistenz (GET aus `kontenplan`, POST/PUT in `fibu_kontenplan`)
  2. DB-Werte waren `undefined`
- **Fix:**
  1. API korrigiert → alle Methoden verwenden `kontenplan`
  2. Neues Migration-Script erstellt
  3. Alte Collection archiviert
- **Ergebnis:** 53 Konten mit, 29 Konten ohne Belegpflicht

---

**Letzte Aktualisierung:** 30. November 2025  
**Status:** ✅ Produktiv und stabil
