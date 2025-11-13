# FIBU-Modul - Quick Start Guide

## 🚀 In 5 Minuten loslegen

### 1. Voraussetzungen prüfen

```bash
# Node.js
node --version  # Sollte v20.x sein

# Python
python3 --version  # Sollte v3.9+ sein

# MongoDB
mongosh --version  # MongoDB Shell installiert
```

### 2. Dependencies installieren (falls noch nicht geschehen)

```bash
cd /app

# Node.js
yarn install

# Python
pip3 install pdfplumber pandas emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

### 3. Server starten

```bash
sudo supervisorctl status nextjs

# Falls nicht läuft:
sudo supervisorctl restart nextjs
```

### 4. Erste PDF verarbeiten

**Option A: Test mit einer Beispiel-Rechnung**

```bash
# Zeige pending PDFs
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_email_inbox.find({ status: 'pending' }).limit(1).pretty()
"

# Verarbeite 1 PDF (Hybrid)
cd /app
node scripts/batch-process-with-gemini-fallback.js 1
```

**Option B: Alle PDFs verarbeiten**

```bash
# Verarbeite alle pending PDFs
node scripts/batch-process-with-gemini-fallback.js 200
```

### 5. Auto-Matching ausführen

```bash
curl -X POST http://localhost:3000/api/fibu/auto-match-ek-zahlungen | python3 -m json.tool
```

### 6. Daten ansehen

**Via CLI:**

```bash
# EK-Rechnungen
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.find({ gesamtBetrag: { \$gt: 0 } }).limit(5).pretty()
"

# Statistik
mongosh mongodb://localhost:27017/score_zentrale --eval "
  print('Total:', db.fibu_ek_rechnungen.countDocuments())
  print('Mit Betrag:', db.fibu_ek_rechnungen.countDocuments({ gesamtBetrag: { \$gt: 0 } }))
"
```

**Via API:**

```bash
# EK-Rechnungen
curl "http://localhost:3000/api/fibu/rechnungen/ek?from=2025-10-01&limit=10" | python3 -m json.tool

# Zahlungen
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-10-01&limit=10" | python3 -m json.tool
```

**Via UI:**

Öffne: `http://localhost:3000/fibu/ek-manager`

### 7. Export für Buchhaltung

```bash
# 10it-Export als CSV
curl "http://localhost:3000/api/fibu/export/10it?from=2025-10-01&to=2025-11-13" > export.csv

# Datei öffnen
cat export.csv | head -20
```

---

## 📋 Häufige Aufgaben

### Neue Emails abholen

```bash
curl -X POST http://localhost:3000/api/fibu/email-inbox/test-fetch
```

### Status prüfen

```bash
# Pending PDFs
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_email_inbox.countDocuments({ status: 'pending' })
"

# Rechnungen ohne Betrag
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.countDocuments({ gesamtBetrag: { \$lte: 0 } })
"

# Rechnungen ohne Kreditor
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.countDocuments({ kreditorKonto: null })
"
```

### Kreditoren verwalten

```bash
# Liste aller Kreditoren
curl "http://localhost:3000/api/fibu/kreditoren?limit=200" | python3 -m json.tool

# Neuen Kreditor hinzufügen
curl -X POST http://localhost:3000/api/fibu/kreditoren \
  -H "Content-Type: application/json" \
  -d '{
    "kreditorenNummer": "70099",
    "name": "Neue Firma GmbH",
    "standardAufwandskonto": "5200"
  }'
```

### Spezifische Rechnung suchen

```bash
# Nach Rechnungsnummer
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.find({ 
    rechnungsNummer: '59428710' 
  }).pretty()
"

# Nach Lieferant
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.find({ 
    lieferantName: /KLINGSPOR/i 
  }).pretty()
"
```

### PDFs neu verarbeiten

```bash
# Alle Rechnungen ohne Betrag löschen
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.deleteMany({ gesamtBetrag: { \$lte: 0 } })
"

# Emails auf pending setzen
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_email_inbox.updateMany(
    { status: 'processed' },
    { \$set: { status: 'pending' } }
  )
"

# Neu verarbeiten
node scripts/batch-process-with-gemini-fallback.js 200
```

