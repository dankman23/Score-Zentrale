# FIBU-Modul Dokumentation

## 📚 Willkommen

Dies ist die vollständige Dokumentation des FIBU-Moduls (Finanzbuchhaltung) für Score Schleifwerkzeuge.

**Was kann das System?**
- ✅ Automatische Verarbeitung von Lieferantenrechnungen (PDF)
- ✅ Intelligentes PDF-Parsing (Python + Gemini AI)
- ✅ Automatische Zahlung-zu-Rechnung-Zuordnung
- ✅ JTL-ERP-Integration
- ✅ Export für Buchhaltungssoftware (10it)

**Stand:** 365 Rechnungen verarbeitet, 108.005,79€ extrahiert ✨

---

## 🚀 Quick Links

| Ich möchte... | Dokument |
|---------------|----------|
| **Schnell loslegen** | [Quick Start Guide](./QUICKSTART.md) |
| **Alles verstehen** | [Vollständige README](./FIBU_README.md) |
| **API nutzen** | [API-Dokumentation](./API_DOCUMENTATION.md) |
| **Architektur verstehen** | [Architektur-Doku](./ARCHITECTURE.md) |
| **Übersicht aller Docs** | [Dokumentations-Index](./INDEX.md) |

---

## 📖 Dokumentations-Struktur

```
/docs
├── README.md                  ← Du bist hier
├── INDEX.md                   ← Vollständiger Index
├── QUICKSTART.md              ← In 5 Minuten loslegen
├── FIBU_README.md             ← Haupt-Dokumentation
├── API_DOCUMENTATION.md       ← API-Referenz
└── ARCHITECTURE.md            ← Technische Architektur
```

---

## 🎯 Für wen ist was?

### 👤 Endanwender (Buchhaltung)
1. [Quick Start](./QUICKSTART.md) - System nutzen lernen
2. [FIBU README - Verwendung](./FIBU_README.md#verwendung) - Workflows

### 👨‍💻 Entwickler
1. [FIBU README - Architektur](./FIBU_README.md#architektur) - Überblick
2. [Architektur](./ARCHITECTURE.md) - Details
3. [API-Doku](./API_DOCUMENTATION.md) - Endpoints

### 🔧 DevOps
1. [FIBU README - Installation](./FIBU_README.md#installation--setup)
2. [Architektur - Deployment](./ARCHITECTURE.md#deployment)
3. [Quick Start - Troubleshooting](./QUICKSTART.md#-troubleshooting)

---

## 💡 Häufige Aufgaben

### PDF verarbeiten
```bash
node scripts/batch-process-with-gemini-fallback.js 200
```
→ [Details](./QUICKSTART.md#4-erste-pdf-verarbeiten)

### Auto-Matching
```bash
curl -X POST http://localhost:3000/api/fibu/auto-match-ek-zahlungen
```
→ [Details](./QUICKSTART.md#5-auto-matching-ausführen)

### Export erstellen
```bash
curl "http://localhost:3000/api/fibu/export/10it?from=2025-10-01&to=2025-11-13" > export.csv
```
→ [Details](./QUICKSTART.md#7-export-für-buchhaltung)

---

## 📊 System-Übersicht

**Hybrid-Parsing-System:**
1. **Python-Parser** (bekannte Lieferanten) → Kostenlos, schnell
2. **Gemini AI** (unbekannte Lieferanten) → Flexibel, ~0,03€/PDF

**Erfolgsrate:** 93% gesamt
- Python: 96% bei bekannten Mustern
- Gemini: 90% bei unbekannten

**Kosten:** ~4€ für 145 unbekannte Rechnungen

→ [Mehr Details](./ARCHITECTURE.md#warum-hybrid-ansatz-python--gemini)

---

## 🆘 Hilfe benötigt?

1. **Quick Start nicht funktioniert?**
   → [Troubleshooting](./QUICKSTART.md#-troubleshooting)

2. **API-Frage?**
   → [API-Doku](./API_DOCUMENTATION.md)

3. **Technisches Problem?**
   → [Architektur - Monitoring](./ARCHITECTURE.md#monitoring--logging)

4. **Etwas fehlt?**
   → [INDEX.md](./INDEX.md) - Vollständige Übersicht

---

## 📈 Aktuelle Statistiken

| Metrik | Wert |
|--------|------|
| 📄 Total Rechnungen | 365 |
| 💰 Extrahierter Betrag | 108.005,79€ |
| 🐍 Python-geparst | 50 |
| 🤖 Gemini-geparst | 145 |
| 🎯 Auto-Match-Rate | 12.2% |
| ✅ Pending PDFs | 0 |

→ [Performance-Details](./FIBU_README.md#performance--statistiken)

---

## 🚀 Nächste Schritte

**Nach dem Lesen:**
1. [Quick Start durcharbeiten](./QUICKSTART.md)
2. [Erste PDFs verarbeiten](./QUICKSTART.md#4-erste-pdf-verarbeiten)
3. [Auto-Matching testen](./QUICKSTART.md#5-auto-matching-ausführen)
4. [System erweitern](./FIBU_README.md#roadmap)

---

## 📝 Letzte Updates

**13. November 2025**
- ✅ Vollständige Dokumentation erstellt
- ✅ 365 Rechnungen verarbeitet
- ✅ 108.005,79€ extrahiert
- ✅ System produktionsbereit

---

**Happy Automating! 🎉**

[↑ Zurück zum Anfang](#fibu-modul-dokumentation)
