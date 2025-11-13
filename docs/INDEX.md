# FIBU-Modul - Dokumentations-Index

Willkommen zur vollständigen Dokumentation des FIBU-Moduls (Finanzbuchhaltung).

## 📚 Dokumentations-Übersicht

### Für Einsteiger

| Dokument | Beschreibung | Lesezeit |
|----------|--------------|----------|
| **[Quick Start Guide](./QUICKSTART.md)** | In 5 Minuten loslegen | 5-10 Min |
| **[README](./FIBU_README.md)** | Vollständige Übersicht | 20-30 Min |

### Für Entwickler

| Dokument | Beschreibung | Lesezeit |
|----------|--------------|----------|
| **[API-Dokumentation](./API_DOCUMENTATION.md)** | Alle Endpoints und Parameter | 15-20 Min |
| **[Architektur](./ARCHITECTURE.md)** | Technische Details und Design | 30-40 Min |

---

## 🎯 Schnellzugriff nach Thema

### Erste Schritte
- [Installation & Setup](./FIBU_README.md#installation--setup)
- [Erste PDF verarbeiten](./QUICKSTART.md#4-erste-pdf-verarbeiten)
- [Server starten](./QUICKSTART.md#3-server-starten)

### PDF-Verarbeitung
- [Hybrid-Parsing-System](./FIBU_README.md#python-parser)
- [Batch-Processing](./QUICKSTART.md#4-erste-pdf-verarbeiten)
- [Python-Parser hinzufügen](./FIBU_README.md#neuen-parser-hinzufügen)
- [Gemini AI-Integration](./FIBU_README.md#gemini-ai-parsing)

### Auto-Matching
- [Matching-Algorithmus](./ARCHITECTURE.md#3-auto-matching-engine)
- [Matching ausführen](./QUICKSTART.md#5-auto-matching-ausführen)
- [Score-Berechnung](./FIBU_README.md#matching-logik)

### Datenbank
- [Schema-Übersicht](./FIBU_README.md#datenbank-schema)
- [Collections](./ARCHITECTURE.md#mongodb-collections)
- [Indizes](./ARCHITECTURE.md#1-fibu_email_inbox)

### API
- [Alle Endpoints](./API_DOCUMENTATION.md#endpoints)
- [EK-Rechnungen API](./API_DOCUMENTATION.md#ek-rechnungen-lieferantenrechnungen)
- [Auto-Matching API](./API_DOCUMENTATION.md#auto-matching)
- [Export API](./API_DOCUMENTATION.md#export)

### Troubleshooting
- [Häufige Probleme](./QUICKSTART.md#-troubleshooting)
- [Logs und Monitoring](./ARCHITECTURE.md#monitoring--logging)
- [Performance-Optimierung](./ARCHITECTURE.md#performance-optimierungen)

---

## 📖 Empfohlene Lese-Reihenfolge

### Für neue Benutzer:

1. **[Quick Start Guide](./QUICKSTART.md)** 
   → System zum Laufen bringen
   
2. **[README - Verwendung](./FIBU_README.md#verwendung)** 
   → Grundlegende Operationen verstehen
   
3. **[API-Doku - Endpoints](./API_DOCUMENTATION.md#endpoints)** 
   → APIs nutzen lernen

### Für Entwickler:

1. **[README - Architektur](./FIBU_README.md#architektur)** 
   → System-Überblick
   
2. **[Architektur - Komponenten](./ARCHITECTURE.md#komponenten-architektur)** 
   → Technische Details
   
3. **[Architektur - Datenbank](./ARCHITECTURE.md#datenbank-design)** 
   → Datenmodell verstehen

### Für DevOps:

1. **[README - Installation](./FIBU_README.md#installation--setup)** 
   → System aufsetzen
   
2. **[Architektur - Deployment](./ARCHITECTURE.md#deployment)** 
   → Production-Setup
   
3. **[Architektur - Skalierung](./ARCHITECTURE.md#skalierung)** 
   → Performance & Scaling

---

## 🔑 Wichtige Konzepte

### Hybrid-Parsing
Das System verwendet einen zweistufigen Ansatz:
1. **Python-Parser** für bekannte Lieferanten (schnell, kostenlos)
2. **Gemini AI** für unbekannte Lieferanten (flexibel, minimal cost)

→ [Mehr Details](./ARCHITECTURE.md#warum-hybrid-ansatz-python--gemini)

### Auto-Matching
Intelligenter Algorithmus ordnet Zahlungen automatisch Rechnungen zu:
- Score-basiert (Betrag, Datum, Rechnungsnummer)
- Threshold bei 70 Punkten
- 12.2% Match-Rate erreicht

→ [Mehr Details](./FIBU_README.md#auto-matching-algorithmus)

### JTL-Integration
Verbindung zur JTL-ERP-Datenbank für:
- Verkaufsrechnungen (VK)
- Zahlungstransaktionen
- Externe Rechnungen (Amazon XRE)

→ [Mehr Details](./ARCHITECTURE.md#4-jtl-integration)

---

## 📊 Aktuelle Statistiken

**Stand: 13. November 2025**

| Metrik | Wert |
|--------|------|
| Total EK-Rechnungen | 365 |
| Mit Betrag extrahiert | 197 (54.0%) |
| Gesamt-Betrag | 108.005,79€ |
| Python-geparst | 50 |
| Gemini-geparst | 145 |
| Auto-Match-Rate | 12.2% |
| Pending PDFs | 0 |

→ [Aktuelle Zahlen](./FIBU_README.md#performance--statistiken)

---

## 🎯 Use Cases

### 1. Monatlicher Buchhaltungs-Export

```bash
# 1. Neue Emails abholen
curl -X POST http://localhost:3000/api/fibu/email-inbox/test-fetch

# 2. PDFs verarbeiten
node scripts/batch-process-with-gemini-fallback.js 200

# 3. Auto-Matching
curl -X POST http://localhost:3000/api/fibu/auto-match-ek-zahlungen

# 4. Export für Steuerberater
curl "http://localhost:3000/api/fibu/export/10it?from=2025-11-01&to=2025-11-30" > november.csv
```

### 2. Neuen Lieferanten hinzufügen

```bash
# 1. Kreditor anlegen
curl -X POST http://localhost:3000/api/fibu/kreditoren \
  -H "Content-Type: application/json" \
  -d '{"kreditorenNummer":"70099","name":"Neue Firma GmbH"}'

# 2. Python-Parser erstellen (optional)
# Siehe: FIBU_README.md#neuen-parser-hinzufügen
```

### 3. Daten-Qualität prüfen

```bash
# Rechnungen ohne Betrag
mongosh score_zentrale --eval "
  db.fibu_ek_rechnungen.countDocuments({ gesamtBetrag: {\$lte: 0} })
"

# Rechnungen ohne Kreditor
mongosh score_zentrale --eval "
  db.fibu_ek_rechnungen.countDocuments({ kreditorKonto: null })
"
```

---

## 🔧 Tools & Scripts

### Batch-Processing

| Script | Zweck | Kosten |
|--------|-------|--------|
| `batch-process-pdfs-with-python.js` | Nur Python-Parser | Kostenlos |
| `batch-process-with-gemini-fallback.js` | Hybrid (Python + Gemini) | ~4€/200 PDFs |
| `batch-gemini-only.js` | Nur Gemini AI | ~6€/200 PDFs |

### Hilfsskripte

- `import-kreditoren.js` - Kreditoren aus CSV importieren
- `explore-jtl-payments.js` - JTL-Zahlungen analysieren

---

## 🆘 Support-Ressourcen

### Dokumentation
- [README](./FIBU_README.md) - Haupt-Dokumentation
- [Quick Start](./QUICKSTART.md) - Erste Schritte
- [API-Doku](./API_DOCUMENTATION.md) - API-Referenz
- [Architektur](./ARCHITECTURE.md) - Technische Details

### Logs
```bash
# Next.js Logs
tail -f /var/log/supervisor/nextjs.out.log
tail -f /var/log/supervisor/nextjs.err.log

# MongoDB Logs
mongosh --eval "db.adminCommand({getLog: 'global'})"
```

### Monitoring
```bash
# System-Status
sudo supervisorctl status

# Database-Status
mongosh --eval "db.runCommand({serverStatus: 1})"

# API-Health
curl http://localhost:3000/api/health
```

---

## 📝 Changelog

### Version 1.0.0 (November 2025)
- ✅ Initiale Implementierung
- ✅ Python-Parser-Integration (9 Lieferanten)
- ✅ Emergent Gemini AI-Integration
- ✅ Auto-Matching-Algorithmus
- ✅ JTL-Integration (VK, Zahlungen, Extern)
- ✅ 10it-Export
- ✅ Batch-Processing-Scripts
- ✅ 365 Rechnungen verarbeitet
- ✅ 108.005,79€ extrahiert

→ [Vollständiger Changelog](./FIBU_README.md#changelog)

---

## 🚀 Roadmap

### Q4 2025
- [ ] Dashboard-UI vervollständigen
- [ ] Bulk-Edit für Kreditor-Zuordnung
- [ ] Email-Cron-Job automatisieren

### Q1 2026
- [ ] Webhook für Echtzeit-Verarbeitung
- [ ] OCR für gescannte PDFs
- [ ] Mehr Python-Parser

### Q2 2026+
- [ ] Machine Learning für Matching
- [ ] Mobile App
- [ ] Multi-Tenant-Support

→ [Vollständige Roadmap](./FIBU_README.md#roadmap)

---

## 📄 Lizenz

Internes Projekt - Score Schleifwerkzeuge

---

## 🙏 Credits

**Entwickelt mit:**
- Next.js + TypeScript
- Python + pdfplumber
- MongoDB
- Gemini 2.0 Flash (via Emergent Universal Key)
- JTL-ERP

**Python-Parser ursprünglich von:** Score.Python Repository

---

**Letzte Aktualisierung:** 13. November 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
