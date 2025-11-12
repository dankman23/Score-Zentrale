# Score Zentrale - Dashboard & Business Intelligence System

**Version:** 3.0 (Preisberechnung g2 + Artikel-Management)
**Letzte Aktualisierung:** 12.11.2025
**Status:** ✅ Produktionsbereit

---

## 🎯 Übersicht

Next.js Dashboard für **Score Schleifwerkzeuge** (Köln) - integriert Sales (JTL-Wawi), Marketing (GA4, Google Ads), Kaltakquise-System V3, und fortgeschrittene Preisberechnung.

---

## ✨ Features

### 1. Sales Dashboard (JTL-Wawi)
- KPIs: Netto/Brutto-Umsatz, Marge
- Multi-Select Filter (Datum, Hersteller, Lieferant, Warengruppe)
- Top 5: Plattformen, Hersteller (mit Margen)
- Sortierbare Tabellen
- Einkaufs-Analyse

### 2. Analytics Dashboard (GA4)
- Info-Seiten Traffic
- Beileger Performance
- Timeseries Metriken
- Page-Level Analytics

### 3. Kaltakquise (Cold Acquisition) - V3 SYSTEM ⭐

#### **Lead-Generierung:**
- Google Custom Search
- DACH-Crawler (systematisch: Land + Region + Branche)
- Blacklist-Filter (keine Verzeichnisse/Schulen)

#### **Analyzer V3:**
- **Multi-Page Crawl:** 7 Seiten (Home, Leistungen, Produkte, Referenzen, Team, Kontakt, Impressum)
- **LLM-Analyse:** OpenAI GPT-4o
- **Glossar-Mapping:** 311 Begriffe
- **Contact Extraction:** Name, Rolle, Email, Telefon (mit Confidence)
- **Brand Matching:** 10 Score-Partner
- **Confidence Score:** 0-100

#### **Emailer V3:**
- **3 Mails generiert:**
  1. Erstansprache (≤180 Wörter)
  2. Follow-up 1 nach 5 Tagen (≤110 Wörter)
  3. Follow-up 2 nach 12 Tagen (≤90 Wörter)
- **Plain Text** (kein Markdown)
- **Personalisiert:** Anrede, Website-Bezug, passende Marken

### 4. Produkte-Verwaltung (JTL-Artikel) ⭐ NEU!
- **Artikel-Import:** 166.855 Artikel aus JTL-Wawi
- **Cursor-basierte Pagination:** Robust & zuverlässig
- **Artikel-Browser:**
  - Text-Suche (Artikelnummer, Name, Barcode)
  - Filter: Hersteller (13), Warengruppen (35)
  - Pagination (25/50/100 pro Seite)
- **Artikel-Präsenz:** ⭐ NEU!
  - In wie vielen Stücklisten?
  - eBay-Angebote
  - Amazon-Angebote
  - Shop-Präsenz
  - Verkaufskanäle (SCX)
- **Preisvergleich:** ⭐ NEU!
  - Wettbewerbspreise crawlen (Amazon, Idealo, eBay)
  - VE-Vergleich (Preis pro Stück)
  - EAN/MPN-basierte Suche
- **Verwaiste Artikel:** Erkennung & Batch-Löschung

### 5. Preisberechnung ⭐⭐ KOMPLETT NEU!

#### **Alte Preisberechnung (7 Warengruppen):**
- Lagerware, Klingspor FL, Abverkauf, Lagerware günstig, Pferd FL, Plastimex FL, Alle Konfektion
- **Formel:** `(c*(ve*x)^a + paypal_fix + fixkosten + ve*x) / (1 - eba - paypal) * (1 + aufschlag%)`
- **Shop-Staffelpreise:** Von rechts nach links mit A.A. Threshold
- **Editierbare Regler:** Live-Speicherung in MongoDB
- **Ausklappbare Konfiguration:** Platz sparen

