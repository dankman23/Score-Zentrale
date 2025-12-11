# 🚀 Amazon-Import-Modul - Quick Start

**Status:** ✅ Produktiv  
**Version:** 2.0 (mit Geldtransit)  
**Letzte Aktualisierung:** 04.12.2025

---

## 📖 Dokumentation

**Vollständige Dokumentation:** [`amazon-import-abschlussbericht.md`](./amazon-import-abschlussbericht.md)

---

## ⚡ Quick Start

### Import starten (API):

```bash
# Import für Oktober 2025
curl -X POST "https://biz-insight-5.preview.emergentagent.com/api/fibu/import/amazon-jtl?from=2025-10-01&to=2025-10-31&force=true"

# Import für aktuellen Monat
curl -X POST "https://biz-insight-5.preview.emergentagent.com/api/fibu/import/amazon-jtl?force=true"
```

### CSV-Export der Rohdaten:

```bash
# Download als CSV
curl "https://biz-insight-5.preview.emergentagent.com/api/fibu/debug/export-jtl-raw?from=2025-10-01&to=2025-10-31&format=csv" -o amazon-rohdaten.csv
```

---

## 📊 Was wird importiert?

| Quelle | Daten | Ergebnis |
|--------|-------|----------|
| **pf_amazon_settlementpos** | 7.881 Settlement-Positionen | 2.189 aggregierte Buchungen |
| **pf_amazon_settlement** | 20 Auszahlungen | 20 Geldtransit-Buchungen |
| **GESAMT** | | **2.209 Buchungen** |

### Konten:
- **69001:** Erlöse (+70.086 EUR)
- **6770:** Gebühren (-11.355 EUR)
- **1460:** Geldtransit (-62.490 EUR) ← **NEU!**
- **6600:** Werbekosten (-640 EUR)
- **1370:** Marketplace VAT (-35 EUR)
- **148328:** Refunds (-2.797 EUR)

---

## 🛠️ Code-Struktur

```
/app/app/lib/fibu/
  └── amazon-import-v2.ts        # Hauptlogik (PRODUKTIV)

/app/app/api/fibu/import/
  └── amazon-jtl/route.ts         # API-Endpunkt

/app/docs/
  ├── amazon-import-abschlussbericht.md   # Vollständige Doku
  └── README-Amazon-Import.md             # Diese Datei
```

---

## 🔧 Wartung

### Logs prüfen:
```bash
tail -n 100 /var/log/supervisor/nextjs.out.log | grep "Amazon JTL Import"
```

### Service neu starten:
```bash
sudo supervisorctl restart nextjs
```

### MongoDB prüfen:
```javascript
// In MongoDB Shell
db.zahlungen.countDocuments({ anbieter: 'Amazon', datum: { $gte: '2025-10-01', $lt: '2025-11-01' } })
```

---

## ⚠️ Bekannte ToDos

1. **Bank-Konto-Mapping:** Aktuell alle auf 1814, sollte variabel sein (1811, 1813, 1814, 1815, 1816, 1819)
2. **Frontend-Integration:** Detail-Ansicht erweitern
3. **Automatisierung:** Cron-Job für täglichen/wöchentlichen Import

---

## 📞 Bei Fragen

→ Siehe vollständige Dokumentation: [`amazon-import-abschlussbericht.md`](./amazon-import-abschlussbericht.md)
