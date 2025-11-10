# 🚀 Fork-Ready Guide für Score Zentrale

## ✅ Nach dem Forken - Checkliste für neue Agents

Dieses Dokument stellt sicher, dass die Score Zentrale nach dem Forken **sofort funktioniert**.

---

## 📋 Schritt 1: Umgebungsvariablen prüfen

Alle erforderlichen Keys sind in `/app/.env`. Prüfe:

```bash
# Öffne .env
cat /app/.env
```

### ✅ Muss vorhanden sein:
```bash
# MongoDB (LOKAL - nicht ändern!)
MONGO_URL=mongodb://localhost:27017
DB_NAME=score_zentrale

# JTL-Wawi MS SQL (Produktiv-Datenbank)
MSSQL_HOST=162.55.235.45
MSSQL_PORT=1433
MSSQL_DATABASE=eazybusinesstest
MSSQL_USER=sa
MSSQL_PASSWORD=[vorhanden]

# Google Analytics 4
GA4_PROPERTY_ID=[vorhanden]
GA4_PRIVATE_KEY=[vorhanden]
GA4_CLIENT_EMAIL=[vorhanden]

# Google Search API (für DACH-Crawler)
GOOGLE_SEARCH_API_KEY=[vorhanden]
GOOGLE_SEARCH_ENGINE_ID=0146da4031f5e42a3

# E-Mail (SMTP/IMAP für Kaltakquise)
SMTP_HOST=mail.score-schleifwerkzeuge.de
SMTP_PORT=587
SMTP_USER=[vorhanden]
SMTP_PASSWORD=[vorhanden]
SMTP_FROM=[vorhanden]
REPLY_TO_EMAIL=[vorhanden]

IMAP_HOST=mail.score-schleifwerkzeuge.de
IMAP_PORT=993
IMAP_USER=[vorhanden]
IMAP_PASSWORD=[vorhanden]

# OpenAI (für Kaltakquise-Analyse)
OPENAI_API_KEY=[vorhanden]

# Next.js
NEXT_PUBLIC_BASE_URL=[Auto-configured]
```

**⚠️ NIEMALS ändern:**
- `MONGO_URL` → Muss `mongodb://localhost:27017` bleiben!
- `NEXT_PUBLIC_BASE_URL` → Wird automatisch gesetzt

---

## 🔧 Schritt 2: Services starten

```bash
# Prüfe Status
sudo supervisorctl status

# Expected output:
# mongodb     RUNNING
# nextjs      RUNNING
```

Falls nicht:
```bash
sudo supervisorctl restart all
```

---

## 🧪 Schritt 3: Health-Check

```bash
# Test JTL-API
curl http://localhost:3000/api/jtl/sales/date-range

# Expected: {"ok":true,"min":"2021-02-05","max":"YYYY-MM-DD"}

# Test Analytics
curl http://localhost:3000/api/analytics/metrics?startDate=30daysAgo&endDate=today

# Expected: {"sessions":..., "users":...}

# Test DACH-Crawler
curl http://localhost:3000/api/coldleads/dach/stats

# Expected: {"ok":true,"stats":{...}}
```

---

## 📚 Schritt 4: JTL-API-Wissen lesen

**WICHTIG:** Lies zuerst `/app/JTL_API_KNOWLEDGE.md`!

Dieses Dokument enthält:
- Schema-Struktur aller JTL-Tabellen
- Bekannte Datenqualitäts-Issues
- Query-Patterns und Best Practices
- Performance-Tipps
- Debugging-Queries

**OHNE dieses Wissen wirst du Fehler machen!**

---

## 🗄️ Schritt 5: MongoDB Collections prüfen

```bash
# MongoDB Shell öffnen
mongosh mongodb://localhost:27017/score_zentrale

# Collections anzeigen
show collections

# Expected:
# - cold_prospects (Kaltakquise-Firmen)
# - dach_crawl_progress (DACH-Crawler-Status)
# - glossary_v1 (Glossar-Versionen)

# Test Query
db.cold_prospects.countDocuments()
```

---

## ⚙️ Schritt 6: Konfigurationen validieren

### Google Search API testen:
```bash
curl "https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=test&num=1"

# Expected: JSON mit "items" Array
# Falls 400: API Key oder Engine ID falsch!
```

### MSSQL Connection testen:
```bash
curl http://localhost:3000/api/health/schema

# Expected: Liste aller JTL-Tabellen
```

---

## 🚨 Häufige Probleme nach dem Forken

### Problem 1: "504 Gateway Timeout"
**Ursache:** Next.js Memory-Issue  
**Lösung:**
```bash
sudo supervisorctl restart nextjs
```

