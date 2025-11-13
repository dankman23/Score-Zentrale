# FIBU-Modul - Automatisierte Buchhaltung

## Überblick

Das FIBU-Modul (Finanzbuchhaltung) ist ein vollautomatisiertes System zur Verarbeitung von Lieferantenrechnungen (EK-Rechnungen) und deren Zuordnung zu Zahlungen. Es kombiniert spezialisierte Python-Parser mit KI-basiertem PDF-Parsing durch Gemini AI.

### Hauptfunktionen

- ✅ **Automatische Email-Verarbeitung**: IMAP-basierte Inbox überwacht eingehende Rechnungen
- ✅ **Hybrid PDF-Parsing**: Kombiniert Template-basierte Python-Parser mit Gemini AI
- ✅ **Auto-Matching**: Intelligente Zuordnung von Zahlungen zu Rechnungen
- ✅ **JTL-Integration**: Import von Verkaufsrechnungen und Zahlungstransaktionen
- ✅ **10it-Export**: Ausgabe für Buchhaltungssoftware
- ✅ **Bank-Import**: CSV-Import für Postbank-Kontoauszüge

## Architektur

### System-Komponenten

```
┌─────────────────────────────────────────────────────────────┐
│                    FIBU-Modul Architektur                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Email Inbox  │───▶│ PDF Parser   │───▶│  MongoDB     │  │
│  │   (IMAP)     │    │   Hybrid     │    │  Database    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         │            ┌───────┴─────────┐         │          │
│         │            │                 │         │          │
│         │     ┌──────▼──────┐  ┌──────▼──────┐  │          │
│         │     │   Python    │  │   Gemini    │  │          │
│         │     │   Parsers   │  │     AI      │  │          │
│         │     └─────────────┘  └─────────────┘  │          │
│         │                                        │          │
│  ┌──────▼────────────────────────────────────────▼──────┐  │
│  │              Auto-Matching Engine                     │  │
│  │   (Score-basierte Zahlung-zu-Rechnung-Zuordnung)     │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                               │
│                     ┌────────▼────────┐                     │
│                     │  10it Export    │                     │
│                     │  API Endpoints  │                     │
│                     └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Datenfluss

1. **Eingang**: Email mit PDF-Rechnung kommt an
2. **Speicherung**: PDF wird in `fibu_email_inbox` Collection gespeichert
3. **Parsing**: 
   - Schritt 1: Python-Parser prüft bekannte Lieferanten (Klingspor, Pferd, VSM, Starcke, etc.)
   - Schritt 2: Bei unbekannten Lieferanten → Gemini AI
4. **Strukturierung**: Extrahierte Daten in `fibu_ek_rechnungen` Collection
5. **Matching**: Auto-Matching-Engine ordnet Zahlungen zu
6. **Export**: Daten für 10it Buchhaltungssoftware bereit

## Technologie-Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Next.js API Routes
- **PDF-Parsing**: 
  - Python 3 mit `pdfplumber`, `pandas`
  - Emergent Gemini 2.0 Flash

### Frontend
- **Framework**: React + Next.js
- **UI**: Tailwind CSS + shadcn/ui
- **State**: React Hooks

### Datenbanken
- **MongoDB**: Hauptdatenbank (FIBU-Daten, Emails, Kreditoren)
- **MS SQL**: JTL-ERP-Datenbank (read-only)

### Externe Integrationen
- **Email**: IMAP-Server für automatischen Empfang
- **JTL**: MS SQL Verbindung für Verkaufsrechnungen und Zahlungen
- **Gemini AI**: Über Emergent Universal Key
- **Bank**: Postbank CSV-Import

## Installation & Setup

### Voraussetzungen

```bash
# Node.js & Python
node --version  # v20.x oder höher
python3 --version  # v3.9 oder höher

# MongoDB
mongosh --version  # MongoDB Shell

# MS SQL Tools (für JTL)
# sqlcmd oder entsprechende Node.js Pakete
```

### Abhängigkeiten installieren

```bash
# Node.js Dependencies
cd /app
yarn install

# Python Dependencies
pip3 install pdfplumber pandas emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

### Umgebungsvariablen

Datei: `/app/.env`

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017/score_zentrale

# MS SQL (JTL)
DB_SERVER=your-sql-server
DB_DATABASE=eazybusiness
DB_USER=your-username
DB_PASSWORD=your-password

# Email (für Inbox-Polling)
IMAP_HOST=imap.your-provider.com
IMAP_PORT=993
IMAP_USER=invoices@your-domain.com
IMAP_PASSWORD=your-password
IMAP_FOLDER=INBOX

# Emergent Universal Key (für Gemini)
GOOGLE_API_KEY=sk-emergent-xxxxx
EMERGENT_LLM_KEY=sk-emergent-xxxxx

