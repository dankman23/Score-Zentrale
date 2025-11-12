# 🚀 DEPLOYMENT GUIDE - Score Zentrale v3.0

**Für Production Deployment**  
**Version:** 3.0  
**Datum:** 12.11.2025

---

## 📋 Pre-Deployment Checklist

### ✅ Anforderungen

**Server:**
- [ ] Ubuntu 20.04+ oder Debian 11+
- [ ] Min. 4GB RAM (empfohlen: 8GB für große Artikel-Imports)
- [ ] Min. 2 CPU Cores
- [ ] 20GB Disk Space

**Software:**
- [ ] Node.js 20+
- [ ] MongoDB 7.0+
- [ ] MS SQL Server Zugang (JTL-Wawi, Read-Only ausreichend)
- [ ] Supervisor (für Process Management)

**Netzwerk:**
- [ ] JTL-Wawi SQL Server erreichbar (Port 1433)
- [ ] MongoDB erreichbar (Port 27017)
- [ ] Outbound SMTP (Port 465/587)
- [ ] Internet-Zugang (Google APIs, Jina.ai)

---

## 🔧 Installation

### 1. Repository klonen
```bash
git clone <your-repo-url> /app
cd /app
```

### 2. Dependencies installieren
```bash
yarn install
```

### 3. Environment Variables
```bash
cp .env.example .env
nano .env  # Pflichtfelder ausfüllen
```

**Pflicht-Felder:**
```bash
MONGO_URL=mongodb://localhost:27017/score_zentrale
MSSQL_HOST=ihre-jtl-server-ip
MSSQL_USER=sa
MSSQL_PASSWORD=...
MSSQL_DATABASE=eazybusiness
SMTP_HOST=smtp.ihreprovider.de
SMTP_USER=ihre@email.de
SMTP_PASS=...
GOOGLE_SEARCH_ENGINE_ID=...
GOOGLE_SEARCH_API_KEY=...
```

### 4. MongoDB Setup
```bash
# Starten
sudo systemctl start mongod
sudo systemctl enable mongod

# Collections erstellen
mongosh score_zentrale << EOFMONGO
db.createCollection('prospects')
db.createCollection('articles')
db.createCollection('preisformeln')
db.createCollection('g2_configs')
db.createCollection('autopilot_state')

# Indizes für Performance
db.articles.createIndex({ kArtikel: 1 }, { unique: true })
db.articles.createIndex({ cArtNr: 1 })
db.articles.createIndex({ cHerstellerName: 1 })
db.articles.createIndex({ cWarengruppenName: 1 })
db.prospects.createIndex({ website: 1 }, { unique: true })
EOFMONGO
```

### 5. Supervisor Configuration
```bash
# Next.js Service
cat > /etc/supervisor/conf.d/nextjs.conf << EOFSUP
[program:nextjs]
command=/usr/bin/node /bin/yarn dev
directory=/app
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/nextjs.out.log
user=root
environment=NODE_ENV="production"
EOFSUP

# JTL-Import Service (optional, bei Bedarf)
cat > /etc/supervisor/conf.d/jtl-import.conf << EOFSUP2
[program:jtl-import]
command=/usr/bin/node /app/scripts/cursor-import-small.js
directory=/app
autostart=false
autorestart=true
startretries=999
redirect_stderr=true
stdout_logfile=/var/log/supervisor/jtl-import.log
user=root
EOFSUP2

# Reload Supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start nextjs
```

---

## 📦 Artikel-Import (Erstmalig)

### Option A: Via Supervisor (empfohlen)
```bash
sudo supervisorctl start jtl-import
sudo supervisorctl tail -f jtl-import
```

### Option B: Manuell
```bash
node /app/scripts/cursor-import-small.js
```

**Dauer:** ~1-2 Stunden für 166.855 Artikel  
**Batch-Größe:** 1000 Artikel  
**Methode:** Cursor-basiert (WHERE kArtikel > lastKArtikel)

**Fortschritt überwachen:**
```bash
# Via API
curl http://localhost:3000/api/jtl/articles/import/status

# Via MongoDB
mongosh score_zentrale --eval "db.articles.countDocuments()"
```

---

## 🔒 Security Best Practices

### 1. Credentials absichern
```bash
chmod 600 /app/.env
chown root:root /app/.env
```

### 2. MongoDB Authentication aktivieren
```bash
# /etc/mongod.conf
security:
  authorization: enabled

# User erstellen
mongosh admin
db.createUser({
  user: "score_admin",
  pwd: "SecurePassword123!",
  roles: [{role: "readWrite", db: "score_zentrale"}]
})
```

### 3. Firewall konfigurieren
```bash
# Nur localhost für MongoDB
sudo ufw allow from 127.0.0.1 to any port 27017

# Next.js Port (nur intern oder via Reverse Proxy)
sudo ufw allow 3000
```

### 4. HTTPS mit Nginx (Production)
```nginx
server {
    listen 443 ssl http2;
    server_name score-zentrale.ihredomain.de;

    ssl_certificate /etc/letsencrypt/live/ihredomain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ihredomain.de/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📊 Monitoring

### Supervisor Status
```bash
sudo supervisorctl status
```

### Logs ansehen
```bash
sudo supervisorctl tail -f nextjs
sudo supervisorctl tail -f jtl-import
```

### Performance Monitoring
```bash
# MongoDB Stats
mongosh score_zentrale --eval "db.stats()"

# Disk Usage
df -h

# Memory
free -h

# CPU
top
```

---

## 🔄 Updates & Wartung

### Code Updates
```bash
cd /app
git pull
yarn install  # Falls neue Dependencies
sudo supervisorctl restart nextjs
```

### Datenbank-Wartung
```bash
# Verwaiste Artikel prüfen (nach JTL-Updates)
curl http://localhost:3000/api/jtl/articles/import/orphaned

# Alte Logs löschen
mongosh score_zentrale
db.prospects.deleteMany({ created_at: { $lt: new Date('2024-01-01') } })
```

### Backup
```bash
# MongoDB Backup
mongodump --db score_zentrale --out /backup/score_$(date +%Y%m%d)

# .env Backup
cp /app/.env /backup/.env.$(date +%Y%m%d)
```

---

## 🆘 Emergency Procedures

### App läuft nicht
```bash
sudo supervisorctl status nextjs
sudo supervisorctl restart nextjs
tail -100 /var/log/supervisor/nextjs.out.log
```

### MongoDB Verbindungsprobleme
```bash
sudo systemctl status mongod
sudo systemctl restart mongod
mongosh --eval "db.adminCommand('ping')"
```

### Import hängt
```bash
# Import stoppen
sudo supervisorctl stop jtl-import

# Status prüfen
curl http://localhost:3000/api/jtl/articles/import/status

# Neu starten
sudo supervisorctl start jtl-import
```

---

## 📞 Support Kontakte

**Technischer Support:**
- Logs prüfen: `/var/log/supervisor/`
- MongoDB: `mongosh score_zentrale`
- API testen: `curl http://localhost:3000/api/...`

**Dokumentation:**
- README.md - Feature-Übersicht
- FORK_READY_GUIDE.md - Setup & Testing
- JTL_API_KNOWLEDGE.md - Datenbank-Schema

---

**Deployment erfolgreich? Viel Erfolg mit Score Zentrale v3.0! 🎉**
