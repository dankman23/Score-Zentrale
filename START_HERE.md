# 🎯 START HERE - Score Zentrale

## Willkommen, neuer Agent! 👋

Du arbeitest an der **Score Zentrale** - einem Next.js Dashboard für Sales (JTL-Wawi), Analytics (GA4), und Kaltakquise.

**Bevor du IRGENDETWAS machst, lies diese Dateien in dieser Reihenfolge:**

---

## 📚 PFLICHT-LEKTÜRE (in dieser Reihenfolge!)

### 1️⃣ **FORK_READY_GUIDE.md** ⭐ ZUERST LESEN!
**Pfad:** `/app/FORK_READY_GUIDE.md`

**Was drin steht:**
- ✅ 7-Schritt-Checkliste nach dem Forken
- ✅ Alle Services starten & testen
- ✅ Health-Checks ausführen
- ✅ Häufige Probleme & Lösungen

**Warum wichtig:** Stellt sicher, dass alle APIs funktionieren BEVOR du Änderungen machst!

---

### 2️⃣ **JTL_API_KNOWLEDGE.md** ⭐ KRITISCH!
**Pfad:** `/app/JTL_API_KNOWLEDGE.md`

**Was drin steht:**
- 📊 Komplettes JTL-Wawi MS SQL Schema (7 Tabellen)
- 🐛 4 bekannte Datenqualitäts-Issues + Workarounds
- 🎯 3 häufige Query-Patterns (Umsatz, Marge, Top-Produkte)
- ⚡ Performance-Tipps & Best Practices
- 🔧 Debugging-Queries

**Warum wichtig:** OHNE dieses Wissen machst du Fehler bei JTL-Queries! Versandkosten, Angebote, Stornierungen - alles hat Fallen!

---

### 3️⃣ **DEPLOYMENT_GUIDE.md** 
**Pfad:** `/app/DEPLOYMENT_GUIDE.md`

**Was drin steht:**
- 🚀 Deployment-Schritte
- 🔧 Supervisor-Konfiguration
- 🌐 Nginx-Routing
- 📝 Environment-Variablen

**Warum wichtig:** Production-Deployment ohne Downtime!

---

### 4️⃣ **KALTAKQUISE_ANLEITUNG.md**
**Pfad:** `/app/KALTAKQUISE_ANLEITUNG.md`

**Was drin steht:**
- 🔍 Wie das Kaltakquise-System funktioniert
- 🤖 AI-Analyse (analyzer-v2.ts)
- 📧 E-Mail-Generierung (emailer-v2.ts)
- 🌍 DACH-Crawler System
- 🎯 Autopilot-Funktionalität

**Warum wichtig:** Kaltakquise ist komplex - lies das BEVOR du es änderst!

---

## 📁 Weitere wichtige Dokumentationen

### **SCHEMA_MONITORING.md**
- JTL-Schema-Validierung
- Wie man Schema-Änderungen erkennt

### **ROBUSTNESS_GUARANTEE.md**
- Fehlerbehandlung Best Practices
- Error-Recovery-Strategien

### **test_result.md**
- Testing-Protokoll
- Kommunikation mit Testing-Agents
- **IMMER LESEN VOR TESTING!**

### **.env.example**
- Template für alle Environment-Variablen
- Zeigt, welche Keys benötigt werden

---

## 🎯 Quick-Start nach dem Forken

```bash
# 1. Status prüfen
sudo supervisorctl status

# 2. .env validieren
cat /app/.env | grep -v "^#" | grep "="

# 3. Health-Check
curl http://localhost:3000/api/jtl/sales/date-range
curl http://localhost:3000/api/analytics/metrics?startDate=7daysAgo&endDate=today
curl http://localhost:3000/api/coldleads/dach/stats

# 4. Dashboard öffnen
# http://localhost:3000
```

**Erwartetes Ergebnis:**
- ✅ Alle 3 APIs geben 200 OK zurück
- ✅ Dashboard lädt ohne Fehler
- ✅ Sales, Analytics, Kaltakquise funktionieren

---

## ⚠️ KRITISCHE REGELN

### ❌ NIEMALS:
1. **MONGO_URL ändern** → Muss `mongodb://localhost:27017` bleiben!
2. **NEXT_PUBLIC_BASE_URL hardcoden** → Wird automatisch gesetzt
3. **JTL-Schema-Namen raten** → Lies JTL_API_KNOWLEDGE.md!
4. **Ohne Health-Check deployen** → Immer testen!
5. **Testing-Agents aufrufen ohne test_result.md zu lesen** → Protokoll beachten!

