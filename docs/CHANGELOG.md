# Changelog - FIBU Modul

Dokumentiert alle wichtigen Änderungen am FIBU-Modul.

---

## [15. Januar 2025] - KRITISCHE SICHERHEITS-MASSNAHMEN

### Grund
KRITISCHER FEHLER: Externe Rechnungen waren plötzlich komplett verschwunden (0 statt 50)
durch fehlerhaften SQL-Subquery.

### Maßnahmen implementiert:

1. **Dokumentation für Daten-Sicherheit**
   - `/app/docs/CRITICAL_APIS_DO_NOT_BREAK.md` erstellt
   - Listet alle kritischen APIs auf
   - Zeigt was erlaubt/verboten ist
   - Rollback-Anleitung

2. **Automatischer Daten-Test**
   - `/app/test-critical-data.js` erstellt
   - Prüft ob alle Daten noch da sind
   - MUSS vor und nach JEDER Änderung ausgeführt werden
   - Exit Code 0 = OK, Exit Code 1 = FEHLER

3. **Agent-Anleitung**
   - `/app/README_FOR_AGENTS.md` erstellt
   - Pflicht-Checkliste für alle zukünftigen Agents
   - DO's und DON'Ts klar definiert

4. **Externe Rechnungs-API FIX**
   - SQL-Subquery entfernt (war fehlerhaft)
   - Matching-Logik nach Node.js verschoben (sicherer)
   - 2-Stufen-Ansatz: Erst Rechnungen laden, dann Zahlungen matchen
   - Ergebnis: 46/50 Rechnungen (92%) korrekt zugeordnet

### Regel für Zukunft
**"Was einmal im Modul ist, bleibt auch da und kann nur manuell gelöscht werden!"**

Keine Code-Änderung darf jemals dazu führen, dass Daten verschwinden.

---

## Version 2.0.0 (Januar 2025)

### 🎉 Neue Features

#### Intelligente Zuordnung
- **Fuzzy Matching für Zahlungen** implementiert
  - 36% automatische Zuordnung
  - Matching nach Betrag (±5€), Datum (±14 Tage), Rechnungsnummer im Hinweis
  - Confidence-Scores (70%+ = auto, 50-69% = manuelle Prüfung)
  - UI für manuelle Prüfung der Vorschläge

- **Smart Matching für Commerzbank** implementiert
  - 42% automatische Zuordnung
  - IBAN-Matching mit Kreditoren
  - Name-Matching (fuzzy)
  - Historisches Matching
  - Automatische Regel-Erstellung bei manueller Zuordnung

- **Sachkonto-Auto-Zuordnung** implementiert
  - Gehälter automatisch erkannt (Mitarbeiter-Namen)
  - PayPal/Amazon/eBay Gebühren → Konto 4985
  - Versandkosten → Konto 4910
  - Steuern → Konto 3800/4830

#### Performance-Optimierungen
- **Zahlungen-Cache** implementiert
  - Erste Ladung: 38-44 Sekunden (aus JTL)
  - Danach: <1 Sekunde (aus MongoDB Cache)
  - Reload-Button für manuelle Aktualisierung
  - Spart 95% Ladezeit!

#### UI/UX Verbesserungen
- **Monatsübersicht kompakter**
  - 6 Spalten statt 4 (kleinere Kacheln)
  - Direkte Links zu relevanten Daten
  - Offene Aufgaben als klickbare Buttons

- **20 Groteske Zitate** hinzugefügt
  - Aristoteles feat. Dieter Bohlen
  - Sokrates feat. Daniela Katzenberger
  - Lenin feat. Katja Krasavice
  - ... und 17 weitere! 😂

- **CSS-Fixes**
  - Weiß-auf-weiß bei Filtern behoben
  - Filter-Buttons jetzt blau mit weißer Schrift
  - Horizontales Scrolling für alle Tabellen-Spalten

#### Daten & Export
- **74 neue SKR04-Konten** importiert
  - Vorsteuer-Konten (1401-1407)
  - Bank-Konten (1701, 1801-1819)
  - USt-Konten (3804-3837)
  - Erlös-Konten (4000-4999)
  - Aufwands-Konten (5000-6999)

- **10it Export optimiert**
  - Korrekte Bankkonten (1820 PayPal, 1825 Amazon, 1840 eBay)
  - SKR04-konforme Buchungssätze
  - 2.000+ Buchungen pro Monat

### 🐛 Bugfixes

- **Gemini Parser**: Erkannte fälschlicherweise Score als Lieferant (99 Rechnungen neu geparst)
- **VK-Rechnungen**: Daten-Überschreibung verhindert (MongoDB statt SQL)
- **Zahlungen**: Bestehende Zuordnungen werden nicht mehr überschrieben
- **Performance**: Zahlungen-API von 40s auf <1s optimiert

### 📚 Dokumentation

- README.md komplett überarbeitet
- ARCHITECTURE.md mit Datenflüssen
- FIBU_README.md mit allen Features
- API_DOCUMENTATION.md mit Beispielen
- MAPPING_OPTIMIERUNGEN.md hinzugefügt
- CHANGELOG.md erstellt

### 🔧 Technische Änderungen

- MongoDB Caching für Zahlungen
- Neue Collections: `fibu_zuordnungsregeln`, `fibu_matching_vorschlaege`
- Python Scripts für Matching-Logik
- TypeScript-APIs für manuelle Zuordnung

---

## Version 1.0.0 (November 2024)

### Initiales Release

- FIBU-Dashboard mit Tabs (Overview, EK, VK, Zahlungen, etc.)
- Automatische Rechnungsverarbeitung (Hybrid: Python + Gemini AI)
- Kreditor-Zuordnung (manuell)
- Debitor-Zuordnung (regelbasiert, IGL-Logik)
- 10it Export (CSV)
- VK-Rechnungen aus JTL + externe Quellen
- EK-Rechnungen mit PDF-Parsing
- Bank-Import (Postbank CSV)
- Kontenplan (SKR04)

---

**Hinweis**: Für detaillierte Änderungen siehe Git-Commit-Historie.
