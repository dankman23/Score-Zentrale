# Score Zentrale

Next.js Dashboard für Sales (JTL-Wawi), Analytics (GA4), Marketing und Kaltakquise.

## 🚀 Neu hier? START HIER!

**👉 Lies zuerst:** [`START_HERE.md`](./START_HERE.md)

Diese Datei enthält:
- ✅ Pflicht-Lektüre für neue Agents
- ✅ Quick-Start nach dem Forken
- ✅ Kritische Regeln
- ✅ Code-Struktur-Überblick

## 📚 Wichtige Dokumentationen

| Datei | Inhalt | Priorität |
|-------|--------|-----------|
| [START_HERE.md](./START_HERE.md) | Einstiegspunkt für neue Agents | ⭐⭐⭐ |
| [FORK_READY_GUIDE.md](./FORK_READY_GUIDE.md) | 7-Schritt-Checkliste nach Forken | ⭐⭐⭐ |
| [JTL_API_KNOWLEDGE.md](./JTL_API_KNOWLEDGE.md) | JTL-Wawi Schema & Best Practices | ⭐⭐⭐ |
| [KALTAKQUISE_ANLEITUNG.md](./KALTAKQUISE_ANLEITUNG.md) | Kaltakquise-System Dokumentation | ⭐⭐ |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Production Deployment | ⭐⭐ |
| [SCHEMA_MONITORING.md](./SCHEMA_MONITORING.md) | Schema-Validierung | ⭐ |
| [ROBUSTNESS_GUARANTEE.md](./ROBUSTNESS_GUARANTEE.md) | Fehlerbehandlung | ⭐ |
| [test_result.md](./test_result.md) | Testing-Protokoll | ⭐ |

## 🎯 Quick Start

```bash
# Services starten
sudo supervisorctl restart all

# Health-Check
curl http://localhost:3000/api/jtl/sales/date-range
curl http://localhost:3000/api/analytics/metrics?startDate=7daysAgo&endDate=today
curl http://localhost:3000/api/coldleads/dach/stats

# Dashboard öffnen
# http://localhost:3000
```

## 🏗️ Tech Stack

- **Frontend:** Next.js 14, React, TailwindCSS, Shadcn/UI
- **Backend:** Next.js API Routes (Node.js)
- **Datenbanken:** 
  - MS SQL (JTL-Wawi) - Produktiv
  - MongoDB (Lokal) - Kaltakquise & Glossar
- **Integrationen:**
  - Google Analytics 4 (Web Analytics)
  - Google Search API (DACH-Crawler)
  - OpenAI (AI-Analyse & E-Mail-Generierung)
  - SMTP/IMAP (E-Mail Outreach)

## 📊 Features

### 1. Sales Dashboard (JTL-Wawi)
- Umsatz Netto/Brutto inkl. Versandkosten
- Rohertragsmarge (exkl. Versand)
- Multi-Select-Filter (Hersteller, Kategorien, Lieferanten)
- Top 5 Plattformen & Hersteller
- Zeitreihen-Analysen

### 2. Analytics Dashboard (GA4)
- 8 KPIs: Sessions, Nutzer, Seitenaufrufe, Conversions, etc.
- Product Pages (Top 10, expand to 100)
- Info-Pages Performance
- Beileger-Tracking (QR-Code Traffic)
- Top 100 Seiten

### 3. Kaltakquise (Cold Acquisition)
- **Google-Suche:** Unstrukturierte Prospekt-Suche
- **DACH-Crawler:** Systematisches Crawling von 47 DACH-Regionen × 38 Branchen
- AI-gestützte Firmenanalyse (Größe, Haupttätigkeit, Produkte)
- Personalisierte E-Mail-Generierung (ohne Körnungen, mit Pferd-Erwähnung)
- E-Mail-Inbox/Outbox (mit BCC an Leismann)
- Autopilot-Modus (automatisierte Kampagnen)
- Glossar-Integration (Anwendungen, Kategorien, Materialien, Maschinen, Branchen)

### 4. Warmakquise (Warm Acquisition)
- Inaktive Kunden-Scores
- Kontakthistorie
- Follow-up-Management

### 5. Glossar-Verwaltung
- 6 Kategorien: Anwendungen, Kategorien, Werkstoffe, Maschinen, Branchen, Machine Types
- Versions-Management (5 Versionen)
- Website-Content-Publikation
- PDF-basierte Branchen-Datenbank

### 6. Produkte-Verwaltung (JTL-Artikel)
- **Artikel-Import:** 166.854+ Artikel aus JTL-Wawi in MongoDB
- **Artikel-Browser:** Vollständige Liste mit Filter & Pagination
- **Filter:** Text-Suche, Hersteller (13), Warengruppen (35)
- **Daten:** Artikelnummer, Name, Preise, Marge, Lagerbestand
- **Performance:** Batch-Import, indizierte Suche

### 7. Marketing
- Analytics Dashboard Integration
- Google Ads Kampagnen-Verwaltung

## 🔐 Environment Variables

Siehe `.env.example` für alle benötigten Keys.

**Wichtig:**
- `MONGO_URL` → NIEMALS ändern (localhost)!
- `MSSQL_*` → Produktiv-Datenbank (vorsichtig!)
- `GOOGLE_SEARCH_ENGINE_ID` → GENAU kopieren: `0146da4031f5e42a3`

## 🧪 Testing

```bash
# Backend testen (ZUERST)
# Nutze: deep_testing_backend_nextjs

# Frontend testen (nach User-Freigabe)
# Nutze: deep_testing_frontend_nextjs

# IMMER test_result.md lesen/updaten vor Testing!
```

## 📝 Development Guidelines

1. **JTL-Queries:** Lies IMMER `JTL_API_KNOWLEDGE.md` zuerst!
2. **Testing:** Befolge Protokoll in `test_result.md`
3. **APIs:** Nutze `ok: true/false` Response-Pattern
4. **Memory:** Node.js läuft mit 1024MB (verdoppelt für Stabilität)
5. **Fehlerbehandlung:** Siehe `ROBUSTNESS_GUARANTEE.md`

## 🆘 Support

**Bei Problemen:**
1. Prüfe [`FORK_READY_GUIDE.md`](./FORK_READY_GUIDE.md) → Abschnitt "Häufige Probleme"
2. Logs: `tail -f /var/log/supervisor/nextjs.out.log`
3. Health-Check: `curl http://localhost:3000/api/health/schema`

## 📜 License

Proprietary - Score Schleifwerkzeuge GmbH

---

**Version:** 1.0  
**Zuletzt aktualisiert:** 10.11.2025
