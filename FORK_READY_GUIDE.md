# 🚀 FORK READY GUIDE - Score Zentrale v3.0

**Datum:** 12.11.2025  
**Version:** 3.0 (Preisberechnung g2 + Artikel-Management)

---

## ✅ Deployment Checklist

### 1. Environment Setup

**a) Kopiere .env.example zu .env:**
```bash
cp .env.example .env
```

**b) Pflichtfelder in .env ausfüllen:**
```bash
# MongoDB (lokal oder extern)
MONGO_URL=mongodb://localhost:27017/score_zentrale

# JTL-Wawi Datenbank
MSSQL_HOST=ihre-jtl-server-ip
MSSQL_USER=sa
MSSQL_PASSWORD=IhrPasswort
MSSQL_DATABASE=eazybusiness

# Email (für Kaltakquise)
SMTP_HOST=smtp.ihreprovider.de
SMTP_USER=ihre@email.de
SMTP_PASS=IhrPasswort

# Google Custom Search (WICHTIG!)
GOOGLE_SEARCH_ENGINE_ID=...
GOOGLE_SEARCH_API_KEY=...
```

**c) Optionale Felder:**
```bash
JINA_API_KEY=...     # Für besseres Crawling (optional)
GA4_PROPERTY_ID=...  # Für Analytics (optional)
```

---

### 2. Dependencies installieren

```bash
cd /app
yarn install
```

---

### 3. MongoDB Setup

```bash
# MongoDB starten (falls nicht läuft)
sudo systemctl start mongod

# Collections erstellen
mongosh score_zentrale
db.createCollection('prospects')
db.createCollection('articles')
db.createCollection('preisformeln')
db.createCollection('g2_configs')
db.createCollection('autopilot_state')
exit
```

---

### 4. Artikel-Import (Einmalig)

**Option A: Via UI (empfohlen)**
1. App starten: `sudo supervisorctl restart nextjs`
2. Browser öffnen: `http://localhost:3000#produkte`
3. Tab "Import" wählen
4. "Artikel-Import starten" klicken
5. Warten (~1-2 Stunden für 166.855 Artikel)

**Option B: Via Script (für große Imports)**
```bash
node /app/scripts/cursor-import-small.js
```

**Als Supervisor-Service (automatischer Neustart):**
```bash
sudo supervisorctl start jtl-import
sudo supervisorctl tail -f jtl-import
```

---

### 5. Preisformeln Setup

**Default-Formeln werden automatisch erstellt:**
- Beim ersten Aufruf von `/api/preise/formeln`
- 7 Warengruppen mit Standard-Reglern
- Basierend auf Excel: "Alte Preisberechnungsformeln Score je Warengruppe.xlsx"

**Keine manuelle Konfiguration nötig!**

---

### 6. Kaltakquise Setup (optional)

**Glossar importieren:**
```bash
curl -X POST http://localhost:3000/api/glossary/generate
```

**Autopilot konfigurieren:**
```bash
curl -X POST http://localhost:3000/api/coldleads/autopilot/config \
  -H "Content-Type: application/json" \
  -d '{"maxPerDay": 10, "enabled": true}'
```

---

## 🧪 Testing

### **1. API Health Check**
```bash
curl http://localhost:3000/api/preise/formeln
curl http://localhost:3000/api/jtl/articles/count
curl http://localhost:3000/api/coldleads/stats
```

### **2. Preisberechnung testen**
```bash
# Alte Berechnung (Lagerware, EK=10€)
curl -X POST http://localhost:3000/api/preise/berechnen \
  -H "Content-Type: application/json" \
  -d '{"ek":10,"regler":{"gewinn_regler_1a":0.94,"gewinn_regler_2c":1.07,"gewinn_regler_3e":1,"prozent_aufschlag":0.08,"paypal":0.02,"ebay_amazon":0.25,"paypal_fix":0.35,"fixkosten_beitrag":1.4,"aa_threshold":18},"ve_staffeln":[1,5,10]}'

# g2-Berechnung (Klingspor, EK=10€)
curl -X POST http://localhost:3000/api/preise/g2/berechnen \
  -H "Content-Type: application/json" \
  -d '{"ek":10,"warengruppe_regler":{"gewinn_regler_1a":0.81,"gewinn_regler_2c":1.07,"gewinn_regler_3e":1},"g2_params":{"gstart_ek":12,"gneu_ek":100,"gneu_vk":189,"fixcost1":0.35,"fixcost2":1.4,"varpct1":0.25,"varpct2":0.02,"aufschlag":1.08,"shp_fac":0.92}}'
```

