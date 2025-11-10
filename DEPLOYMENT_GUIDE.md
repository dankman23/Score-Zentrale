# Score Zentrale - Deployment Guide (Option A: Direct SQL)

## Übersicht
Die Score Zentrale benötigt eine **direkte TCP-Verbindung** zum externen JTL-Wawi MS-SQL-Server.

---

## 1️⃣ Server-Vorbereitung (JTL-SQL-Server)

### 1.1 Read-Only SQL Login anlegen

```sql
-- Als sysadmin auf dem JTL-SQL-Server ausführen:
CREATE LOGIN [score_analytics_ro] WITH PASSWORD = '<STRONG_PASSWORD>';
USE [eazybusiness];
CREATE USER [score_analytics_ro] FOR LOGIN [score_analytics_ro];
EXEC sp_addrolemember 'db_datareader', 'score_analytics_ro';
```

**Hinweis:** Nur **db_datareader** Rechte - kein Schreibzugriff!

### 1.2 TLS/SSL prüfen

- **Empfohlen:** SQL Server mit gültigem SSL-Zertifikat betreiben
- **Fallback:** Self-Signed Zertifikat + `JTL_SQL_TRUST_CERT=true` in .env

### 1.3 Firewall konfigurieren

**Windows Firewall Regel:**
- **Port:** TCP 1433 (eingehend)
- **Quell-IPs:** Nur Emergent Egress IPs
- **Instanz:** Fester Port (kein dynamischer Port/Browser)

**Test:**
```bash
telnet <JTL_SQL_HOST> 1433
# oder
Test-NetConnection -ComputerName <JTL_SQL_HOST> -Port 1433
```

---

## 2️⃣ Environment Variables (Emergent)

In Emergent Dashboard diese Variablen konfigurieren:

```bash
# MongoDB (Emergent Managed)
MONGO_URL=<emergent-mongodb-connection-string>

# App URLs
NEXT_PUBLIC_BASE_URL=https://sales-dashboard-179.preview.emergentagent.com
CORS_ORIGINS=https://sales-dashboard-179.preview.emergentagent.com

# MS SQL (JTL-Wawi) - WICHTIG: Echte Werte einsetzen!
JTL_SQL_HOST=<sql.server.public.ip>
JTL_SQL_PORT=1433
JTL_SQL_USER=score_analytics_ro
JTL_SQL_PASSWORD=<STRONG_PASSWORD>
JTL_SQL_DB=eazybusiness
JTL_SQL_ENCRYPT=true
JTL_SQL_TRUST_CERT=true

# App Verhalten
NEXT_PUBLIC_DEGRADED=0
JTL_SQL_OPTIONAL=0

# Warmakquise Config
INACTIVE_MONTHS=6
MIN_ORDERS=2
MIN_REVENUE=100
WARM_W1=0.4
WARM_W2=0.3
WARM_W3=0.2
WARM_W4=0.1
```

---

## 3️⃣ Deployment

1. **Push to GitHub** (oder gewähltes Repo)
2. **Deploy via Emergent Dashboard**
3. Warten bis Status "Running"

---

## 4️⃣ Health Checks (Post-Deployment)

### Automatisches Healthcheck-Script:
```bash
node healthcheck.js
```

### Manuelle Tests:

**1. SQL Connectivity:**
```bash
curl https://sales-dashboard-179.preview.emergentagent.com/api/jtl/ping
# Erwartung: {"ok":true,"server":"...","hasNPosTyp":false}
```

**2. Orders KPI (Stichtag):**
```bash
curl "https://sales-dashboard-179.preview.emergentagent.com/api/jtl/orders/kpi/shipping-split?from=2025-11-03&to=2025-11-03"
# Erwartung: {"ok":true,"orders":>0,...}
```

**3. Diagnostics:**
```bash
curl "https://sales-dashboard-179.preview.emergentagent.com/api/jtl/orders/diag/day?date=2025-11-03"
# Erwartung: {"ok":true,"totals":{"orders":71,"gross":"7077.67"},...}
```

**4. Expenses:**
```bash
curl "https://sales-dashboard-179.preview.emergentagent.com/api/jtl/purchase/expenses?from=2024-01-01&to=2024-12-31"
# Erwartung: {"ok":true,"invoices":>0,"net":"...","gross":"..."}
```

**5. Margin:**
```bash
curl "https://sales-dashboard-179.preview.emergentagent.com/api/jtl/orders/kpi/margin?from=2025-11-01&to=2025-11-05"
# Erwartung: {"ok":true,"margin_net":"...","cost_source":{...}}
```

**6. Warmakquise Import:**
```bash
curl -X POST https://sales-dashboard-179.preview.emergentagent.com/api/leads/import \
  -H "Content-Type: application/json" \
  -d '{"limit":200}'
# Erwartung: {"ok":true,"imported":>0}
```

---

## 5️⃣ Akzeptanzkriterien

✅ **Alle Healthchecks grün**
✅ **Dashboard lädt ohne "Demo"-Badge**
✅ **Keine 502/404 bei JTL-Endpoints**
✅ **Warmakquise zeigt importierte Leads**
✅ **KPI-Tiles zeigen echte Daten**

---

## 🔒 Sicherheit

- ✅ SQL-Login ist **read-only** (db_datareader)
- ✅ Firewall **nur Emergent IPs**
- ✅ Credentials **nur in .env** (nie in Code)
- ✅ Logs **keine Passwörter** (nur Error-Codes)
- ✅ TLS-Verschlüsselung aktiv

---

## ⚠️ Troubleshooting

### "Connection timeout" / "ETIMEDOUT"
- Firewall prüfen (Port 1433 offen?)
- Telnet-Test von Emergent-Server
- ISP NAT-Probleme? → Option B (Tunnel) erwägen

### TLS-Fehler
- Temporär: `JTL_SQL_TRUST_CERT=true`
- Langfristig: Gültiges CA-Zertifikat auf SQL-Server

### "Login failed"
- Credentials prüfen (.env)
- SQL-Login existiert? (`SELECT name FROM sys.server_principals WHERE name='score_analytics_ro'`)

### Keine Daten / 404
- Tabellen existieren? (Beschaffungs-Module in JTL aktiviert?)
- Zeitraum prüfen (Daten vorhanden?)

---

## 📞 Support

Bei Problemen:
1. Logs prüfen: `kubectl logs <pod-name>`
2. Healthcheck-Output teilen
3. SQL-Verbindung testen (Telnet)

**Kontakt:** [Ihr Support-Kontakt]
