# 🚀 START HERE - Score Zentrale

**Letzte Aktualisierung:** 11.11.2025  
**Version:** 2.0 (Kaltakquise V3 System)

---

## 📌 Für neue Agenten: Lies ZUERST diese Dateien

### 1️⃣ **README.md** (5 Min)
→ Projekt-Übersicht, Features, Tech-Stack

### 2️⃣ **FORK_READY_GUIDE.md** (10 Min)  
→ Deployment-Checkliste, Environment Setup, Testing

### 3️⃣ **JTL_API_KNOWLEDGE.md** (Optional, 10 Min)
→ JTL-Wawi Datenbank-Schema, Best Practices

---

## 🎯 Schnell-Navigation

### **Kaltakquise V3 System** (NEU!)
- **Services:** `/app/services/coldleads/`
  - `analyzer-v3.ts` - Multi-Page Crawl + LLM + Glossar (311 Begriffe)
  - `emailer-v3.ts` - 3 Mails (Erst + 2 Follow-ups, Plain Text)
  - `dach-crawler.ts` - Systematische DACH-Region Suche
  - `prospector.ts` - Google Custom Search Integration

- **APIs:** `/app/app/api/coldleads/`
  - `analyze-v3/route.ts` - Komplett-Analyse
  - `email-v3/send/route.ts` - Email-Versand + Follow-up Scheduling
  - `followup/auto/route.ts` - Auto Follow-up Cron
  - `autopilot/` - Autopilot-System (nutzt V3 APIs)
  - `delete/route.ts` - Prospect löschen

- **Config:** `/app/lib/score-coldleads-config.ts`
  - Firmen-Daten (Köln, Telefon, Email)
  - 10 Premium-Marken + Mapping
  - Email-Limits & Follow-up Schedule

### **JTL Artikel-Verwaltung**
- **Import:** `/app/app/api/jtl/articles/import/`
  - 166.855 Artikel aus JTL-Wawi
  - Batch-Import (2000/Batch)
  - MongoDB Collection: `articles`

- **Browser:** `/app/app/api/jtl/articles/`
  - `list/route.ts` - Filter + Pagination
  - `filters/route.ts` - Dynamische Filter-Optionen
  - `count/route.ts` - Artikel zählen

### **Frontend**
- `/app/app/page.js` - Haupt-Dashboard (Single-Page)
  - Kaltakquise Tab mit Bulk-Analyse
  - Produkte Tab mit Artikel-Browser
  - Glossar Tab (6 Kategorien)

---

## ⚠️ KRITISCHE INFORMATIONEN

### **MongoDB Collections**
```javascript
// WICHTIG: Richtige Collection-Namen verwenden!
prospects      // Kaltakquise-Firmen (NICHT cold_prospects!)
articles       // JTL-Artikel
autopilot_state // Autopilot-Status
```

### **Environment Variables (.env)**
```bash
# MongoDB
MONGO_URL=mongodb://localhost:27017/score_zentrale

# JTL-Wawi MSSQL
MSSQL_HOST=localhost
MSSQL_USER=sa
MSSQL_PASSWORD=...
MSSQL_DATABASE=eazybusiness

# Email (SMTP)
SMTP_HOST=smtp.strato.de
SMTP_PORT=465
SMTP_USER=daniel@score-schleifwerkzeuge.de
SMTP_PASS=...

# Google APIs
GOOGLE_SEARCH_ENGINE_ID=...
GOOGLE_SEARCH_API_KEY=...

# Emergent LLM (für OpenAI GPT-4o)
EMERGENT_API_KEY=... (wird automatisch gesetzt)
```

### **Wichtige Ports**
- Next.js: 3000 (intern, supervisor)
- MSSQL: 1433
- MongoDB: 27017

---

## 🔥 Häufige Probleme & Lösungen

### Problem: "Prospect not found in database"
**Lösung:** Collection-Name prüfen - muss `prospects` sein, nicht `cold_prospects`

### Problem: Analyse-Fehler "Cannot read property of undefined"
**Lösung:** V3-Daten prüfen (`analysis_v3` statt `analysis`)

### Problem: Import-Pfade funktionieren nicht
**Lösung:** In API-Routes relative Pfade verwenden (`../../../../lib/...`)

### Problem: Gelbenseiten/WLW-Einträge in Prospects
**Lösung:** Blacklist in `prospector.ts` und `dach-crawler.ts` prüfen

---

## 📞 Support & Fragen

Bei Fragen oder Problemen:
1. Prüfe `FORK_READY_GUIDE.md` → Testing-Section
2. Prüfe `JTL_API_KNOWLEDGE.md` → Bekannte Issues
3. Prüfe `test_result.md` → Letzte Test-Ergebnisse

---

**Viel Erfolg! 🚀**