### ✅ IMMER:
1. **FORK_READY_GUIDE.md zuerst lesen** → Checkliste abarbeiten
2. **JTL_API_KNOWLEDGE.md konsultieren** → Bei allen JTL-Queries
3. **test_result.md updaten** → Vor und nach Testing
4. **Logs prüfen** → `tail -f /var/log/supervisor/nextjs.out.log`
5. **Vorsichtig mit MSSQL** → Produktiv-Datenbank!

---

## 🗂️ Code-Struktur (Überblick)

```
/app/
├── app/
│   ├── api/                    # Alle Backend-APIs
│   │   ├── jtl/               # JTL-Wawi Sales APIs
│   │   ├── analytics/         # Google Analytics 4 APIs
│   │   ├── coldleads/         # Kaltakquise APIs
│   │   │   └── dach/          # DACH-Crawler System
│   │   └── glossary/          # Glossar-Management
│   ├── page.js                # Frontend Dashboard
│   └── layout.js              # Layout-Wrapper
├── lib/
│   ├── db/
│   │   ├── mssql.ts          # JTL-Wawi Connection
│   │   └── mongodb.ts        # MongoDB Connection
│   ├── analytics.ts          # GA4 Client
│   ├── glossary.ts           # Glossar-Daten (38 Branchen!)
│   └── email-client.ts       # SMTP/IMAP
├── services/
│   ├── coldleads/
│   │   ├── analyzer-v2.ts    # AI-Analyse
│   │   ├── emailer-v2.ts     # E-Mail-Generierung
│   │   └── dach-crawler.ts   # DACH-Crawler
│   └── glossary/
└── [DIESE DOKUMENTATIONEN]
    ├── START_HERE.md         ⭐ DU BIST HIER
    ├── FORK_READY_GUIDE.md   ⭐ NÄCHSTER SCHRITT
    ├── JTL_API_KNOWLEDGE.md  ⭐ PFLICHT
    └── ...weitere...
```

---

## 🆘 Wenn etwas nicht funktioniert

**Schritt-für-Schritt:**

1. **Prüfe Services:**
   ```bash
   sudo supervisorctl status
   ```
   Falls nicht RUNNING → `sudo supervisorctl restart all`

2. **Prüfe Logs:**
   ```bash
   tail -n 100 /var/log/supervisor/nextjs.out.log
   ```
   Suche nach Fehlern (ERROR, 500, failed)

3. **Health-Check:**
   ```bash
   curl http://localhost:3000/api/health/schema
   ```
   Zeigt JTL-Tabellen → Falls Fehler: MSSQL-Problem

4. **Konsultiere FORK_READY_GUIDE.md:**
   Abschnitt "Häufige Probleme nach dem Forken"

5. **Lies JTL_API_KNOWLEDGE.md:**
   Debugging-Queries Sektion

---

## 💡 Pro-Tipps

1. **Memory-Management:**
   - Node.js läuft mit 1024MB Memory
   - Bei Memory-Warnings → Restart: `sudo supervisorctl restart nextjs`

2. **JTL-Queries:**
   - IMMER Datum-Filter nutzen!
   - Versandkosten IMMER separat berechnen!
   - Angebote filtern: `WHERE cStatus != 'Angebot'`

3. **Testing:**
   - Backend ZUERST mit `deep_testing_backend_nextjs`
   - Frontend NUR nach User-Freigabe
   - IMMER test_result.md lesen/updaten!

4. **DACH-Crawler:**
   - 38 Branchen verfügbar (siehe lib/glossary.ts)
   - Google Search API muss konfiguriert sein
   - Engine ID GENAU kopieren: `0146da4031f5e42a3`

---

## ✅ Bereit? Los geht's!

**Deine nächsten Schritte:**

1. ✅ Diese Datei gelesen (du bist hier!)
2. 📖 Lies jetzt: `/app/FORK_READY_GUIDE.md`
3. 📖 Dann: `/app/JTL_API_KNOWLEDGE.md`
4. 🧪 Führe Health-Checks aus
5. 🚀 Starte mit der Aufgabe!

---

**Version:** 1.0  
**Erstellt:** 10.11.2025  
**Für:** Alle Agents nach dem Forken

**Viel Erfolg! 🎉**
