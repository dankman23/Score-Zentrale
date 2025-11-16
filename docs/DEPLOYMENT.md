# Deployment-Guide - FIBU Modul

## Voraussetzungen

### System
- Ubuntu 20.04+ oder Debian 11+
- Node.js 20.x
- MongoDB 6.0+
- Supervisor (Process Manager)
- Yarn Package Manager

### Externe Services
- JTL-Wawi MSSQL Datenbank (Zugriff erforderlich)

## Installation

### 1. Repository klonen
```bash
git clone [repository-url]
cd app
```

### 2. Dependencies installieren
```bash
# Node.js Dependencies
yarn install

# WICHTIG: NIEMALS npm verwenden! Nur yarn!
```

### 3. Umgebungsvariablen konfigurieren

**Datei:** `/app/.env`

```bash
# MongoDB (Lokal oder Remote)
# KRITISCH: NIEMALS ÄNDERN ohne Grund!
MONGO_URL=mongodb://localhost:27017

# JTL-Wawi SQL Connection
JTL_SQL_HOST=162.55.235.45
JTL_SQL_PORT=49172
JTL_SQL_DATABASE=eazybusiness
JTL_SQL_USER=sellermath
JTL_SQL_PASSWORD=[ihr-passwort]
JTL_SQL_ENCRYPT=false
JTL_SQL_TRUST_CERT=true

# Next.js Public URL
# KRITISCH: NIEMALS ÄNDERN ohne Grund!
NEXT_PUBLIC_BASE_URL=https://[ihre-domain]
```

**⚠️ WICHTIG:** Die Variablen `MONGO_URL` und `NEXT_PUBLIC_BASE_URL` sind für Kubernetes konfiguriert. Nur ändern, wenn Sie wissen was Sie tun!

### 4. MongoDB Setup

```bash
# MongoDB starten (falls lokal)
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Datenbank und Collections anlegen
mongo
> use score_zentrale
> db.createCollection('fibu_zahlungen')
> db.createCollection('fibu_kontenplan')
> db.createCollection('kreditoren')
> db.createCollection('fibu_ek_rechnungen')
> db.createCollection('fibu_bank_transaktionen')
> db.createCollection('fibu_email_inbox')
> exit
```

### 5. Initiale Daten importieren

```bash
# SKR04 Kontenplan importieren (137 Konten)
node scripts/import-kontenplan-skr04.js
# Erwartete Ausgabe: "✅ 137 Konten importiert"

# Kreditoren importieren (falls CSV vorhanden)
node scripts/import-kreditoren-csv.js
# Erwartete Ausgabe: "✅ [X] Kreditoren importiert"
```

### 6. Build & Start

```bash
# Production Build
yarn build

# Start Next.js
yarn start
# Läuft auf Port 3000
```

## Supervisor Setup (Production)

### 1. Supervisor installieren
```bash
sudo apt-get install supervisor
```

### 2. Konfiguration erstellen

**Datei:** `/etc/supervisor/conf.d/nextjs.conf`

```ini
[program:nextjs]
command=/usr/bin/yarn start
directory=/app
user=root
autostart=true
autorestart=true
startretries=3
redirect_stderr=true
stdout_logfile=/var/log/supervisor/nextjs.out.log
stderr_logfile=/var/log/supervisor/nextjs.err.log
environment=NODE_ENV="production"
```

### 3. Supervisor neu laden
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start nextjs
```

### 4. Status prüfen
```bash
sudo supervisorctl status nextjs
# Erwartete Ausgabe: "nextjs RUNNING pid [X], uptime 0:00:05"
```

## Kubernetes Deployment (Optional)

### 1. Deployment YAML

**Datei:** `k8s/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fibu-module
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fibu-module
  template:
    metadata:
      labels:
        app: fibu-module
    spec:
      containers:
      - name: nextjs
        image: [your-registry]/fibu-module:latest
        ports:
        - containerPort: 3000
        env:
        - name: MONGO_URL
          valueFrom:
            secretKeyRef:
              name: fibu-secrets
              key: mongo-url
        - name: JTL_SQL_HOST
          valueFrom:
            configMapKeyRef:
              name: fibu-config
              key: jtl-host
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
```

### 2. Service YAML

```yaml
apiVersion: v1
kind: Service
metadata:
  name: fibu-module-service
spec:
  selector:
    app: fibu-module
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

### 3. Ingress YAML

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fibu-module-ingress
spec:
  rules:
  - host: [ihre-domain]
    http:
      paths:
      - path: /fibu
        pathType: Prefix
        backend:
          service:
            name: fibu-module-service
            port:
              number: 3000
      - path: /api/fibu
        pathType: Prefix
        backend:
          service:
            name: fibu-module-service
            port:
              number: 3000