#### **Neue Preisberechnung (g2):**
- **3 Intervalle:** 
  - I (x ≤ gstart_ek): Wie alte Formel
  - II (gstart < x < gneu): S-Übergang (Smoothstep)
  - III (x ≥ gneu): rNEU * f_alt(x)
- **Warengruppen-basiert:** Nutzt Regler 1a, 2c, 3e von gewählter Warengruppe
- **Artikelspezifisch:** gstart_ek, gneu_ek, gneu_vk, fixcosts, varpcts, shp_fac
- **Test:** EK=10€ (Klingspor) → 27.60€ (identisch mit Alter PB bis gstart)

#### **Vergleichs-Tool:**
- Mehrere Formeln gleichzeitig vergleichen
- g2 vs. Alte Formeln
- **Tabellen:** Plattformpreis + Shop-Staffeln untereinander
- **Liniendiagramm:** X: 0-300€ EK, Y: VK
- Toggle: Plattform / Shop-Staffel

### 6. Glossar-Verwaltung
- 6 Kategorien (311 Begriffe)
- Versions-Management
- PDF-basierte Branchen-Datenbank

---

## 🛠️ Tech-Stack

### **Frontend**
- Next.js 14.2.3
- React 18
- Bootstrap 5 + Score Theme
- Chart.js

### **Backend**
- Next.js API Routes
- Node.js 20
- TypeScript

### **Datenbanken**
- **MongoDB:** Kaltakquise, Artikel, Preisformeln, g2-Configs
- **MS SQL Server:** JTL-Wawi (Read-Only)

### **Integrationen**
- **OpenAI GPT-4o:** LLM-Analyse
- **Jina.ai Reader:** Website-Crawling & Preisvergleich
- **Google Custom Search:** Lead-Generierung & Produktsuche
- **Google Analytics 4:** Web-Analytics
- **Nodemailer (SMTP):** Email-Versand

---

## 📁 Projekt-Struktur

```
/app/
├── app/
│   ├── page.js                 # Haupt-Dashboard (SPA)
│   ├── layout.js               # Layout + Navigation
│   └── api/                    # Backend APIs
│       ├── coldleads/          # Kaltakquise V3
│       ├── jtl/
│       │   ├── articles/       # Artikel-Management
│       │   │   ├── import/     # Import mit Cursor-Pagination
│       │   │   ├── presence/   # Artikel-Präsenz ⭐ NEU
│       │   │   ├── list/       # Browser
│       │   │   └── filters/    # Filter-Optionen
│       │   ├── sales/          # Verkaufs-KPIs
│       │   └── orders/         # Bestellungen
│       ├── preise/             # Preisberechnung ⭐⭐ NEU
│       │   ├── formeln/        # Alte Formeln (7 Warengruppen)
│       │   ├── berechnen/      # Alte Berechnung
│       │   └── g2/             # Neue g2-Berechnung
│       │       ├── berechnen/  # g2-Logik
│       │       └── config/     # g2-Konfiguration
│       └── preisvergleich/     # Wettbewerbspreise ⭐ NEU
│           └── search/         # Crawling
│
├── components/
│   ├── PreiseModule.js         # Alte PB + Vergleich
│   └── PreiseG2Module.js       # Neue g2-Berechnung
│
├── services/
│   └── coldleads/              # Kaltakquise-Logik
│
├── lib/
│   ├── mongodb.ts              # MongoDB Connection
│   ├── mssql.ts                # MSSQL Connection
│   └── emergent-llm.ts         # OpenAI Integration
│
├── scripts/
│   └── cursor-import-small.js  # Cursor-basierter Import
│
└── .env                        # Environment Variables
```

---

## 🚀 Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
# .env bearbeiten (siehe unten)
```

### 2. Dependencies
```bash
cd /app
yarn install
```

### 3. MongoDB Collections
```bash
mongo score_zentrale
db.createCollection('prospects')
db.createCollection('articles')
db.createCollection('preisformeln')
db.createCollection('g2_configs')
```

### 4. JTL Artikel Import
```bash
# Einmalig: Alle Artikel importieren
curl -X POST http://localhost:3000/api/jtl/articles/import/start

