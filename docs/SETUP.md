# Setup-Anleitung - Score Zentrale

## Systemvoraussetzungen

- **Node.js**: v18.x oder höher
- **Python**: 3.9+
- **MongoDB**: 5.0+
- **MSSQL**: JTL-Datenbank-Zugriff
- **Yarn**: Package Manager

## Installation

### 1. Repository klonen

```bash
cd /app
```

### 2. Dependencies installieren

#### Node.js Dependencies
```bash
cd /app/app
yarn install
```

#### Python Dependencies
```bash
pip install -r /app/requirements.txt
```

Wichtige Python-Pakete:
- `emergentintegrations` (Gemini AI)
- `pymongo` (MongoDB)
- `openpyxl` (Excel-Import)

### 3. Umgebungsvariablen konfigurieren

Datei: `/app/app/.env`

```bash
# MongoDB
MONGO_URL=mongodb://localhost:27017

# MSSQL (JTL)
DB_HOST=localhost
DB_USER=sa
DB_PASSWORD=***
DB_NAME=eazybusiness

# AI Parsing
EMERGENT_LLM_KEY=***

# App URL
NEXT_PUBLIC_BASE_URL=https://ihre-domain.com
```

**Wichtig**: 
- `MONGO_URL` NICHT ändern (ist für lokalen MongoDB konfiguriert)
- `EMERGENT_LLM_KEY` von emergentintegrations holen
- JTL-Zugangsdaten anpassen

### 4. Datenbank-Setup

#### MongoDB Collections erstellen

```bash
mongosh mongodb://localhost:27017/score_zentrale
```

```javascript
// Collections werden automatisch erstellt bei erstem Insert
// Aber Indexes sollten angelegt werden:

db.fibu_zahlungen.createIndex({ uniqueId: 1 }, { unique: true })
db.fibu_zahlungen.createIndex({ zahlungsdatum: 1 })
db.fibu_zahlungen.createIndex({ istZugeordnet: 1 })

db.fibu_vk_rechnungen.createIndex({ kRechnung: 1 }, { unique: true })
db.fibu_vk_rechnungen.createIndex({ rechnungsdatum: 1 })

db.fibu_ek_rechnungen.createIndex({ rechnungsdatum: 1 })
db.fibu_ek_rechnungen.createIndex({ kreditorKonto: 1 })

db.kreditoren.createIndex({ kreditorenNummer: 1 }, { unique: true })
db.kreditoren.createIndex({ iban: 1 })
```

#### Kontenplan importieren

```bash
# SKR04-Konten sind bereits in der DB
# Falls neu aufsetzen:
mongosh mongodb://localhost:27017/score_zentrale < /app/scripts/import-kontenplan.js
```

### 5. Services starten

```bash
# Alle Services (via Supervisor)
sudo supervisorctl restart all

# Oder einzeln:
sudo supervisorctl restart nextjs
sudo supervisorctl restart mongodb
```

### 6. Initiale Daten laden

#### VK-Rechnungen aus JTL laden

```bash
# Erste Ladung dauert ~2 Minuten
curl "http://localhost:3000/api/fibu/rechnungen/vk?from=2025-01-01&to=2025-12-31&limit=10000"
```

#### Zahlungen laden

```bash
# Erste Ladung dauert ~40 Sekunden
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-01-01&to=2025-12-31&reload=true"
```

#### Kreditoren anlegen

```bash
# Manuell über UI: FIBU → Zuordnung → Kreditoren anlegen
# Oder via API:
curl -X POST "http://localhost:3000/api/fibu/kreditoren" \
  -H "Content-Type: application/json" \
  -d '{
    "kreditorenNummer": "70001",
    "name": "Beispiel GmbH",
    "iban": "DE89370400440532013000",
    "standardAufwandskonto": "5200"
  }'
```

### 7. Intelligente Zuordnung initialisieren

#### Fuzzy Matching ausführen

```bash
cd /app/scripts
node fuzzy-match-zahlungen.js 2025-01-01 2025-12-31
```

#### Smart Matching Commerzbank

```bash
node smart-match-commerzbank.js 2025-01-01 2025-12-31
```

#### Sachkonto-Zuordnung

```bash
node auto-assign-sachkonten.js 2025-01-01 2025-12-31
```

## Zugriff

- **Frontend**: http://localhost:3000
- **FIBU-Dashboard**: http://localhost:3000/#/fibu
- **API**: http://localhost:3000/api/*

## Entwicklung

### Dev-Server starten

```bash
cd /app/app
yarn dev
```

### Logs ansehen

```bash
# Next.js Logs
tail -f /var/log/supervisor/nextjs.out.log

# Fehler-Logs
tail -f /var/log/supervisor/nextjs.err.log
```

### Hot Reload

- Frontend: Automatisch bei Dateiänderungen
- Backend API: Automatisch bei .ts/.js Änderungen
- Nur bei .env Änderungen: Server neu starten

## Produktiv-Deployment

### 1. Build erstellen

```bash
cd /app/app
yarn build
```

### 2. Production starten

```bash
yarn start
```

### 3. Umgebungsvariablen prüfen

- `NEXT_PUBLIC_BASE_URL` auf produktive Domain setzen
- `MONGO_URL` prüfen
- `DB_HOST` auf produktive JTL-DB setzen

## Backup

### MongoDB Backup

```bash
# Dump erstellen
mongodump --uri="mongodb://localhost:27017/score_zentrale" --out=/backup/mongo/

# Restore
mongorestore --uri="mongodb://localhost:27017/score_zentrale" /backup/mongo/score_zentrale/
```

### Wichtige Collections:

- `fibu_zahlungen` (~20.000 Dokumente)
- `fibu_vk_rechnungen` (~10.000 Dokumente)
- `fibu_ek_rechnungen` (~1.000 Dokumente)
- `kreditoren` (~100 Dokumente)
- `fibu_zuordnungsregeln` (~50 Dokumente)

## Troubleshooting

Siehe [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

## Updates

### Dependencies aktualisieren

```bash
cd /app/app
yarn upgrade

pip install --upgrade -r /app/requirements.txt
```

### Neue Konten hinzufügen

```javascript
// In MongoDB
db.kontenplan.insertOne({
  kontonummer: '6855',
  bezeichnung: 'Bankgebühren',
  klasse: '6',
  kategorie: 'SKR04'
})
```

---

**Support**: Bei Problemen siehe [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