**Erwartete Ergebnisse:**
- Alte PB (Lagerware, EK=10€): Plattform = 31.17€, Shop-Staffeln: 28.68€, 26.28€, 25.60€...
- g2 (Klingspor, EK=10€): Plattform = 27.60€ (identisch mit Alter PB da EK < gstart)

### **3. Artikel-Präsenz testen**
```bash
# Präsenz für Artikel kArtikel=94626
curl http://localhost:3000/api/jtl/articles/presence/94626
```

---

## 🐛 Troubleshooting

### Problem: "Formeln werden nicht geladen"
**Lösung:**
```bash
# MongoDB Collection löschen und neu laden lassen
mongosh score_zentrale --eval "db.preisformeln.deleteMany({})"
# Browser neu laden
```

### Problem: "Import hängt/stoppt"
**Lösung:**
```bash
# Supervisor-Service neu starten
sudo supervisorctl restart jtl-import

# Oder manuell cursor-basiert:
node /app/scripts/cursor-import-small.js
```

### Problem: "Preisberechnung zeigt falsche Werte"
**Lösung:**
- Prüfe Regler in MongoDB: `db.preisformeln.find()`
- Vergleiche mit Excel-Vorlage
- g2: EK < gstart_ek muss identisch mit Alter PB sein!

### Problem: "Preview lädt nicht"
**Lösung:**
```bash
# Cache löschen
rm -rf /app/.next
sudo supervisorctl restart nextjs
```

---

## 📊 Performance-Tipps

### **MongoDB Indizes erstellen:**
```bash
mongosh score_zentrale
db.articles.createIndex({ cArtNr: 1 })
db.articles.createIndex({ cHerstellerName: 1 })
db.articles.createIndex({ cWarengruppenName: 1 })
db.articles.createIndex({ kArtikel: 1 }, { unique: true })
db.prospects.createIndex({ website: 1 }, { unique: true })
```

### **Supervisor-Services optimieren:**
```bash
# JTL-Import nur bei Bedarf laufen lassen
sudo supervisorctl stop jtl-import

# Bei großem Datenbestand: MongoDB Memory erhöhen
# /etc/mongod.conf: storage.wiredTiger.engineConfig.cacheSizeGB
```

---

## 🎓 Für Entwickler

### **Neue Preisformel hinzufügen:**
1. In `/app/app/api/preise/formeln/route.ts` → `getDefaultFormeln()`
2. Neue Warengruppe mit Reglern hinzufügen
3. MongoDB Collection löschen: `db.preisformeln.deleteMany({})`
4. Formeln neu laden lassen

### **g2-Parameter ändern:**
1. UI: Tab "Neue ab 2025-11 (g2)"
2. Warengruppe wählen
3. Werte ändern (gstart_ek, gneu_ek, gneu_vk, etc.)
4. "Speichern" klicken
5. Wird in `g2_configs` Collection gespeichert

### **Artikel-Präsenz erweitern:**
- API: `/app/app/api/jtl/articles/presence/[kArtikel]/route.ts`
- SQL-Queries für weitere Plattformen hinzufügen
- Frontend: Automatisch aktualisiert

---

## 📦 Deployment Checklist

- [ ] .env ausgefüllt
- [ ] Dependencies installiert (`yarn install`)
- [ ] MongoDB läuft
- [ ] JTL-Wawi MSSQL erreichbar
- [ ] Artikel importiert (166.855)
- [ ] Preisformeln geladen (7 Warengruppen)
- [ ] Email-Versand getestet
- [ ] Google Search API getestet
- [ ] Supervisor läuft (`supervisorctl status`)

---

## 🆘 Support

**Dokumentation:**
- README.md - Feature-Übersicht
- START_HERE.md - Schnelleinstieg
- JTL_API_KNOWLEDGE.md - Datenbank-Schema
- test_result.md - Test-Protokolle

**Logs:**
```bash
sudo supervisorctl tail -f nextjs      # Next.js Logs
sudo supervisorctl tail -f jtl-import  # Import Logs
tail -f /tmp/cursor-import.log         # Manual Import
```

---

**Viel Erfolg mit Score Zentrale v3.0! 🚀**