### Problem 2: "Cannot connect to MongoDB"
**Ursache:** MongoDB nicht gestartet  
**Lösung:**
```bash
sudo supervisorctl restart mongodb
sleep 3
sudo supervisorctl restart nextjs
```

### Problem 3: "MSSQL connection failed"
**Ursache:** Firewall oder falsche Credentials  
**Lösung:**
1. Prüfe `/app/.env` → MSSQL_* Variablen
2. Teste Verbindung:
```bash
curl http://localhost:3000/api/jtl/sales/date-range
```
Falls Fehler: Kontaktiere Admin für JTL-Credentials

### Problem 4: "Google Search API 400 Bad Request"
**Ursache:** API Key oder Engine ID falsch  
**Lösung:**
1. Gehe zu: https://programmablesearchengine.google.com/
2. Kopiere Engine ID: `0146da4031f5e42a3` (GENAU SO!)
3. Update `.env` wenn nötig
4. Restart: `sudo supervisorctl restart nextjs`

---

## 📊 Schritt 7: Dashboard prüfen

```bash
# Screenshot vom Dashboard
curl http://localhost:3000/ > /dev/null

# Öffne im Browser:
# http://localhost:3000
```

**Erwartete Sections:**
1. ✅ Sales Dashboard (JTL-Wawi)
2. ✅ Analytics (GA4)
3. ✅ Kaltakquise (mit DACH-Crawler Tab)
4. ✅ Warmakquise
5. ✅ Marketing (Glossar)

---

## 🔐 Wichtige Sicherheits-Hinweise

1. **NIEMALS `.env` in Git committen!**
2. **NIEMALS API Keys im Code hardcoden!**
3. **MSSQL-Credentials sind produktiv!** → Vorsicht bei Writes
4. **MongoDB ist lokal** → Daten gehen bei Neustart verloren (außer persistiert)

---

## 📝 Best Practices für neue Agents

### 1. Lies immer zuerst die Wissensdatenbanken:
- `/app/JTL_API_KNOWLEDGE.md` → JTL-Wawi Schema & Queries
- `/app/DEPLOYMENT_GUIDE.md` → Deployment-Details
- `/app/SCHEMA_MONITORING.md` → Schema-Validierung
- `/app/ROBUSTNESS_GUARANTEE.md` → Fehlerbehandlung
- `/app/KALTAKQUISE_ANLEITUNG.md` → Kaltakquise-System

### 2. Teste IMMER nach Änderungen:
```bash
# JTL-APIs
curl http://localhost:3000/api/jtl/sales/kpi?from=2025-11-01&to=2025-11-10

# Analytics
curl http://localhost:3000/api/analytics/metrics?startDate=7daysAgo&endDate=today

# DACH-Crawler
curl -X POST http://localhost:3000/api/coldleads/dach/crawl \
  -H "Content-Type: application/json" \
  -d '{"country":"DE","region":"Bayern","industry":"Metallverarbeitung","limit":5}'
```

### 3. Memory-Management:
- Node.js Memory-Limit: **1024MB** (in package.json)
- Bei Memory-Warnings: `sudo supervisorctl restart nextjs`
- Für langsame Queries: Caching nutzen (siehe JTL_API_KNOWLEDGE.md)

### 4. Fehlerbehandlung:
- Alle APIs haben `ok: true/false` Response
- Bei `ok: false` → Prüfe `error` Feld
- Logs: `tail -f /var/log/supervisor/nextjs.out.log`

---

## 🎯 Schnell-Referenz

| Task | Command |
|------|---------|
| Server Status | `sudo supervisorctl status` |
| Server Restart | `sudo supervisorctl restart all` |
| Logs anzeigen | `tail -f /var/log/supervisor/nextjs.out.log` |
| MongoDB Shell | `mongosh mongodb://localhost:27017/score_zentrale` |
| Health-Check | `curl http://localhost:3000/api/health/schema` |
| .env prüfen | `cat /app/.env \| grep -v "^#"` |

---

## 🆘 Support

Falls nach dieser Checkliste noch Probleme bestehen:

1. Prüfe **alle** Logs:
   ```bash
   tail -n 200 /var/log/supervisor/nextjs.out.log
   ```

2. Validiere Schema:
   ```bash
   curl http://localhost:3000/api/health/schema
   ```

3. Teste einzelne APIs isoliert (siehe Schritt 3)

4. Konsultiere Wissensdatenbanken (siehe Schritt 4)

---

**Version:** 1.0  
**Für:** Alle geforkten Score Zentrale Instanzen  
**Zuletzt aktualisiert:** 10.11.2025
