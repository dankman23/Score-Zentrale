# Score Zentrale - Dashboard & Kaltakquise System

**Version:** 2.0 (Kaltakquise V3)  
**Letzte Aktualisierung:** 11.11.2025  
**Status:** ✅ Produktionsbereit

---

## 🎯 Übersicht

Next.js Dashboard für **Score Schleifwerkzeuge** (Köln) - integriert Sales (JTL-Wawi), Marketing (GA4, Google Ads), und ein vollautomatisches **Kaltakquise-System V3**.

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
  - 71 Anwendungen (Schleifen, Polieren, Entgraten...)
  - 90 Werkstoffe (Edelstahl, Aluminium, Holz...)
  - 62 Maschinentypen (Winkelschleifer, Bandschleifer...)
  - 88 Produktkategorien (Schleifbänder, Trennscheiben...)
- **Contact Extraction:** Name, Rolle, Email, Telefon (mit Confidence)
- **Brand Matching:** 10 Score-Partner (Klingspor, 3M, Norton...)
- **Confidence Score:** 0-100

#### **Emailer V3:**
- **3 Mails generiert:**
  1. Erstansprache (≤180 Wörter)
  2. Follow-up 1 nach 5 Tagen (≤110 Wörter)
  3. Follow-up 2 nach 12 Tagen (≤90 Wörter)
- **Plain Text** (kein Markdown)
- **Personalisiert:** Anrede, Website-Bezug, passende Marken
- **CTA:** Telefon, Email, oder Business-Formular
- **BCC:** leismann@score-schleifwerkzeuge.de

#### **Auto-Follow-ups:**
- Automatisches Scheduling
- Täglich prüfen & versenden
- Status-Tracking

#### **Autopilot:**
- Vollautomatisch: Suche → Analyse → Email
- Tages-Limit konfigurierbar
- Nutzt V3-APIs

#### **UI-Features:**
- Bulk-Analyse (alle/ausgewählte)
- Re-Analyse möglich
- Email-Preview (alle 3 Mails)
- Löschen-Funktion
- Details-Ansicht mit V3-Daten

### 4. Warmakquise (Warm Acquisition)
- Inaktive Kunden-Scores
- Kontakthistorie
- Follow-up-Management

### 5. Glossar-Verwaltung
- **6 Kategorien:**
  1. Anwendungen (71)
  2. Kategorien (88)
  3. Werkstoffe (90)
  4. Maschinentypen (62)
  5. Branchen (8)
  6. Machine Types
- Versions-Management
- Website-Content-Publikation
- PDF-basierte Branchen-Datenbank

### 6. Produkte-Verwaltung (JTL-Artikel)
- **Artikel-Import:** 166.855+ Artikel aus JTL-Wawi
- **Artikel-Browser:**
  - Text-Suche (Artikelnummer, Name, Barcode)
  - Filter: Hersteller (13), Warengruppen (35)
  - Pagination (25/50/100 pro Seite)
- **Daten:** Artikelnummer, Name, Preise, Marge, Lagerbestand
- **Performance:** Batch-Import, indizierte Suche

### 7. Marketing
- Analytics Dashboard Integration
- Google Ads Kampagnen-Verwaltung

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
- **MongoDB:** Kaltakquise, Artikel, Autopilot
- **MS SQL Server:** JTL-Wawi (Read-Only)

### **Integrationen**
- **OpenAI GPT-4o:** LLM-Analyse
- **Jina.ai Reader:** Website-Crawling
- **Google Custom Search:** Lead-Generierung
- **Google Analytics 4:** Web-Analytics
- **Google Ads API:** Kampagnen-Daten
- **Nodemailer (SMTP):** Email-Versand
- **IMAP:** Email-Inbox

---

## 📁 Projekt-Struktur

```
/app/
├── app/
│   ├── page.js                 # Haupt-Dashboard (SPA)
│   ├── layout.js               # Layout + Navigation
│   ├── globals.css             # Styles
│   └── api/                    # Backend APIs
│       ├── coldleads/
│       │   ├── analyze-v3/     # V3 Analyse
│       │   ├── email-v3/       # V3 Email-Versand
│       │   ├── followup/auto/  # Auto-Follow-ups
│       │   ├── autopilot/      # Autopilot-System
│       │   ├── search/         # Lead-Suche
│       │   ├── dach/           # DACH-Crawler
│       │   └── delete/         # Prospect löschen
│       └── jtl/articles/
│           ├── import/         # Artikel-Import
│           ├── list/           # Browser
│           └── filters/        # Filter-Optionen
│
├── services/
│   └── coldleads/
│       ├── analyzer-v3.ts      # Analyzer V3
│       ├── emailer-v3.ts       # Emailer V3
│       ├── dach-crawler.ts     # DACH-Crawler
│       └── prospector.ts       # Google Search
│
├── lib/
│   ├── mongodb.ts              # MongoDB Connection
│   ├── mssql.ts                # MSSQL Connection
│   ├── emergent-llm.ts         # OpenAI Integration
│   ├── email-client.ts         # SMTP Client
│   ├── glossary.ts             # Glossar (311 Begriffe)
│   └── score-coldleads-config.ts # V3 Config
│
├── .env                        # Environment Variables
├── README.md                   # Diese Datei
├── START_HERE.md               # Einstieg für neue Agenten
├── FORK_READY_GUIDE.md         # Deployment Guide
└── JTL_API_KNOWLEDGE.md        # JTL-Wawi Schema-Wissen
```

