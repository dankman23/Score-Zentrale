# 🔧 FORK-READY GUIDE - Score Zentrale

**Version:** 2.0  
**Letzte Aktualisierung:** 11.11.2025  
**Status:** ✅ Produktionsbereit

---

## 📋 Pre-Deployment Checkliste

### 1. Environment Setup

**Datei:** `/app/.env`

```bash
# MongoDB (WICHTIG: Läuft lokal)
MONGO_URL=mongodb://localhost:27017/score_zentrale

# JTL-Wawi MSSQL Connection
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_USER=sa
MSSQL_PASSWORD=<SECRET>
MSSQL_DATABASE=eazybusiness
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# Email (SMTP für Kaltakquise)
SMTP_HOST=smtp.strato.de
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=daniel@score-schleifwerkzeuge.de
SMTP_PASS=<SECRET>
SMTP_FROM="Daniel von Score Schleifwerkzeuge <daniel@score-schleifwerkzeuge.de>"

# Google Custom Search (für Kaltakquise)
GOOGLE_SEARCH_ENGINE_ID=<ID>
GOOGLE_SEARCH_API_KEY=<KEY>

# Google Analytics 4
GA4_PROPERTY_ID=<ID>
GA4_CREDENTIALS=<JSON_KEY_BASE64>

# Google Ads
GOOGLE_ADS_CLIENT_ID=<ID>
GOOGLE_ADS_CLIENT_SECRET=<SECRET>
GOOGLE_ADS_REFRESH_TOKEN=<TOKEN>
GOOGLE_ADS_DEVELOPER_TOKEN=<TOKEN>
GOOGLE_ADS_CUSTOMER_ID=<ID>

# IMAP (Email-Inbox für Kaltakquise)
IMAP_HOST=imap.strato.de
IMAP_PORT=993
IMAP_USER=daniel@score-schleifwerkzeuge.de
IMAP_PASS=<SECRET>
IMAP_TLS=true

# Next.js
NEXT_PUBLIC_BASE_URL=https://score-zentrale.emergentagent.com
NEXT_PUBLIC_DEGRADED=0
NODE_OPTIONS=--max-old-space-size=1024

# Emergent LLM Key (wird automatisch gesetzt)
EMERGENT_API_KEY=<AUTO>
```

---

### 2. MongoDB Collections Setup

**KRITISCH:** Korrekte Collection-Namen verwenden!

```javascript
// ✅ KORREKT
db.collection('prospects')      // Kaltakquise
db.collection('articles')       // JTL-Artikel
db.collection('autopilot_state')// Autopilot

// ❌ FALSCH (Legacy)
db.collection('cold_prospects') // Veraltet!
```

**Collections erstellen (falls nicht vorhanden):**
```bash
mongo score_zentrale
db.createCollection('prospects')
db.createCollection('articles')
db.createCollection('autopilot_state')

db.prospects.createIndex({ "website": 1 }, { unique: true })
db.articles.createIndex({ "kArtikel": 1 }, { unique: true })
```

---

### 3. JTL-Wawi Connection Test

```bash
curl http://localhost:3000/api/jtl/articles/count

# Expected Output:
{
  "ok": true,
  "counts": {
    "gesamt": 318549,
    "importierbar": 166855
  }
}
```

---

### 4. Kaltakquise V3 System

#### **Komponenten:**

**Analyzer V3:**
- Multi-Page Crawl (7 Seiten: Home, Leistungen, Produkte, Referenzen, Team, Kontakt, Impressum)
- OpenAI GPT-4o LLM-Analyse
- Glossar-Mapping (311 Begriffe: 71 Anwendungen, 90 Werkstoffe, 62 Maschinen, 88 Kategorien)
- Contact Extraction mit Confidence
- Brand Matching (10 Score-Partner)

**Emailer V3:**
- 3 Mails: Erstansprache + Follow-up 1 (5d) + Follow-up 2 (12d)
- Plain Text (kein Markdown)
- Wortlimits: ≤180, ≤110, ≤90
- Personalisiert (Anrede, Website-Bezug, Marken)
- BCC an leismann@score-schleifwerkzeuge.de

**Auto-Follow-ups:**
- Automatisch via Cron-Job
- Prüft täglich fällige Follow-ups
- Versendet Mail 2 & 3 automatisch

#### **Blacklist (Verzeichnisse filtern):**
```javascript
// In prospector.ts & dach-crawler.ts
const blacklistedDomains = [
  'gelbenseiten.de', 'gelbeseiten.de',
  'wlw.de', 'wer-liefert-was.de',
  'lehrer-online.de', 'schulewirtschaft.de',
  'wikipedia.org', 'youtube.com',
  'facebook.com', 'linkedin.com',
  'indeed.de', 'stepstone.de'
]
```

