# ⚠️ WICHTIG FÜR ALLE AGENTS DIE AN DIESEM PROJEKT ARBEITEN ⚠️

## BEVOR DU IRGENDETWAS ÄNDERST - LIES DIES!

### 🔒 Oberste Regel

**"Was einmal im Modul ist, bleibt auch da und kann nur manuell gelöscht werden!"**

Daten dürfen NIEMALS durch Code-Änderungen verschwinden, außer der User sagt explizit:
- "Lösche diese Rechnungen"
- "Entferne diese Daten"
- "Mach die Datenbank leer"

## 📋 Pflicht-Checkliste

### VOR JEDER ÄNDERUNG AN FIBU-APIs:

1. **✅ Lies `/app/docs/CRITICAL_APIS_DO_NOT_BREAK.md`**
   - Diese Datei listet alle kritischen APIs auf
   - Zeigt was erlaubt ist und was verboten ist
   - Enthält Rollback-Anleitung

2. **✅ Führe Daten-Test aus**
   ```bash
   cd /app && node test-critical-data.js
   ```
   - Dieser Test zeigt den AKTUELLEN Stand der Daten
   - Alle Tests müssen ✅ sein

3. **✅ Erstelle Backup**
   ```bash
   cp /app/app/api/fibu/[route]/route.ts /app/app/api/fibu/[route]/route.ts.backup
   ```

4. **✅ Frage User bei Unsicherheit**
   - Wenn du nicht 100% sicher bist → FRAG!
   - Besser einmal zu viel fragen als Daten verlieren

5. **✅ Ändere inkrementell**
   - Nicht alles auf einmal ändern
   - Nach jeder Änderung testen
   - Bei Fehler sofort zurückrollen

6. **✅ Test NACH Änderung**
   ```bash
   cd /app && node test-critical-data.js
   ```
   - Alle Tests müssen weiterhin ✅ sein
   - Wenn ❌ → Sofort zurückrollen!

## ⚠️ Was HEUTE passiert ist

**KRITISCHER FEHLER:** Ein komplexer SQL-Subquery wurde hinzugefügt ohne ausreichend zu testen.

**Ergebnis:** 
- ❌ ALLE externen Rechnungen waren plötzlich verschwunden (0 statt 50)
- ❌ User war zurecht sehr verärgert
- ✅ Fehler wurde behoben durch Rollback + sichere Node.js Implementierung

**Lektion:**
- SQL-Änderungen IMMER vorher testen
- Komplexe Subqueries vermeiden
- Matching-Logik besser in Node.js als in SQL

## 📁 Wichtige Dateien

### Dokumentation
- `/app/docs/CRITICAL_APIS_DO_NOT_BREAK.md` - **PFLICHTLEKTÜRE**
- `/app/docs/EXTERNE_RECHNUNGEN_FIX.md` - Was heute schiefging
- `/app/docs/FIBU_BELEGE_SYSTEM.md` - Wie Belege funktionieren
- `/app/README.md` - Projekt-Übersicht

### Test-Scripts
- `/app/test-critical-data.js` - **VOR und NACH jeder Änderung ausführen**
- `/app/test-externe-rechnungen.js` - Spezifisch für externe Rechnungen
- `/app/test-jtl-relations.js` - Für JTL DB-Struktur

### Kritische APIs
```
/app/app/api/fibu/
├── rechnungen/
│   ├── vk/route.ts           ⚠️ KRITISCH - VK-Rechnungen
│   └── extern/route.ts        ⚠️ KRITISCH - Amazon Rechnungen
├── ek-rechnungen/
│   └── list/route.ts          ⚠️ KRITISCH - EK-Rechnungen
├── zahlungen/route.ts         ⚠️ KRITISCH - Zahlungen
├── kreditoren/route.ts        ⚠️ KRITISCH - Kreditoren
└── uebersicht/
    └── complete/route.ts      ⚠️ KRITISCH - Dashboard
```

## 🚫 Verbotene Änderungen (ohne explizite User-Anweisung)

### SQL
- ❌ WHERE-Clause verschärfen (filtert Daten aus!)
- ❌ Komplexe Subqueries ohne Test
- ❌ Tabellennamen ändern
- ❌ JOINs ändern ohne Test

### MongoDB
- ❌ Collection-Namen ändern
- ❌ Filter-Logik ändern die Daten ausblendet
- ❌ Queries ändern ohne Test

### Response-Format
- ❌ Feldnamen ändern die Frontend braucht
- ❌ Struktur komplett umbauen
- ❌ Status-Logik ändern

## ✅ Erlaubte Änderungen

### Neue Features HINZUFÜGEN
- ✅ Neue Felder zur Response hinzufügen
- ✅ Zusätzliche Filter-Optionen
- ✅ Neue APIs erstellen

### Performance-Optimierung
- ✅ Caching hinzufügen (wie bei `/complete`)
- ✅ Indizes optimieren
- ✅ Query-Performance verbessern

**ABER:** Immer mit Test vorher und nachher!

## 🆘 Was tun wenn Daten verschwunden sind?

### SOFORT:

1. **STOP!** Keine weiteren Änderungen!

2. **Rollback:**
   ```bash
   # Backup wiederherstellen
   cp /app/app/api/fibu/[route]/route.ts.backup /app/app/api/fibu/[route]/route.ts
   
   # Oder Git
   git checkout HEAD -- /app/app/api/fibu/[route]/route.ts
   ```

3. **Test:**
   ```bash
   node test-critical-data.js
   ```
   - Alle Tests müssen ✅ sein

4. **User informieren:**
   - Sage ehrlich was passiert ist
   - Zeige dass Daten wiederhergestellt sind
   - Plane bessere Lösung MIT User

## 📊 Erwartete Daten-Mengen (Stand: Januar 2025)

```
VK-Rechnungen:        ~1100 (Okt + Nov 2025)
Externe Rechnungen:   ~50-100 (pro Monat)
EK-Rechnungen:        ~40-120 (mit Kreditor)
Zahlungen:            ~200-500 (pro Monat)
Kreditoren:           ~60-120 (Lieferanten)
```

Wenn Zahlen plötzlich deutlich niedriger sind → **ALARM!**

## 🎯 Zusammenfassung

### DO ✅
- Dokumentation lesen
- Tests ausführen (vorher + nachher)
- Backup erstellen
- Inkrementell ändern
- Bei Unsicherheit fragen

### DON'T ❌
- SQL blind ändern
- Komplexe Queries ohne Test
- Alle Änderungen auf einmal
- "Einfach mal probieren"
- Daten-Filter ohne Test verschärfen

---

**Erstellt:** 15. Januar 2025  
**Grund:** Kritischer Daten-Verlust bei externer Rechnungs-API  
**Status:** BINDEND für alle zukünftigen Agents

**Danke dass du dir die Zeit genommen hast, dies zu lesen! 🙏**