```

## Post-Deployment

### 1. Daten-Integrität prüfen
```bash
node test-critical-data.js
```

**Erwartete Ausgabe:**
```
✅ VK-Rechnungen: [X] vorhanden
✅ Externe Rechnungen: [X] vorhanden
✅ EK-Rechnungen: [X] vorhanden
✅ Zahlungen: [X] vorhanden
✅ Kreditoren: [X] vorhanden
✅ ALLE TESTS BESTANDEN!
```

### 2. API-Endpoints testen
```bash
# Kontenplan
curl https://[domain]/api/fibu/kontenplan | jq '.total'
# Erwartete Ausgabe: 137

# Zahlungen
curl 'https://[domain]/api/fibu/zahlungen?from=2025-01-01&to=2025-12-31&limit=10' | jq '.ok'
# Erwartete Ausgabe: true
```

### 3. Frontend aufrufen
```
https://[ihre-domain]/fibu
```

**Erwartetes Ergebnis:**
- Dashboard lädt ohne Fehler
- Alle Tabs sind klickbar
- Daten werden angezeigt

## Wartung

### Logs überwachen
```bash
# Echtzeit-Logs
tail -f /var/log/supervisor/nextjs.out.log

# Fehler-Logs
tail -f /var/log/supervisor/nextjs.err.log

# Letzte 100 Zeilen
tail -n 100 /var/log/supervisor/nextjs.out.log
```

### Services neustarten
```bash
# Alle Services
sudo supervisorctl restart all

# Nur Next.js (bei Code-Änderungen)
sudo supervisorctl restart nextjs

# Status prüfen
sudo supervisorctl status
```

### Datenbank-Backup
```bash
# MongoDB Dump
mongodump --db score_zentrale --out /backup/mongo/$(date +%Y%m%d)

# Komprimieren
tar -czf /backup/mongo_$(date +%Y%m%d).tar.gz /backup/mongo/$(date +%Y%m%d)
```

### Datenbank-Restore
```bash
# Aus Backup wiederherstellen
mongorestore --db score_zentrale /backup/mongo/[datum]/score_zentrale/
```

## Troubleshooting

### Problem: Next.js startet nicht

**Symptome:**
- `supervisorctl status nextjs` zeigt "FATAL"
- Keine Verbindung zu http://localhost:3000

**Lösung:**
```bash
# Logs prüfen
tail -n 50 /var/log/supervisor/nextjs.err.log

# Häufige Ursachen:
# 1. Dependencies fehlen
cd /app && yarn install

# 2. Port 3000 bereits belegt
lsof -i :3000
kill -9 [PID]

# 3. .env Datei fehlt
cp .env.example .env
# Dann Werte eintragen

# Neustart
sudo supervisorctl restart nextjs
```

### Problem: MongoDB Verbindung fehlgeschlagen

**Symptome:**
- API-Calls geben 500 zurück
- Error: "MongoServerError: connect ECONNREFUSED"

**Lösung:**
```bash
# MongoDB Status prüfen
sudo systemctl status mongodb

# Falls gestoppt:
sudo systemctl start mongodb

# Verbindung testen
mongo --eval "db.stats()"

# MONGO_URL in .env prüfen
cat /app/.env | grep MONGO_URL
```

### Problem: JTL DB Verbindung fehlgeschlagen

**Symptome:**
- VK-Rechnungen laden nicht
- Error: "ConnectionError: Failed to connect to [host]"

**Lösung:**
```bash
# JTL-Zugangsdaten prüfen
cat /app/.env | grep JTL_SQL

# Netzwerk-Verbindung testen
telnet [JTL_HOST] [JTL_PORT]

# Firewall-Regeln prüfen
# JTL MSSQL muss von Server erreichbar sein
```

### Problem: Daten sind verschwunden

**Symptome:**
- Rechnungen/Zahlungen/Konten werden nicht angezeigt
- API gibt leere Arrays zurück

**SOFORT-MASSNAHMEN:**
```bash
# 1. STOP! Keine weiteren Änderungen!

# 2. Test ausführen
node test-critical-data.js

# 3. Wenn ❌ → Rollback aus Backup
mongorestore --db score_zentrale /backup/mongo/[letztes-datum]/

# 4. Siehe /app/docs/CRITICAL_APIS_DO_NOT_BREAK.md
```

### Problem: Frontend zeigt alte Daten

**Ursache:** Server-Side Cache

**Lösung:**
```bash
# Cache invalidieren durch Reload-Parameter
curl 'http://localhost:3000/api/fibu/zahlungen?from=...&reload=true'