# Oder mit Cursor (robuster):
node scripts/cursor-import-small.js
```

### 5. Start
```bash
sudo supervisorctl restart nextjs
```

### 6. Access
```
http://localhost:3000
```

---

## 📊 MongoDB Collections

### `preisformeln` (Alte Preisberechnung)
```javascript
{
  sheet: "lagerware",
  name: "Lagerware",
  warengruppen: [{id, name}, ...],
  regler: {
    kosten_variabel: 0,
    kosten_statisch: 0,
    ebay_amazon: 0.25,
    paypal: 0.02,
    paypal_fix: 0.35,
    fixkosten_beitrag: 1.4,
    gewinn_regler_1a: 0.94,
    gewinn_regler_2c: 1.07,
    gewinn_regler_3e: 1,
    prozent_aufschlag: 0.08,
    aa_threshold: 18
  },
  ve_staffeln: [1, 3, 5, 10, 25, 50, 100, 300]
}
```

### `g2_configs` (Neue Preisberechnung)
```javascript
{
  warengruppe: "lagerware",
  gstart_ek: 12,
  gneu_ek: 100,
  gneu_vk: 189,
  fixcost1: 0.35,
  fixcost2: 1.4,
  varpct1: 0.25,
  varpct2: 0.02,
  aufschlag: 1.08,
  shp_fac: 0.92,
  aa_threshold: 18
}
```

### `articles` (JTL-Artikel)
```javascript
{
  kArtikel: 123456,
  cArtNr: "100026",
  cName: "5x VSM KV707T...",
  cBarcode: "4077249051915",
  cHAN: "MPN123",
  cHerstellerName: "VSM",
  cWarengruppenName: "Schleifbänder",
  fVKNetto: 49.99,
  fEKNetto: 29.99,
  margin_percent: 40,
  nLagerbestand: 150,
  imported_at: "2025-11-12T..."
}
```

---

## 🔧 API Endpoints

### **Preisberechnung**
```
GET    /api/preise/formeln              # Alte Formeln laden
POST   /api/preise/formeln              # Formel speichern
POST   /api/preise/berechnen            # Alte Berechnung
POST   /api/preise/g2/berechnen         # Neue g2-Berechnung
GET    /api/preise/g2/config            # g2-Konfiguration
POST   /api/preise/g2/config            # g2-Konfiguration speichern
```

### **Artikel-Management**
```
GET    /api/jtl/articles/count          # Zählbar
POST   /api/jtl/articles/import/start   # Import starten (OFFSET)
POST   /api/jtl/articles/import/continue # Import fortsetzen (CURSOR) ⭐
GET    /api/jtl/articles/import/status  # Import-Status
GET    /api/jtl/articles/import/orphaned # Verwaiste Artikel
DELETE /api/jtl/articles/import/orphaned # Verwaiste löschen
GET    /api/jtl/articles/list           # Browser mit Filter
GET    /api/jtl/articles/filters        # Filter-Optionen
GET    /api/jtl/articles/presence/:kArtikel # Artikel-Präsenz ⭐
```

### **Preisvergleich**
```
POST   /api/preisvergleich/search       # Wettbewerbspreise ⭐
```

### **Kaltakquise V3**
```
POST   /api/coldleads/analyze-v3        # Analyse
POST   /api/coldleads/email-v3/send     # Email versenden
GET    /api/coldleads/followup/auto     # Auto-Follow-ups
POST   /api/coldleads/search             # Lead-Suche
DELETE /api/coldleads/delete             # Prospect löschen
```

---

## 📝 Wichtige Hinweise

### **MongoDB Collection Names**
```javascript
// ✅ RICHTIG
db.collection('prospects')      // Kaltakquise
db.collection('articles')       // JTL-Artikel
db.collection('preisformeln')   // Alte Preisberechnung
db.collection('g2_configs')     // Neue g2-Configs
```

### **Import: CURSOR vs. OFFSET**
```javascript
// ✅ EMPFOHLEN: Cursor-basiert (findet ALLE Artikel)
// POST /api/jtl/articles/import/continue
// Nutzt: WHERE kArtikel > lastKArtikel

