# Offene Aufgaben & TODOs

## 🔴 Kritisch (nächste Session)

### 1. eBay/Amazon Hinweise aus JTL holen
**Problem**: Zahlungen zeigen "Unbekannt" als Rechnungsnummer  
**Lösung**: JTL `tRechnung.cHinweis` Feld in Zahlungen-Query einbinden  
**Aufwand**: ~30 Minuten  
**Datei**: `/app/app/api/fibu/zahlungen/route.ts`

```sql
-- Erweiterte Query:
SELECT 
  z.kZahlungseingang,
  z.fBetrag,
  r.cRechnungsNr,
  r.cHinweis  -- DIESES FELD!
FROM tZahlung z
LEFT JOIN tRechnung r ON z.kRechnung = r.kRechnung
```

### 2. Filter-Aktivierung bei Kachel-Klick
**Problem**: Klick auf "776 bezahlt" aktiviert noch keinen Filter  
**Lösung**: Hash-Parameter lesen und Filter setzen  
**Aufwand**: ~20 Minuten  
**Dateien**: 
- `/app/components/FibuMonatsUebersicht.js` (Links bereits vorhanden)
- `/app/components/VKRechnungenView.js` (Filter aus Hash lesen)

```javascript
// In VKRechnungenView.js
useEffect(() => {
  const hash = window.location.hash
  const params = new URLSearchParams(hash.split('?')[1])
  const filter = params.get('filter')
  if (filter) setStatusFilter(filter)
}, [])
```

### 3. Selbstdefinierter Zeitraum-Picker
**Problem**: Nur vordefinierte Monate wählbar  
**Lösung**: DatePicker-Komponente hinzufügen  
**Aufwand**: ~1 Stunde  
**Implementierung**: react-datepicker oder shadcn DateRangePicker

---

## 🟡 Mittel (1-2 Wochen)

### 4. Performance: /api/fibu/uebersicht/complete optimieren
**Problem**: 5-15 Sekunden Ladezeit  
**Ursache**: Macht 5 separate API-Calls  
**Lösung**: Direkte DB-Queries statt API-Calls  
**Aufwand**: ~2 Stunden  
**Erwartete Verbesserung**: <2 Sekunden

### 5. Pferd-Parser reparieren
**Problem**: Parser für "August Rüggeberg" wirft Fehler  
**Aufwand**: ~30 Minuten  
**Datei**: `/app/python_libs/parser_pferd.py`

### 6. Amazon Settlement Reports importieren
**Problem**: Amazon-Zahlungen ohne Zuordnung  
**Lösung**: Settlement Reports mit Order-IDs importieren  
**Aufwand**: ~4 Stunden  
**Nutzen**: Würde ~176 Amazon-Zahlungen zuordnen

### 7. Commerzbank-Zuordnung UI
**Status**: Backend fertig, UI fehlt noch  
**Aufwand**: ~2 Stunden  
**Features**:
- Vorschläge anzeigen (46 Stück für Oktober)
- Kreditor/Sachkonto auswählen
- Checkbox "Regel erstellen"
- Genehmigen/Ablehnen

---

## 🟢 Nice-to-Have (1-3 Monate)

### 8. Duplikat-Erkennung
**Status**: Konzept vorhanden (siehe MAPPING_OPTIMIERUNGEN.md)  
**Aufwand**: ~1 Tag  
**Nutzen**: Verhindert Doppelbuchungen

### 9. Validierungs-Regeln
**Beispiele**:
- Datum nicht in Zukunft
- Betrag > 0
- MwSt-Berechnung plausibel
- Lieferant != "Score Schleifwerkzeuge"

**Aufwand**: ~1 Tag

### 10. PDF-Template-Erkennung
**Status**: Konzept vorhanden  
**Nutzen**: 95%+ Parsing-Genauigkeit für Top-Lieferanten  
**Aufwand**: ~3 Tage

### 11. Machine Learning für Lieferanten
**Status**: Konzept vorhanden  
**Nutzen**: Trainiert aus historischen Rechnungen  
**Aufwand**: ~5 Tage

### 12. Dashboard-Widgets
**Ideen**:
- Cashflow-Chart (Einnahmen vs. Ausgaben)
- Top-5 Lieferanten (nach Betrag)
- Offene Posten Timeline
- Zahlungsziel-Überwachung

**Aufwand**: ~2 Tage

### 13. Batch-Operations
**Features**:
- Mehrere Rechnungen auf einmal zuordnen
- Bulk-Approve für Fuzzy-Matches >80%
- Batch-Export für mehrere Monate

**Aufwand**: ~2 Tage

### 14. Benachrichtigungen
**Ideen**:
- Email bei neuen nicht zugeordneten Rechnungen
- Slack-Integration für wichtige Events
- Browser-Notifications

**Aufwand**: ~3 Tage

---
## 📝 Dokumentation

### 15. Video-Tutorial erstellen
**Inhalt**:
- FIBU-Dashboard Walkthrough
- Fuzzy Matching nutzen
- Manuelle Zuordnung
- Export durchführen

**Aufwand**: ~1 Tag

### 16. API-Postman-Collection
**Status**: Noch keine Collection vorhanden  
**Aufwand**: ~2 Stunden

---

## ✅ Bereits erledigt (Januar 2025)

- ✅ Fuzzy Matching implementiert
- ✅ Smart Matching Commerzbank implementiert
- ✅ Sachkonto-Auto-Zuordnung implementiert
- ✅ Zahlungen-Cache implementiert
- ✅ Gemini Parser Fix (Score als Lieferant)
- ✅ VK-Rechnungen Datenüberschreibung verhindert
- ✅ UI kompakter gemacht
- ✅ CSS-Fixes (weiß-auf-weiß)
- ✅ SKR04-Konten importiert (74 Stück)
- ✅ 20 groteske Zitate hinzugefügt
- ✅ Dokumentation erstellt

---

## Priorisierung

### Diese Woche:
1. eBay/Amazon Hinweise aus JTL
2. Filter-Aktivierung bei Kacheln
3. Zeitraum-Picker

### Nächste Woche:
4. Performance-Optimierung Übersicht
5. Commerzbank-Zuordnung UI
6. Amazon Settlement Reports

### Nächster Monat:
7. Duplikat-Erkennung
8. Validierungs-Regeln
9. Dashboard-Widgets

---

**Hinweis**: Priorisierung kann sich ändern basierend auf User-Feedback und Business-Anforderungen.