#### **Testing:**
```bash
# 1. Einzelne Analyse
curl -X POST http://localhost:3000/api/coldleads/analyze-v3 \
  -H "Content-Type: application/json" \
  -d '{"website":"https://example.com","company_name":"Test","industry":"Metallverarbeitung"}'

# 2. Email versenden
curl -X POST http://localhost:3000/api/coldleads/email-v3/send \
  -H "Content-Type: application/json" \
  -d '{"prospect_id":"...","mail_number":1}'

# 3. Auto-Follow-ups prüfen
curl http://localhost:3000/api/coldleads/followup/auto
```

---

### 5. JTL Artikel-Import

**Full-Import starten:**
```bash
# Import ALLE 166.855 Artikel
curl -X POST http://localhost:3000/api/jtl/articles/import/start \
  -H "Content-Type: application/json" \
  -d '{"batchSize":2000,"offset":0}'

# Loop bis fertig (siehe /tmp/full_import.sh)
```

**Status prüfen:**
```bash
curl http://localhost:3000/api/jtl/articles/import/status

# Expected:
{
  "ok": true,
  "imported": 166855
}
```

---

### 6. Autopilot Setup

**Autopilot nutzt V3-APIs:**
- Suche → `/api/coldleads/search`
- Analyse → `/api/coldleads/analyze-v3`
- Email → `/api/coldleads/email-v3/send`

**Starten:**
```bash
curl -X POST http://localhost:3000/api/coldleads/autopilot/start \
  -H "Content-Type: application/json" \
  -d '{"dailyLimit":50}'
```

**Optional: Cron-Job für Auto-Follow-ups**
```bash
# /etc/cron.d/score-followups
0 10 * * * curl -s http://localhost:3000/api/coldleads/followup/auto
```

---

## 🚨 Bekannte Issues & Fixes

### Issue 1: Import-Pfade in API-Routes
**Problem:** `@/` Aliases funktionieren nicht in nested routes
**Fix:** Relative Pfade verwenden:
```javascript
// ❌ FALSCH
import { foo } from '@/lib/bar'

// ✅ RICHTIG
import { foo } from '../../../../lib/bar'
```

### Issue 2: MongoDB Collection Names
**Problem:** Alte Code nutzt `cold_prospects`
**Fix:** Überall auf `prospects` ändern

### Issue 3: Analysis Format
**Problem:** Mix aus `analysis` (alt) und `analysis_v3` (neu)
**Fix:** Immer beide prüfen:
```javascript
if (p.analysis_v3) {
  // V3 Format
} else if (p.analysis) {
  // Legacy Format
}
```

---

## ✅ Post-Deployment Tests

### 1. Basis-Funktionalität
```bash
# Health Check
curl http://localhost:3000/api/health/schema

# MongoDB Connection
curl http://localhost:3000/api/coldleads/stats

# JTL Connection
curl http://localhost:3000/api/jtl/sales/kpi
```

### 2. Kaltakquise V3
```bash
# Analyse testen
curl -X POST http://localhost:3000/api/coldleads/analyze-v3 \
  -d '{"website":"https://www.klingspor.de"}'

# Prüfen ob in DB
curl http://localhost:3000/api/coldleads/search?status=analyzed
```

### 3. Frontend
- Öffne `http://localhost:3000`
- Gehe zu Kaltakquise → Bulk-Analyse testen
- Gehe zu Produkte → Artikel-Browser testen
- Gehe zu Glossar → Branchen prüfen

---

## 📊 Performance-Tipps

### MongoDB Indices
```javascript
// Prospects
db.prospects.createIndex({ "status": 1 })
db.prospects.createIndex({ "score": -1 })
db.prospects.createIndex({ "created_at": -1 })

// Articles
db.articles.createIndex({ "cHerstellerName": 1 })
db.articles.createIndex({ "cWarengruppenName": 1 })
db.articles.createIndex({ "cName": "text" })
```

### Next.js Memory
```bash
# In .env
NODE_OPTIONS=--max-old-space-size=1024
```

---

## 🔐 Security Checklist

- [ ] `.env` nie committen
- [ ] MongoDB Password ändern
- [ ] MSSQL Password ändern
- [ ] SMTP Password ändern
- [ ] Google API Keys rotieren
- [ ] Firewall: Nur Port 3000 öffnen

---

## 📞 Support

Bei Problemen:
1. Prüfe Supervisor-Logs: `sudo supervisorctl tail -f nextjs`
2. Prüfe MongoDB: `mongo score_zentrale`
3. Prüfe JTL-Connection: `curl http://localhost:3000/api/jtl/articles/count`
4. Prüfe Test-Results: `cat /app/test_result.md`

---

**Version 2.0 - Kaltakquise V3 System - Ready for Production! 🚀**