# Next.js
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Server starten

```bash
# Entwicklung
sudo supervisorctl restart nextjs

# Oder manuell
cd /app
yarn dev
```

## Verwendung

### 1. PDF-Batch-Processing

**Alle PDFs mit Hybrid-Ansatz verarbeiten:**

```bash
cd /app
node scripts/batch-process-with-gemini-fallback.js 200
```

**Nur mit Python-Parsern:**

```bash
node scripts/batch-process-pdfs-with-python.js 200
```

**Nur mit Gemini AI:**

```bash
node scripts/batch-gemini-only.js 50
```

### 2. Auto-Matching ausführen

**Via API:**

```bash
curl -X POST http://localhost:3000/api/fibu/auto-match-ek-zahlungen
```

**Via UI:**

Öffne: `http://localhost:3000/fibu/ek-manager` → Klick auf "Auto-Match starten"

### 3. Daten abfragen

**EK-Rechnungen:**

```bash
curl "http://localhost:3000/api/fibu/rechnungen/ek?from=2025-10-01&to=2025-11-13"
```

**Zahlungen:**

```bash
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-10-01&to=2025-11-13"
```

**10it-Export:**

```bash
curl "http://localhost:3000/api/fibu/export/10it?from=2025-10-01&to=2025-11-13" > export.csv
```

## Datenbank-Schema

### Collection: `fibu_email_inbox`

Speichert eingehende Emails mit PDF-Anhängen.

```javascript
{
  _id: "uuid",
  emailFrom: "supplier@example.com",
  subject: "Rechnung 123456",
  bodyText: "Email body...",
  filename: "Rechnung_123456.pdf",
  pdfBase64: "JVBERi0xLjQ...",  // Base64-encoded PDF
  receivedDate: ISODate("2025-11-01T10:00:00Z"),
  status: "pending" | "processed" | "error",
  processedAt: ISODate("2025-11-01T10:05:00Z"),
  rechnungId: "uuid"  // Reference to fibu_ek_rechnungen
}
```

### Collection: `fibu_ek_rechnungen`

Geparste Lieferantenrechnungen.

```javascript
{
  _id: "uuid",
  lieferantName: "KLINGSPOR Schleifsysteme GmbH",
  rechnungsNummer: "59428710",
  rechnungsdatum: ISODate("2025-10-06"),
  gesamtBetrag: 2191.15,      // Brutto
  nettoBetrag: 1841.30,       // Netto
  steuerBetrag: 349.85,
  steuersatz: 19,
  kreditorKonto: "70004",      // Kreditorennummer
  aufwandskonto: "5200",       // Standard-Aufwandskonto
  sourceEmailId: "uuid",       // Reference to email
  parsing: {
    method: "python-klingspor-parser" | "emergent-gemini",
    confidence: 95,
    parsedAt: ISODate("2025-11-01T10:05:00Z")
  },
  needsManualReview: false,
  zahlungId: "uuid",           // Optional: Zugeordnete Zahlung
  created_at: ISODate("2025-11-01T10:05:00Z"),
  updated_at: ISODate("2025-11-01T10:10:00Z")
}
```

### Collection: `kreditoren`

Lieferanten-Stammdaten.

```javascript
{
  _id: "uuid",
  kreditorenNummer: "70004",
  name: "KLINGSPOR Schleifsysteme GmbH & Co. KG",
  strasse: "Hüttenstraße 36",
  plz: "41749",
  ort: "Viersen",
  land: "Deutschland",
  standardAufwandskonto: "5200",
  ustIdNr: "DE123456789",
  created_at: ISODate("2025-10-01T00:00:00Z")
}
```

## Python-Parser

### Verfügbare Parser

Das System enthält spezialisierte Parser für häufige Lieferanten:

1. **Klingspor** (`invoice_klingspor.py`)
2. **Pferd/Rüggeberg** (`invoice_pferd.py`)
3. **VSM** (`invoice_vsm.py`)
4. **Starcke** (`invoice_starcke.py`)
5. **Norton** (`invoice_norton.py`)
6. **Rhodius** (`invoice_rhodius.py`)
7. **Awuko** (`invoice_awuko.py`)
8. **Bosch** (`invoice_bosch.py`)
9. **Plastimex** (`invoice_plastimex.py`)

### Parser-Struktur

Alle Parser erben von `BaseParser`:

```python
from parsers.base_parser import BaseParser
import pdfplumber
import pandas as pd

class InvoiceKlingsporParser(BaseParser):
    def parse(self, pdf_path: str) -> tuple[pd.DataFrame, str]:
        with pdfplumber.open(pdf_path) as pdf:
            # Extrahiere Text
            text = ""
            for page in pdf.pages:
                text += page.extract_text()
            
            # Parse Rechnungsnummer
            rechnungsnr = self._extract_invoice_number(text)
            
            # Parse Positionen
            items = self._extract_items(pdf)
            
            # Erstelle DataFrame
            df = pd.DataFrame(items)
            
            return df, rechnungsnr
```

