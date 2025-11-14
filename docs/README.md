# Score Zentrale - Internes ERP & FIBU System

## 📋 Projektübersicht

**Score Zentrale** ist ein maßgeschneidertes ERP-System mit integriertem FIBU-Modul (Finanzbuchhaltung) für Score Schleifwerkzeuge. Das System wurde entwickelt, um Buchhaltungsprozesse zu automatisieren und eine vollständige Übersicht über alle finanziellen Transaktionen zu bieten.

## 🎯 Hauptziele

- **Automatisierte Rechnungsverarbeitung**: KI-gestützte Extraktion von Lieferantenrechnungen aus PDFs
- **Zentrale Buchhaltungs-Übersicht**: Alle Eingangs- und Ausgangsrechnungen, Zahlungen und Gutschriften
- **Intelligente Zuordnung**: Fuzzy Matching + Machine Learning für automatische Zuordnungen
- **Export-Funktionalität**: Direkter Export für 10it (Addison) Buchhaltungssoftware
- **SKR04-konform**: Deutscher Standardkontenrahmen (Abschlussgliederung)

## 🚀 Highlights

### Automatisierung
- **🤖 Fuzzy Matching**: 36% der Zahlungen automatisch zugeordnet
- **🧠 Smart Matching**: 42% der Commerzbank-Zahlungen automatisch erkannt
- **📖 Lern-System**: Erstellt automatisch Regeln aus manuellen Zuordnungen
- **⚡ Performance**: Zahlungen-Cache reduziert Ladezeit von 40s auf <1s

### Datenqualität
- **Gemini AI Parser**: Automatische Rechnungsextraktion (98%+ Genauigkeit)
- **Duplikat-Erkennung**: Verhindert Mehrfach-Buchungen
- **Validierungs-Regeln**: Automatische Plausibilitätsprüfung

### Export
- **10it-Format**: Direkt importierbar in Addison
- **2.000+ Buchungen**: Monatlich exportierbar
- **SKR04-konform**: Alle Konten korrekt zugeordnet

## 🏗️ Technologie-Stack

- **Frontend**: Next.js 14 (App Router), React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes (TypeScript)
- **Datenbanken**: 
  - MongoDB (Geschäftsdaten, FIBU)
  - MSSQL (JTL-Warenwirtschaft, read-only)
- **AI/ML**: Gemini 2.0 Flash (via emergentintegrations)
- **Python**: Invoice Parsing Scripts

## 📁 Projekt-Struktur

```
/app
├── app/
│   ├── api/fibu/              # FIBU API Routes
│   │   ├── zahlungen/         # Zahlungen (mit Cache)
│   │   ├── rechnungen/        # EK/VK-Rechnungen
│   │   ├── export/10it/       # 10it Export
│   │   ├── fuzzy-match/       # Fuzzy Matching
│   │   └── monatsuebersicht/  # Dashboard-Daten
│   └── fibu/page.js           # FIBU Frontend
├── components/
│   ├── FibuMonatsUebersicht.js  # Dashboard mit 20 Zitaten
│   ├── ZahlungenView.js         # Zahlungen mit Filtern
│   ├── FuzzyMatchingView.js     # Auto-Zuordnung UI
│   └── ...
├── scripts/
│   ├── fuzzy-match-zahlungen.js    # Intelligente Zuordnung
│   ├── smart-match-commerzbank.js  # Bank-Matching mit ML
│   ├── auto-assign-sachkonten.js   # Gehalt/Gebühren
│   └── apply-debitor-regeln.js     # IGL-Logik
└── docs/                       # Diese Dokumentation
```

## 🎨 Features im Detail

### 1. FIBU-Dashboard
- **Monatsübersicht**: KPIs, offene Aufgaben, Fortschrittsbalken
- **20 Groteske Zitate**: Aristoteles feat. Dieter Bohlen & Co. 😂
- **Direkte Links**: Von Kacheln zu den relevanten Daten
- **Abschließbar-Check**: Zeigt ob Monat exportiert werden kann

### 2. Zahlungen (3.000+ pro Monat)
- **Quellen**: JTL (tZahlung + tZahlungsabgleich), Postbank CSV
- **Filter**: Nach Anbieter, Zuordnung, Richtung, Suche
- **Cache**: Lädt nur einmal aus JTL, danach aus MongoDB
- **Auto-Zuordnung**: Fuzzy Matching für Rechnungs-Zuordnung

