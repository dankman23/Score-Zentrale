# Setup Guide - SCORE Zentrale

## 📋 Voraussetzungen

### System Requirements
- **OS**: Linux (Ubuntu 20.04+) oder macOS
- **RAM**: Minimum 4GB, Empfohlen 8GB+
- **Disk**: Minimum 10GB freier Speicher

### Software Requirements
- **Node.js**: 20.x oder höher
- **Yarn**: 1.22.x
- **Python**: 3.10 oder höher
- **MongoDB**: 7.0 oder höher
- **MS SQL Server**: 2019+ (für JTL-Integration)

## 🚀 Schritt-für-Schritt Installation

### 1. System-Dependencies installieren

#### Ubuntu/Debian
```bash
# Node.js & Yarn
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g yarn

# Python
sudo apt-get install -y python3.10 python3-pip

# MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### macOS
```bash
# Homebrew installieren (falls nicht vorhanden)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Dependencies
brew install node
brew install yarn
brew install python@3.10
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

### 2. Repository klonen & Setup

```bash
# Klonen
git clone <your-fork-url>
cd app

# Node Dependencies
yarn install

# Python Dependencies
pip3 install -r requirements.txt
```

### 3. Environment Configuration

```bash
# .env Datei erstellen
cp .env.example .env
```

Bearbeite `.env`:

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017

# MS SQL Server (JTL)
MSSQL_SERVER=your-jtl-server.com
MSSQL_DATABASE=eazybusiness
MSSQL_USER=your-username
MSSQL_PASSWORD=your-password
MSSQL_PORT=1433
MSSQL_ENCRYPT=true

# Emergent LLM Key (für Gemini AI)
EMERGENT_LLM_KEY=sk-emergent-YOUR-KEY-HERE

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. MongoDB Database Setup

```bash
# MongoDB Shell öffnen
mongosh

# Database erstellen
use score_zentrale

# Test Collection erstellen
db.test.insertOne({status: "ready"})

# Verlassen
exit
```

### 5. FIBU Initial Setup (Optional aber empfohlen)

```bash
# Debitor-Sammelkonten einrichten
node scripts/setup-debitor-sammelkonten.js

# Wenn bereits VK-Rechnungen vorhanden:
node scripts/apply-debitor-regeln.js
```

### 6. Development Server starten

```bash
# Starten
yarn dev

# Server läuft auf:
# http://localhost:3000
```

## 🔧 Production Setup (mit Supervisor)

### Supervisor Installation

```bash
sudo apt-get install -y supervisor
```

### Supervisor Config

Erstelle `/etc/supervisor/conf.d/nextjs.conf`:

```ini
[program:nextjs]
command=/usr/bin/yarn start
directory=/app
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/nextjs.err.log
stdout_logfile=/var/log/supervisor/nextjs.out.log
user=www-data
environment=NODE_ENV="production"
```

```bash
# Build für Production
yarn build

# Supervisor reload
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start nextjs
```

## 🧪 Verify Installation

```bash
# 1. MongoDB Check
mongosh --eval "db.version()"

# 2. Node Check
node --version  # Should be 20.x+

# 3. Python Check
python3 --version  # Should be 3.10+

# 4. Dependencies Check
cd /app
yarn --version
pip3 list | grep emergentintegrations

# 5. Server Check
curl http://localhost:3000
```

## 🔑 Emergent LLM Key Setup

### Key erhalten

1. Gehe zu Emergent Dashboard
2. Profile → Universal Key
3. Kopiere den Key: `sk-emergent-xxxxx`
4. Füge in `.env` ein

### Key Balance prüfen

```bash
node -e "require('./emergent_integrations_manager')().then(d => console.log('Balance:', d.balance))"
```

## 📊 Initial Data Import (Optional)

### VK-Rechnungen aus JTL importieren

```bash
# Siehe docs/FIBU_README.md Abschnitt "VK-Rechnungen Import"
```

### EK-Rechnungen PDFs verarbeiten

```bash
# PDFs in MongoDB Email-Inbox Collection speichern
# Dann batch-processing starten:
node scripts/batch-process-with-gemini-fallback.js
```

## 🐛 Troubleshooting

### MongoDB Connection Error
```bash
# Check MongoDB Status
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod
```

### MS SQL Connection Error
```bash
# Test Connection
node -e "require('./app/lib/db/mssql').getMssqlPool().then(() => console.log('✅ Connected')).catch(e => console.error('❌', e.message))"
```

### Next.js Build Errors
```bash
# Clear Cache
rm -rf .next
yarn build
```

### Python Dependencies Issues
```bash
# Reinstall
pip3 uninstall -y emergentintegrations
pip3 install -r requirements.txt
```

## 📚 Nächste Schritte

1. Siehe [QUICKSTART.md](docs/QUICKSTART.md) für erste Schritte
2. Siehe [FIBU_README.md](docs/FIBU_README.md) für FIBU Setup
3. Siehe [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) für API Nutzung

## 🆘 Support

Bei Problemen:
1. Check Logs: `/var/log/supervisor/nextjs.out.log`
2. MongoDB Logs: `sudo journalctl -u mongod -f`
3. Browser Console für Frontend-Errors