// ⚠️ OFFSET-basiert (kann Artikel überspringen)
// POST /api/jtl/articles/import/start
// Nutzt: OFFSET x ROWS
```

### **Preisberechnung - Formeln**

**Alte Formel (f_alt):**
```javascript
zaehler = (c * (ve*ek)^a) + paypal_fix + fixkosten + (ve*ek)
nenner = 1 - ebay_amazon - paypal
vk = (zaehler / nenner) * (1 + aufschlag%) / ve
```

**g2-Formel:**
```javascript
f_alt(x) = wie oben
rNEU = gneu_vk / f_alt(gneu_ek)

Intervall I (x ≤ gstart):    f_alt(x)
Intervall II (gstart < x < gneu): f_alt(x) * [1 + (rNEU-1) * S(t)]
Intervall III (x ≥ gneu):    rNEU * f_alt(x)

S(t) = 3t² - 2t³  (Smoothstep)
t = (x - gstart) / (gneu - gstart)
```

---

## 🎯 Workflows

### **Artikel-Import-Workflow:**
1. **Count:** Prüfe importierbare Artikel (166.855)
2. **Import:** Cursor-basiert (robust)
3. **Upsert:** Duplikate überschreiben, zusätzliche Felder behalten
4. **Index:** Performance-Optimierung
5. **Verwaiste prüfen:** Optional nach Import

### **Preisberechnung-Workflow:**
1. **Warengruppe wählen:** (Alte PB oder g2)
2. **EK eingeben:** Pro Stück (netto)
3. **Berechnen:** 
   - Alte PB: Direkter Preis
   - g2: Mit S-Übergang wenn EK > gstart
4. **Ergebnis:** Plattformpreis + Shop-Staffeln
5. **Vergleich:** Mehrere Formeln nebeneinander

### **Artikel-Präsenz-Workflow:**
1. **Artikel-Browser öffnen**
2. **Chevron-Button klicken** (▼)
3. **Präsenz ansehen:**
   - Stücklisten
   - eBay/Amazon-Angebote
   - Shop-URLs
   - Verkaufskanäle

---

## 📞 Support

**Bei Problemen:**
1. Prüfe `FORK_READY_GUIDE.md`
2. Prüfe `JTL_API_KNOWLEDGE.md`
3. Supervisor-Logs: `sudo supervisorctl tail -f nextjs`

---

## 🔐 Environment Variables (.env)

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

# Jina.ai (für Crawling)
JINA_API_KEY=...  # Optional, funktioniert auch ohne

# Emergent LLM (für OpenAI GPT-4o)
EMERGENT_API_KEY=...  # Wird automatisch gesetzt
```

---

## 🚨 Wichtige Änderungen in v3.0

### **Neue Features:**
- ✅ Preisberechnung (Alte + g2)
- ✅ Artikel-Präsenz (Stücklisten, Plattformen)
- ✅ Preisvergleich (Wettbewerber-Crawling)
- ✅ Cursor-basierter Import
- ✅ Verwaiste Artikel-Erkennung

### **Verbesserungen:**
- ✅ Kompakteres Design (50% weniger Platz)
- ✅ Ausklappbare Konfigurationen
- ✅ Robuster Import (Auto-Retry, Timeout-Schutz)
- ✅ Header glänzend weiß (bessere Lesbarkeit)

---

**Version:** 3.0  
**Zuletzt aktualisiert:** 12.11.2025  
**Maintainer:** Score Zentrale Team