---

## 🛠️ Troubleshooting

### Problem: "No pending PDFs"

**Lösung:**

```bash
# Check Email-Inbox
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_email_inbox.find().limit(5).pretty()
"

# Falls leer: Emails manuell abholen
curl -X POST http://localhost:3000/api/fibu/email-inbox/test-fetch
```

### Problem: "Python script failed"

**Check Python:**

```bash
# Test Python
python3 --version

# Test Dependencies
python3 -c "import pdfplumber; import pandas; print('OK')"

# Test Parser
echo '{"pdf_base64":"test","filename":"test.pdf"}' | python3 /app/python_libs/fibu_invoice_parser.py
```

### Problem: "Gemini API error"

**Check Key:**

```bash
# ENV prüfen
grep GOOGLE_API_KEY /app/.env

# Test Gemini
echo '{"pdf_base64":"test","filename":"test.pdf","email_context":{}}' | \
  EMERGENT_LLM_KEY="$(grep GOOGLE_API_KEY /app/.env | cut -d= -f2)" \
  python3 /app/python_libs/emergent_gemini_parser.py
```

### Problem: "MongoDB connection failed"

**Check MongoDB:**

```bash
# Status
mongosh mongodb://localhost:27017/score_zentrale --eval "db.runCommand({ping: 1})"

# Collections
mongosh mongodb://localhost:27017/score_zentrale --eval "db.getCollectionNames()"
```

### Problem: "Server not responding"

**Restart:**

```bash
# Check Status
sudo supervisorctl status nextjs

# Restart
sudo supervisorctl restart nextjs

# Logs
tail -f /var/log/supervisor/nextjs.out.log
tail -f /var/log/supervisor/nextjs.err.log
```

---

## 💡 Tipps & Tricks

### 1. Batch-Processing beschleunigen

```bash
# Nur Python-Parser (schneller, keine Kosten)
node scripts/batch-process-pdfs-with-python.js 200

# Dann nur die fehlgeschlagenen mit Gemini
node scripts/batch-gemini-only.js 50
```

### 2. Beste Match-Rate erreichen

```bash
# 1. Alle PDFs verarbeiten
node scripts/batch-process-with-gemini-fallback.js 200

# 2. Kreditoren-Mapping vervollständigen
# Manuell in MongoDB oder via API

# 3. Auto-Matching ausführen
curl -X POST http://localhost:3000/api/fibu/auto-match-ek-zahlungen
```

### 3. Kosten sparen

- Bekannte Lieferanten zuerst mit Python parsen (kostenlos)
- Nur unbekannte mit Gemini (nur wenn nötig)
- Batch statt einzeln (schneller)

### 4. Daten-Qualität prüfen

```bash
# Rechnungen mit niedrigem Confidence-Score
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.find({ 
    'parsing.confidence': { \$lt: 70 } 
  }).count()
"

# Rechnungen die Review benötigen
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.find({ 
    needsManualReview: true 
  }).count()
"
```

---

## 📚 Weitere Dokumentation

- [README.md](./FIBU_README.md) - Vollständige Dokumentation
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API-Referenz
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technische Architektur

---

## 🎯 Nächste Schritte

Nach dem Quick Start:

1. ✅ **Alle PDFs verarbeitet** → Gehe zu Auto-Matching
2. ✅ **Auto-Matching läuft** → Prüfe Match-Rate
3. ✅ **Match-Rate OK** → Exportiere für Buchhaltung
4. 📊 **Dashboard erkunden** → `/fibu/ek-manager`
5. 🔧 **Kreditoren-Mapping** → Neue Lieferanten zuordnen
6. 📈 **Optimieren** → Mehr Python-Parser hinzufügen

---

## 🆘 Support

Bei Problemen:

1. **Logs checken**: `tail -f /var/log/supervisor/nextjs*.log`
2. **MongoDB prüfen**: `mongosh mongodb://localhost:27017/score_zentrale`
3. **Dokumentation lesen**: [FIBU_README.md](./FIBU_README.md)

---

**Happy Automating! 🚀**