### 3. Intelligente Zuordnung
- **Fuzzy Matching**: Betrag + Datum + Hinweis → 70%+ Confidence
- **Smart Matching**: IBAN + Name → Kreditor-Zuordnung
- **Sachkonto-Auto**: Gehälter, Gebühren, Versand automatisch
- **Lern-Regeln**: Manuelle Zuordnung → Automatische Regel

### 4. 10it Export
- **Format**: CSV (Semikolon, UTF-8 BOM)
- **Buchungen**: VK, EK, Zahlungen, Gutschriften
- **SKR04**: Alle Konten korrekt (1xxx Bank, 3xxx Verbindl., 4xxx Erlöse)

## 📊 Datenbank-Schema

### MongoDB Collections:

- `fibu_vk_rechnungen` - Verkaufsrechnungen (JTL + extern)
- `fibu_ek_rechnungen` - Eingangsrechnungen (Lieferanten)
- `fibu_zahlungen` - Alle Zahlungsbewegungen
- `fibu_externe_rechnungen` - Amazon VCS-Lite
- `fibu_gutschriften` - Gutschriften
- `kreditoren` - Lieferanten (70xxx)
- `fibu_igl_debitoren` - IGL-Kunden (10xxx)
- `fibu_debitor_regeln` - Sammelkonten-Logik
- `kontenplan` - SKR04 Kontenrahmen
- `fibu_zuordnungsregeln` - ML-Lernregeln
- `fibu_matching_vorschlaege` - Fuzzy-Match Vorschläge
- `fibu_commerzbank_vorschlaege` - Bank-Match Vorschläge

### MSSQL (JTL) - Read-Only:

- `tRechnung` - Verkaufsrechnungen
- `tZahlungseingang` - Zahlungen
- `tZahlungsabgleichUmsatz` - Bank-Transaktionen
- `tKunde` - Kundenstammdaten

## 🚀 Quick Start

Siehe [SETUP.md](./SETUP.md) für detaillierte Anleitung.

```bash
# Dependencies installieren
cd /app/app
yarn install

# Python-Dependencies
pip install -r /app/requirements.txt

# Services starten
sudo supervisorctl restart all

# App öffnen
# → http://localhost:3000
```

## 📚 Dokumentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technische Architektur und Datenflüsse
- **[FIBU_README.md](./FIBU_README.md)** - Detaillierte FIBU-Modul Dokumentation
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Alle API-Endpunkte mit Beispielen
- **[SETUP.md](./SETUP.md)** - Installation und Konfiguration
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Häufige Probleme und Lösungen
- **[PENDING_TASKS.md](./PENDING_TASKS.md)** - Offene Aufgaben und TODOs
- **[MAPPING_OPTIMIERUNGEN.md](./MAPPING_OPTIMIERUNGEN.md)** - Optimierungsvorschläge

## 🎯 Aktueller Status (Januar 2025)

### ✅ Funktioniert:
- Automatische Rechnungsverarbeitung (Gemini AI)
- Fuzzy Matching (36% Auto-Zuordnung)
- Smart Matching Commerzbank (42% Auto-Zuordnung)
- 10it Export (2.000+ Buchungen)
- Monatsübersicht mit Abschließbar-Check
- SKR04-Kontenrahmen (vollständig)

### ⏳ In Arbeit:
- eBay/Amazon Hinweise aus JTL holen
- Filter-Aktivierung bei Kachel-Klick
- Selbstdefinierter Zeitraum-Picker

### 📈 KPIs (Oktober 2025):
- 789 VK-Rechnungen (alle mit Debitor ✅)
- 107 EK-Rechnungen (37 mit Kreditor ✅)
- 3.088 Zahlungen (1.479 zugeordnet ✅)
- 76.022€ Umsatz

## 🛠️ Scripts

```bash
# Fuzzy Matching für Zeitraum
node /app/scripts/fuzzy-match-zahlungen.js 2025-10-01 2025-10-31

# Smart Matching Commerzbank
node /app/scripts/smart-match-commerzbank.js 2025-10-01 2025-10-31

# Sachkonto-Zuordnung (Gehälter, Gebühren)
node /app/scripts/auto-assign-sachkonten.js 2025-10-01 2025-10-31

# Debitor-Regeln anwenden (IGL-Logik)
node /app/scripts/apply-debitor-regeln.js
```

## 🐛 Bekannte Probleme

Siehe [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

## 📞 Support

Bei Fragen:
1. Siehe [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Prüfe Logs: `/var/log/supervisor/nextjs.out.log`
3. Kontaktiere den Entwickler

---

**Version**: 2.0.0  
**Status**: Produktiv  
**Letzte Aktualisierung**: Januar 2025
