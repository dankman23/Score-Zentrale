# Setup-Anleitung - FIBU Accounting Hub

## 👥 Für neue Entwickler

Diese Anleitung hilft Ihnen, das Projekt auf Ihrem lokalen Rechner oder einem neuen Server einzurichten.

## ✅ Voraussetzungen prüfen

### 1. Node.js & Yarn

```bash
# Node.js Version prüfen (sollte 20.x sein)
node --version

# Yarn installieren (falls nicht vorhanden)
npm install -g yarn

# Yarn Version prüfen
yarn --version
```

### 2. MongoDB

```bash
# MongoDB Status prüfen
sudo systemctl status mongodb

# Falls nicht installiert (Ubuntu/Debian):
sudo apt-get install mongodb

# Starten
sudo systemctl start mongodb
```

### 3. MSSQL Server (JTL-Datenbank)

**Wichtig:** Sie benötigen Zugriff auf eine bestehende JTL-Wawi Datenbank!

```bash
# Verbindung testen
sqlcmd -S localhost -U SA -P 'IhrPasswort' -d eazybusiness -Q "SELECT @@VERSION"
```

## 📦 Installation

### Schritt 1: Repository klonen

```bash
# Repository klonen
git clone <your-repo-url>
cd fibu-accounting-hub
```

### Schritt 2: Dependencies installieren

```bash
# Im Projekt-Verzeichnis
cd /app
yarn install
```

Dies installiert alle Abhängigkeiten aus `package.json`:
- Next.js
- React
- MongoDB Driver
- MSSQL Driver
- Tailwind CSS
- Shadcn/ui
- etc.

### Schritt 3: Umgebungsvariablen konfigurieren

```bash
# .env Datei erstellen (falls nicht vorhanden)
cp .env.example .env

# .env bearbeiten
nano .env
```

**Erforderliche Variablen:**

```bash
# MongoDB
MONGO_URL=mongodb://localhost:27017

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# MSSQL (JTL)
MSSQL_SERVER=localhost
MSSQL_DATABASE=eazybusiness
MSSQL_USER=SA
MSSQL_PASSWORD=IhrJTLPasswort
```

### Schritt 4: Datenbank initialisieren

```bash
# Kontenplan importieren (137 SKR04-Konten)
node scripts/import-kontenplan-skr04.js

# Prüfen ob erfolgreich
node scripts/check-kontenplan.js

# Sollte zeigen: "Anzahl: 137"
```

### Schritt 5: Development Server starten

```bash
# Development Mode (mit Hot Reload)
yarn dev

# Server läuft auf http://localhost:3000
```

## 🔗 Zugriff

- **Haupt-Dashboard:** http://localhost:3000
- **FIBU-Modul:** http://localhost:3000/fibu
- **Kontenplan:** http://localhost:3000/fibu (Tab: "Kontenplan + Einstellungen")
- **Zahlungen:** http://localhost:3000/fibu (Tab: "Zahlungen")

## 🔧 Production Setup (mit Supervisor)

### Schritt 1: Supervisor installieren

```bash
sudo apt-get install supervisor
```

### Schritt 2: Supervisor Config erstellen

```bash
sudo nano /etc/supervisor/conf.d/nextjs.conf
```

**Inhalt:**

```ini
[program:nextjs]
command=yarn start
directory=/app
autorestart=true
autostart=true
stdout_logfile=/var/log/supervisor/nextjs.out.log
stderr_logfile=/var/log/supervisor/nextjs.err.log
user=root
environment=NODE_ENV="production"
```

### Schritt 3: Supervisor starten

```bash
# Config neu laden
sudo supervisorctl reread
sudo supervisorctl update

# Service starten
sudo supervisorctl start nextjs

# Status prüfen
sudo supervisorctl status
```

### Schritt 4: Logs überwachen

```bash
# Output Logs
tail -f /var/log/supervisor/nextjs.out.log

# Error Logs
tail -f /var/log/supervisor/nextjs.err.log
```

## 🔑 API-Credentials konfigurieren

### eBay Finances API (optional)

```bash
# .env erweitern
EBAY_CLIENT_ID=your_app_id
EBAY_CLIENT_SECRET=your_cert_id
EBAY_ENVIRONMENT=production
```

**Credentials erhalten:**
1. Gehen Sie zu: https://developer.ebay.com/my/keys
2. Erstellen Sie eine "Production"-App
3. Aktivieren Sie "Finances API" Permission

### PayPal Transaction API (optional)

```bash
# .env erweitern
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_MODE=live
```

**Credentials erhalten:**
1. Gehen Sie zu: https://developer.paypal.com/dashboard
2. Erstellen Sie eine "Live App"
3. Aktivieren Sie "Transaction Search" Permission

### Server neu starten nach .env-Änderungen

```bash
# Mit Supervisor
sudo supervisorctl restart nextjs

# Oder Development
# Ctrl+C und dann: yarn dev
```

## 🧪 Fehlerbehebung

### Problem: MongoDB verbindet nicht

```bash
# Service prüfen
sudo systemctl status mongodb

# Neu starten
sudo systemctl restart mongodb

# Verbindung testen
mongosh mongodb://localhost:27017/fibu
```

### Problem: MSSQL verbindet nicht

```bash
# JTL-DB-Server erreichbar?
ping ihr-jtl-server

# Credentials korrekt in .env?
cat .env | grep MSSQL

# Test-Query
node -e "require('./app/lib/db/mssql').getJTLConnection().then(() => console.log('OK'))"
```

### Problem: Next.js startet nicht

```bash
# Logs checken
tail -100 /var/log/supervisor/nextjs.err.log

# Port 3000 blockiert?
lsof -i :3000

# Kill alter Prozess
kill -9 $(lsof -ti:3000)

# Neu starten
sudo supervisorctl restart nextjs
```

### Problem: Kontenplan ist leer

```bash
# Konten zählen
mongosh mongodb://localhost:27017/fibu --eval "db.fibu_kontenplan.countDocuments()"

# Sollte 137 sein. Falls 0:
node scripts/import-kontenplan-skr04.js
```

## 📋 Checkliste nach Setup

- [ ] Node.js 20.x installiert
- [ ] MongoDB läuft
- [ ] MSSQL-Verbindung zu JTL funktioniert
- [ ] Dependencies installiert (`yarn install`)
- [ ] `.env` konfiguriert
- [ ] Kontenplan importiert (137 Konten)
- [ ] Server startet ohne Fehler
- [ ] http://localhost:3000/fibu erreichbar
- [ ] Zahlungen werden geladen
- [ ] Kontenplan wird angezeigt

## 🚀 Nächste Schritte

1. Lesen Sie [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) für Entwicklungs-Best-Practices
2. Schauen Sie [ARCHITECTURE.md](ARCHITECTURE.md) für technische Details
3. Prüfen Sie [ZAHLUNGEN_MODUL.md](ZAHLUNGEN_MODUL.md) für Zahlungs-Logik

---

**Bei Problemen:** Prüfen Sie immer zuerst die Logs!