# Oder Service neu starten
sudo supervisorctl restart nextjs
```

## Updates & Upgrades

### Dependencies aktualisieren
```bash
# Prüfe veraltete Packages
yarn outdated

# Update (VORSICHTIG!)
yarn upgrade [package-name]

# Nach Update IMMER testen
node test-critical-data.js
yarn build
```

### Next.js Version upgraden
```bash
# Aktuell: Next.js 14.x
# Beim Upgrade auf 15.x beachten:
# - Breaking Changes prüfen
# - API Routes Kompatibilität
# - Middleware Änderungen

yarn upgrade next react react-dom
yarn build
# Test vor Production-Deploy!
```

## Monitoring

### Wichtige Metriken

1. **API Response Times**
   - `/api/fibu/uebersicht/complete`: < 3s
   - `/api/fibu/zahlungen`: < 2s
   - Andere APIs: < 1s

2. **Daten-Mengen**
   - VK-Rechnungen: ~1000 pro Monat
   - Zahlungen: ~500 pro Monat
   - Kreditoren: ~100-200 aktiv
   - Konten: 137 (SKR04)

3. **Fehlerrate**
   - API-Fehler: < 0.1%
   - 500 Errors: 0

### Alerting (Empfohlen)

```bash
# Cronjob für täglichen Daten-Check
# /etc/cron.daily/fibu-health-check

#!/bin/bash
cd /app
node test-critical-data.js

if [ $? -ne 0 ]; then
  echo "FIBU Daten-Test FEHLGESCHLAGEN!" | mail -s "ALARM: FIBU" admin@domain.com
fi
```

## Backup-Strategie

### Täglich
```bash
# MongoDB Dump
0 2 * * * mongodump --db score_zentrale --out /backup/daily/$(date +\%Y\%m\%d)
```

### Wöchentlich
```bash
# Vollständiges Backup inkl. Files
0 3 * * 0 tar -czf /backup/weekly/fibu_$(date +\%Y\%m\%d).tar.gz /app /backup/daily
```

### Aufbewahrung
- Täglich: 7 Tage
- Wöchentlich: 4 Wochen
- Monatlich: 12 Monate

## Rollback-Prozedur

### Bei kritischem Fehler

```bash
# 1. Service stoppen
sudo supervisorctl stop nextjs

# 2. Code zurückrollen
git log --oneline -10
git checkout [commit-hash-vor-fehler]

# 3. Datenbank wiederherstellen (falls nötig)
mongorestore --db score_zentrale --drop /backup/mongo/[datum]/

# 4. Dependencies neu installieren
yarn install

# 5. Build
yarn build

# 6. Service starten
sudo supervisorctl start nextjs

# 7. Test
node test-critical-data.js
```

## Production Checklist

### Vor Go-Live

- [ ] Alle Environment-Variablen konfiguriert
- [ ] MongoDB erreichbar und konfiguriert
- [ ] JTL DB erreichbar und Zugangsdaten korrekt
- [ ] Kontenplan importiert (137 Konten)
- [ ] Kreditoren importiert
- [ ] test-critical-data.js läuft durch (✅)
- [ ] API-Endpoints erreichbar
- [ ] Frontend lädt ohne Fehler
- [ ] SSL-Zertifikat konfiguriert (HTTPS)
- [ ] Backup-Cronjobs eingerichtet
- [ ] Monitoring/Alerting konfiguriert
- [ ] Logs rotieren (logrotate)

### Nach Go-Live

- [ ] Erste Woche täglich: Logs prüfen
- [ ] Performance-Metriken überwachen
- [ ] User-Feedback sammeln
- [ ] Daten-Integrität prüfen

## Häufige Fehler & Lösungen

### "MONGO_URL undefined"
```bash
# .env Datei fehlt oder falsch
cp .env.example .env
# Dann MONGO_URL eintragen
sudo supervisorctl restart nextjs
```

### "Cannot find module 'mssql'"
```bash
# Dependencies nicht installiert
cd /app
yarn install
sudo supervisorctl restart nextjs
```

### "Port 3000 already in use"
```bash
# Prozess finden und beenden
lsof -i :3000
kill -9 [PID]
sudo supervisorctl start nextjs
```

### "API gibt 500 zurück"
```bash
# Logs prüfen
tail -n 50 /var/log/supervisor/nextjs.err.log

# Häufige Ursachen:
# - DB-Verbindung fehlgeschlagen
# - Fehlende Environment-Variable
# - Syntax-Fehler im Code
```

---

**Stand:** Januar 2025  
**Version:** 2.0  
**Autor:** SCORE Zentrale Dev Team