### Neuen Parser hinzufügen

1. **Erstelle neue Parser-Datei:**

```bash
touch /app/python_libs/invoice_parsers/parsers/rechnung_parser/invoice_neuerlieferant.py
```

2. **Implementiere Parser-Klasse:**

```python
from parsers.base_parser import BaseParser
import pdfplumber

class InvoiceNeuerLieferantParser(BaseParser):
    def parse(self, pdf_path: str):
        # Implementierung
        pass
```

3. **Registriere in `fibu_invoice_parser.py`:**

```python
from parsers.rechnung_parser.invoice_neuerlieferant import InvoiceNeuerLieferantParser

PARSER_REGISTRY = {
    # ... existing parsers
    "neuerlieferant": InvoiceNeuerLieferantParser,
}
```

## Gemini AI-Parsing

### Funktionsweise

Für unbekannte Lieferanten wird Gemini 2.0 Flash verwendet:

1. **PDF-Upload**: PDF wird an Gemini gesendet
2. **Prompt**: Strukturierter Prompt für deutsche Rechnungen
3. **JSON-Response**: Gemini gibt strukturierte Daten zurück
4. **Validierung**: Beträge und Datumsformate werden überprüft

### Kosten

- **Model**: Gemini 2.0 Flash (über Emergent Universal Key)
- **Preis**: ~0,03€ pro Rechnung
- **Beispiel**: 145 Rechnungen = 4,35€

### Konfiguration

```javascript
// In emergent_gemini_parser.py
const chat = LlmChat(
    api_key=EMERGENT_LLM_KEY,
    session_id=f"invoice-parse-{os.urandom(4).hex()}",
    system_message="Du bist ein Experte für deutsche Buchhaltung."
).with_model("gemini", "gemini-2.0-flash")
```

## Auto-Matching-Algorithmus

### Matching-Logik

Der Algorithmus ordnet negative Zahlungen (Zahlungsausgänge) automatisch Lieferantenrechnungen zu.

#### Matching-Score-Berechnung:

```javascript
Score = 0

// 1. Betragsübereinstimmung (max 60 Punkte)
if (abs(zahlung.betrag + rechnung.gesamtBetrag) < 0.01) {
  Score += 60  // Exakte Übereinstimmung
} else if (abs(zahlung.betrag + rechnung.gesamtBetrag) < 5) {
  Score += 40  // Kleine Differenz
}

// 2. Datum-Nähe (max 20 Punkte)
daysDiff = abs(zahlung.datum - rechnung.rechnungsdatum)
if (daysDiff <= 3) Score += 20
else if (daysDiff <= 7) Score += 15
else if (daysDiff <= 14) Score += 10
else if (daysDiff <= 30) Score += 5

// 3. Rechnungsnummer im Hinweis (20 Punkte)
if (zahlung.hinweis.includes(rechnung.rechnungsNummer)) {
  Score += 20
}

// Match ab Score >= 70
```

### Beispiel-Matches:

```
✓ PayPal -84.46€ → Score Schleifwerkzeuge 84.46€ (Score: 80)
✓ Commerzbank -647.86€ → Score Schleifwerkzeuge 661.09€ (Score: 80)
✓ PayPal -1.61€ → Score Schleifwerkzeuge 1.61€ (Score: 80)
```

## Performance & Statistiken

### Aktuelle Zahlen (Stand: 13.11.2025)

| Metrik | Wert |
|--------|------|
| **Total EK-Rechnungen** | 365 |
| **Mit Betrag > 0** | 197 (54.0%) |
| **Mit Kreditor zugeordnet** | 78 (21.4%) |
| **Gesamt-Betrag extrahiert** | 108.005,79€ |
| **Python-geparst** | 50 |
| **Gemini-geparst** | 145 |
| **Auto-Match-Rate** | 12.2% (57 von 466) |

### Parsing-Geschwindigkeit

- **Python-Parser**: 0,5-1 Sekunde/PDF
- **Gemini AI**: 3-5 Sekunden/PDF
- **Batch-Processing**: ~200 PDFs in 8-10 Minuten

### Erfolgsraten

- **Bekannte Lieferanten (Python)**: ~96% Erfolgsrate
- **Unbekannte Lieferanten (Gemini)**: ~90% Erfolgsrate
- **Gesamt (Hybrid)**: ~93% Erfolgsrate

## Troubleshooting

### Problem: PDFs werden nicht verarbeitet

**Check 1: Email-Inbox Status**