---

## 🚀 Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
# .env bearbeiten (siehe FORK_READY_GUIDE.md)
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
```

### 4. JTL Artikel Import
```bash
curl -X POST http://localhost:3000/api/jtl/articles/import/start
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

### `prospects` (Kaltakquise)
```javascript
{
  id: "prospect_...",
  website: "https://...",
  company_name: "...",
  industry: "...",
  region: "...",
  status: "new" | "analyzed" | "contacted",
  score: 0-100,
  
  // V3 Analysis
  analysis_v3: {
    branch_guess: [...],
    applications: [{term, evidence}],
    materials: [{term, evidence}],
    machines: [{term, evidence}],
    product_categories: [{term, evidence}],
    contact_person: {name, role, email, confidence},
    recommended_brands: [...],
    notes: "..."
  },
  
  // Email Sequence
  email_sequence: {
    mail_1: {subject, body, word_count},
    mail_2: {subject, body, word_count},
    mail_3: {subject, body, word_count},
    crm_tags: [...]
  },
  
  // Follow-up Tracking
  followup_schedule: {
    mail_1_sent: false,
    mail_1_sent_at: null,
    mail_2_scheduled: null,
    mail_2_sent: false,
    mail_3_scheduled: null,
    mail_3_sent: false,
    sequence_complete: false
  }
}
```

### `articles` (JTL-Artikel)
```javascript
{
  kArtikel: 123456,
  cArtNr: "100026",
  cName: "5x VSM KV707T...",
  cHerstellerName: "VSM",
  cWarengruppenName: "Schleifbänder",
  fVKNetto: 49.99,
  fEKNetto: 29.99,
  margin_percent: 40,
  nLagerbestand: 150,
  imported_at: "2025-11-10T..."
}
```

---

## 🔧 API Endpoints

### **Kaltakquise V3**
```
POST   /api/coldleads/analyze-v3        # Analyse starten
POST   /api/coldleads/email-v3/send     # Email versenden
GET    /api/coldleads/followup/auto     # Auto-Follow-ups
POST   /api/coldleads/search             # Lead-Suche
GET    /api/coldleads/search?status=... # Prospects laden
DELETE /api/coldleads/delete             # Prospect löschen
```

### **JTL Artikel**
```
GET  /api/jtl/articles/count          # Zählbar
POST /api/jtl/articles/import/start  # Import
GET  /api/jtl/articles/import/status # Status
GET  /api/jtl/articles/list          # Browser
GET  /api/jtl/articles/filters       # Filter
```

---

## 📝 Wichtige Hinweise

### **MongoDB Collection Names**
```javascript
// ✅ RICHTIG
db.collection('prospects')      // Kaltakquise
db.collection('articles')       // JTL-Artikel

// ❌ FALSCH (Legacy)
db.collection('cold_prospects') // Veraltet!
```

### **Import-Pfade in API-Routes**
```javascript
// ❌ FALSCH
import { foo } from '@/lib/bar'

// ✅ RICHTIG
import { foo } from '../../../../lib/bar'
```

### **Analysis Format**
```javascript
// V3 Format bevorzugen
if (prospect.analysis_v3) {
  // Neue Struktur
} else if (prospect.analysis) {
  // Legacy Format
}
```

---

## 🎯 Workflows

### **Kaltakquise-Workflow:**
1. **Lead-Generierung:** Google Search / DACH-Crawler
2. **Speichern:** MongoDB `prospects` (status: "new")
3. **Analyse V3:** Multi-Page Crawl + LLM + Glossar
4. **Email-Generierung:** 3 Mails (Erst + 2 Follow-ups)
5. **Versand:** Mail 1 + Schedule Follow-ups
6. **Auto-Follow-ups:** Mail 2 (5d), Mail 3 (12d)

### **Artikel-Import-Workflow:**
1. **Count:** Prüfe importierbare Artikel (166.855)
2. **Import:** Batch-Import (2000/Batch)
3. **Upsert:** Duplikate überschreiben
4. **Index:** Performance-Optimierung
5. **Browser:** Frontend-Zugriff

---

## 📞 Support

**Bei Problemen:**
1. Prüfe `FORK_READY_GUIDE.md`
2. Prüfe `JTL_API_KNOWLEDGE.md`
3. Prüfe `test_result.md`
4. Supervisor-Logs: `sudo supervisorctl tail -f nextjs`

---

**Version:** 2.0  
**Zuletzt aktualisiert:** 11.11.2025  
**Maintainer:** Score Zentrale Team
