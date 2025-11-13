# Changelog

Alle wichtigen Änderungen am SCORE Zentrale Projekt.

## [Unreleased]

### Added
- Debitor-Sammelkonten System (69xxx)
- IGL-Ausnahme für EU-Kunden mit USt-ID (10xxx)
- VK-Rechnungen Filter (Status, Quelle, Suche)
- Kontenplan-Ansicht mit vollständigem SKR03-ähnlichen Plan
- Outbound Dropdown-Menü mit 3 Unterpunkten
- FibuModule lädt jetzt FibuCompleteDashboard

### Changed
- Navigation: Kaltakquise + Warmakquise unter Outbound zusammengefasst
- VK-Rechnungen laden ALLE (kein Limit mehr)
- Datum-Formatierung: DD.MM.YYYY statt ISO
- VK-API lädt aus MongoDB statt MSSQL

### Fixed
- Gemini-Parser: "Score Schleifwerkzeuge ist NICHT der Lieferant"
- 99 falsch geparste Rechnungen gelöscht und neu verarbeitet
- Import-Pfade in VK-Rechnungen API korrigiert

## [2.0.0] - 2025-11-13

### Added
- **FIBU Complete Dashboard** als Haupt-FIBU Interface
- 7 Tabs: Übersicht, EK, Zuordnung, VK, Zahlungen, Bank-Import, Kontenplan
- Kreditor-Zuordnung mit Bulk-Edit Funktionalität
- "Neuer Kreditor anlegen" Dialog
- Export-Dialog mit VK/EK Auswahl
- Bank-Import für Postbank/Commerzbank CSV
- Auto-Matching für Kreditoren (32 erfolgreich zugeordnet)
- Re-Parsing mit verbessertem Gemini-Parser (96/96 erfolgreich)

### Changed
- Gemini-Parser mit explizitem "Score nicht als Lieferant" Prompt
- EK-Rechnungen: 98 → 194 (durch Re-Parsing)
- Datenqualität: 78/100

### Scripts Added
- `setup-debitor-sammelkonten.js` - Debitor-System Setup
- `apply-debitor-regeln.js` - Regeln auf Rechnungen anwenden
- `auto-match-kreditoren.js` - Automatische Kreditor-Zuordnung
- `kreditor-smart-suggestions.js` - Intelligente Vorschläge
- `reparse-invoices.js` - PDFs neu verarbeiten
- `fibu-datenqualitaet-check.js` - Qualitäts-Report
- `fix-score-als-lieferant.js` - Fehlerhafte Rechnungen fixen

## [1.0.0] - 2025-11-12

### Initial Release
- Sales Dashboard
- Marketing Module
- Glossar
- Produkte & Preise
- Basic FIBU Module
- JTL Integration (MS SQL)
- MongoDB Setup
