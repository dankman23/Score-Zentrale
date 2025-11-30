# Kontenplan-Management Scripts

## Aktive Scripts

### `setup-kontenplan-belegpflicht.js`
**Zweck:** Initiales Setup oder Reset der Belegpflicht für alle Konten

**Was macht es:**
- Legt fehlende Systemkonten an (Bank, Transit, Lohn/Steuern, Sammeldebitoren)
- Setzt Belegpflicht korrekt:
  - FALSE für 48 technische Konten (Bank, Steuer, Lohn, Sammeldebitoren)
  - TRUE für alle anderen Konten (Erlöse, Wareneinkauf, Aufwand)
- Arbeitet mit Collection: `kontenplan` (von API genutzt)

**Ausführen:**
```bash
cd /app
node scripts/setup-kontenplan-belegpflicht.js
```

**Wann ausführen:**
- Nur bei Problemen mit Belegpflicht-Werten
- NICHT im laufenden Betrieb nötig (System funktioniert automatisch)

---

## Archivierte Scripts (_ARCHIV/)

Alte Entwicklungs-Scripts, die nicht mehr benötigt werden:
- `migrate-belegpflicht.js` - Erste Migration (überholt)
- `check-konten.js` - Debugging-Script (überholt)

---

## Datenbank-Collections

### Aktiv:
- **`kontenplan`** (101 Konten) - Von API genutzt ✅

### Archiviert:
- **`_ARCHIV_fibu_kontenplan_old`** (160 Konten) - Alte Dopplung, nicht mehr verwendet

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
