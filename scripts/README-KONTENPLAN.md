# Kontenplan-Management Scripts

⚠️ **Für detaillierte Dokumentation siehe:** `README-BELEGPFLICHT.md`

## Aktive Scripts

### `setup-kontenplan-belegpflicht.js` ✅ AKTUELL
**Zweck:** Initiales Setup oder Reset der Belegpflicht für alle Konten

**Was macht es:**
- Setzt ALLE Konten zuerst auf `belegpflicht = true`
- Setzt dann 29 Systemkonten auf `belegpflicht = false`:
  - Bank-/Zahlungskonten (1800, 1810, PayPal, etc.)
  - Steuer-/Verrechnungskonten (3720, 3730, 3806, etc.)
  - Lohnkonten (6020, 6035, 6110)
- Arbeitet mit Collection: **`kontenplan`** (von API genutzt)

**Ergebnis:**
- 53 Konten mit Belegpflicht (TRUE)
- 29 Konten ohne Belegpflicht (FALSE)

**Ausführen:**
```bash
cd /app
node scripts/setup-kontenplan-belegpflicht.js
```

**Wann ausführen:**
- Nur bei Problemen mit Belegpflicht-Werten
- NICHT im laufenden Betrieb nötig (System funktioniert automatisch)

### `cleanup-old-kontenplan.js`
**Zweck:** Aufräumen der alten `fibu_kontenplan` Collection

**Status:** ✅ Bereits ausgeführt (einmalig)
- Alte Collection wurde archiviert zu `_ARCHIV_fibu_kontenplan_deprecated`

---

## Archivierte Scripts (_ARCHIV/)

Alte Entwicklungs-Scripts, die nicht mehr benötigt werden:
- `setup-kontenplan-belegpflicht-OLD.js` - Alte Version (nicht funktionsfähig)
- `migrate-belegpflicht.js` - Erste Migration (überholt)
- `check-konten.js` - Debugging-Script (überholt)

---

## Datenbank-Collections

### ✅ Aktiv:
- **`kontenplan`** (82 Konten) - Von API genutzt, vollständig konfiguriert

### 📦 Archiviert:
- **`_ARCHIV_fibu_kontenplan_deprecated`** (138 Konten) - Alte Collection, führte zu Inkonsistenzen (seit 30.11.2025 archiviert)

---

## Systemkonten OHNE Belegpflicht

**Bank/Payment/Transit:**
1370, 1460, 1600, 1701, 1800, 1801, 1802, 1810, 1811, 1813, 1814, 1815, 1816, 1819, 1820, 1821, 1825

**Lohn/Steuern/Verrechnung:**
3720, 3730, 3740, 3790, 3804, 3806, 3817, 3820, 3837

**Löhne/Sozialaufwand:**
6020, 6035, 6110

**Sammeldebitoren:**
69001-69020

**Alle anderen Konten haben Belegpflicht = TRUE**