```bash
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_email_inbox.find({ status: 'pending' }).count()
"
```

**Check 2: Python-Parser funktioniert**

```bash
echo '{"pdf_base64":"test","filename":"test.pdf"}' | python3 /app/python_libs/fibu_invoice_parser.py
```

**Check 3: Gemini API-Key**

```bash
env | grep GOOGLE_API_KEY
```

### Problem: Auto-Matching findet keine Matches

**Check 1: Rechnungen haben Beträge**

```bash
mongosh mongodb://localhost:27017/score_zentrale --eval "
  db.fibu_ek_rechnungen.countDocuments({ gesamtBetrag: { \$gt: 0 } })
"
```

**Check 2: Zahlungen vorhanden**

```bash
curl "http://localhost:3000/api/fibu/zahlungen?from=2025-10-01&limit=10"
```

### Problem: Server startet nicht

**Check Logs:**

```bash
tail -f /var/log/supervisor/nextjs.out.log
tail -f /var/log/supervisor/nextjs.err.log
```

**Neustart:**

```bash
sudo supervisorctl restart nextjs
```

## API-Dokumentation

Siehe: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## Entwicklung

### Code-Struktur

```
/app
├── app/
│   ├── api/fibu/              # API Routes
│   │   ├── rechnungen/
│   │   │   ├── ek/           # EK-Rechnungen
│   │   │   ├── vk/           # VK-Rechnungen (JTL)
│   │   │   └── extern/       # Externe Rechnungen
│   │   ├── zahlungen/        # Zahlungen (JTL)
│   │   ├── auto-match-ek-zahlungen/  # Matching
│   │   ├── email-inbox/      # Email Status
│   │   └── export/10it/      # Export
│   ├── fibu/
│   │   └── ek-manager/       # UI für EK-Manager
│   └── lib/
│       ├── db/
│       │   ├── mongodb.ts    # MongoDB Connection
│       │   └── mssql.ts      # MS SQL (JTL) Connection
│       └── gemini.ts         # Gemini Integration (alt)
├── components/
│   ├── EKRechnungenManager.js  # UI Component
│   └── FibuDashboard.js        # Dashboard Component
├── python_libs/
│   ├── invoice_parsers/      # Python Parser Library
│   │   ├── parsers/
│   │   │   ├── base_parser.py
│   │   │   └── rechnung_parser/
│   │   ├── file_handlers/
│   │   └── helpers/
│   ├── fibu_invoice_parser.py      # FIBU Wrapper
│   └── emergent_gemini_parser.py   # Gemini Integration
└── scripts/
    ├── batch-process-pdfs-with-python.js
    ├── batch-process-with-gemini-fallback.js
    ├── batch-gemini-only.js
    ├── import-kreditoren.js
    └── explore-jtl-payments.js
```

### Tests ausführen

```bash
# API-Tests
curl -X GET http://localhost:3000/api/fibu/rechnungen/ek?limit=5

# Batch-Processing Test
node scripts/batch-process-with-gemini-fallback.js 3 --dry-run

# Auto-Matching Test
curl -X POST http://localhost:3000/api/fibu/auto-match-ek-zahlungen
```

## Roadmap

### Kurzfristig (Q4 2025)
- [ ] Dashboard-UI vervollständigen
- [ ] Bulk-Edit für manuelle Kreditor-Zuordnung
- [ ] Email-Cron-Job automatisieren
- [ ] Mehr Python-Parser für häufige Lieferanten

### Mittelfristig (Q1 2026)
- [ ] Webhook für Echtzeit-Verarbeitung
- [ ] Benachrichtigungen bei neuen Rechnungen
- [ ] OCR für gescannte PDFs
- [ ] Export für weitere Buchhaltungssysteme

### Langfristig (Q2 2026+)
- [ ] Machine Learning für besseres Matching
- [ ] Automatische Duplikat-Erkennung
- [ ] Integration mit mehr ERP-Systemen
- [ ] Mobile App

## Support & Kontakt

Bei Fragen oder Problemen:

1. **Dokumentation prüfen**: Diese README und API-Doku
2. **Logs checken**: `/var/log/supervisor/nextjs*.log`
3. **MongoDB prüfen**: `mongosh mongodb://localhost:27017/score_zentrale`

## Lizenz

Internes Projekt - Score Schleifwerkzeuge

## Changelog

### Version 1.0.0 (November 2025)
- ✅ Initiale Implementierung
- ✅ Python-Parser-Integration
- ✅ Emergent Gemini AI-Integration
- ✅ Auto-Matching-Algorithmus
- ✅ JTL-Integration
- ✅ 10it-Export
- ✅ Batch-Processing-Scripts
- ✅ 365 Rechnungen verarbeitet
- ✅ 108.005,79€ extrahiert
