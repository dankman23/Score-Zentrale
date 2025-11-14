# ⚠️ KRITISCHE APIs - NIEMALS OHNE EXPLIZITE ANWEISUNG ÄNDERN ⚠️

## ABSOLUTE REGEL

**DATEN DIE EINMAL IM SYSTEM SIND, BLEIBEN AUCH DA!**

Keine Änderung an diesen APIs darf jemals dazu führen, dass Daten verschwinden oder nicht mehr angezeigt werden.

## KRITISCHE APIs (ÄNDERUNG NUR MIT EXPLIZITER USER-ANWEISUNG)

### 1. VK-Rechnungen (Verkaufsrechnungen)
**Datei:** `/app/app/api/fibu/rechnungen/vk/route.ts`

**Was diese API macht:**
- Lädt Verkaufsrechnungen (RE-*, XRE-*) aus MongoDB
- Zeigt sie im VK-Rechnungen Tab an
- Filtert nach Datum und Status

**NIEMALS:**
- ❌ Query ändern ohne vorher zu testen
- ❌ Collection-Name ändern
- ❌ Filter-Logik ändern die Daten ausblendet
- ❌ Response-Format ändern das Frontend bricht

**ERLAUBT:**
- ✅ Neue Felder HINZUFÜGEN (nicht ersetzen)
- ✅ Performance-Optimierung MIT Test
- ✅ Zusätzliche Filter-Optionen

---

### 2. Externe Amazon Rechnungen
**Datei:** `/app/app/api/fibu/rechnungen/extern/route.ts`

**Was diese API macht:**
- Lädt externe Amazon Rechnungen (XRE-*) aus JTL DB
- Matched sie mit Amazon Payments
- Status ist IMMER "Bezahlt"

**NIEMALS:**
- ❌ SQL Query ändern ohne Test (GENAU DAS hat heute das Problem verursacht!)
- ❌ Tabellennamen ändern
- ❌ WHERE-Clause ändern
- ❌ JOIN-Logik ändern ohne Backup

**ERLAUBT:**
- ✅ Matching-Logik in Node.js verbessern (NICHT in SQL!)
- ✅ Zusätzliche Felder laden
- ✅ Performance-Optimierung MIT Test

**WICHTIG:** Matching über Betrag + Datum erfolgt in Node.js, NICHT in SQL!

---

### 3. EK-Rechnungen (Einkaufsrechnungen)
**Datei:** `/app/app/api/fibu/ek-rechnungen/list/route.ts`

**Was diese API macht:**
- Lädt verifizierte Einkaufsrechnungen aus MongoDB
- Filtert nur Rechnungen mit Kreditor-Zuordnung

**NIEMALS:**
- ❌ Filter-Logik ändern die Daten ausblendet
- ❌ Collection-Name ändern
- ❌ Betrag-Filter ändern (betrag !== 0)

---

### 4. Zahlungen
**Datei:** `/app/app/api/fibu/zahlungen/route.ts`

**Was diese API macht:**
- Lädt Zahlungen aus MongoDB
- Cached sie für Performance
- Joined mit Rechnungen

**NIEMALS:**
- ❌ Cache-Logik brechen
- ❌ MongoDB Query ändern ohne Test
- ❌ JOIN-Logik ändern

---

### 5. Kreditoren
**Datei:** `/app/app/api/fibu/kreditoren/route.ts`

**Was diese API macht:**
- Lädt Kreditoren (Lieferanten) aus MongoDB
- Wird für EK-Rechnungen Zuordnung genutzt

**NIEMALS:**
- ❌ Collection-Name ändern
- ❌ Filter-Logik ändern

---

### 6. Complete Overview
**Datei:** `/app/app/api/fibu/uebersicht/complete/route.ts`

**Was diese API macht:**
- Aggregiert ALLE Daten für Dashboard
- Cached sie für 5 Minuten
- Ruft andere APIs auf

**NIEMALS:**
- ❌ API-Aufrufe ändern
- ❌ Cache brechen
- ❌ Response-Format ändern

---

## SICHERHEITS-CHECKLISTE VOR ÄNDERUNGEN

### BEVOR du eine dieser APIs änderst:

1. **✅ EXPLIZITE USER-ANWEISUNG?**
   - Hat der User explizit gesagt "Ändere die externe Rechnungen API"?
   - Wenn NEIN → NICHT ÄNDERN!

2. **✅ BACKUP ERSTELLEN**
   ```bash
   cp /app/app/api/fibu/[route]/route.ts /app/app/api/fibu/[route]/route.ts.backup
   ```

3. **✅ TEST SCHREIBEN**
   - Erstelle ein Test-Script das prüft ob Daten noch da sind
   - Führe es VOR und NACH der Änderung aus
   - Beispiel: `test-externe-rechnungen.js`

4. **✅ INKREMENTELL ÄNDERN**
   - Ändere NICHT alles auf einmal
   - Teste nach JEDER Zeile
   - Bei Fehler → SOFORT zurückrollen

5. **✅ ROLLBACK-PLAN**
   - Wisse GENAU wie du zurückrollen kannst
   - Habe die alte Version griffbereit

---

## TEST-SUITE FÜR KRITISCHE DATEN

**Datei:** `/app/test-critical-data.js`

Diese Datei prüft ob alle kritischen Daten noch da sind.

**MUSS VOR UND NACH JEDER ÄNDERUNG AUSGEFÜHRT WERDEN!**

```bash
cd /app && node test-critical-data.js
```

Erwartetes Ergebnis:
```
✅ VK-Rechnungen: 1129 vorhanden
✅ Externe Rechnungen: 50 vorhanden
✅ EK-Rechnungen: 42 vorhanden
✅ Zahlungen: 234 vorhanden
✅ Kreditoren: 67 vorhanden
```

---

## WAS TUN BEI FEHLER?

### Wenn Daten plötzlich verschwinden:

1. **SOFORT STOPP!**
   ```bash
   # Letzte Änderung finden
   git diff HEAD
   ```

2. **ROLLBACK**
   ```bash
   # Backup wiederherstellen
   cp /app/app/api/fibu/[route]/route.ts.backup /app/app/api/fibu/[route]/route.ts
   
   # Oder Git revert
   git checkout HEAD -- /app/app/api/fibu/[route]/route.ts
   ```

3. **TEST AUSFÜHREN**
   ```bash
   node test-critical-data.js
   ```

4. **USER INFORMIEREN**
   - Erkläre was passiert ist
   - Zeige dass Daten wiederhergestellt sind
   - Plane neue Lösung MIT User-Abnahme

---

## SQL QUERY REGELN

### ERLAUBTE SQL-Änderungen:

✅ **Neue Spalten HINZUFÜGEN**
```sql
SELECT 
  -- Bestehende Spalten
  eb.kExternerBeleg,
  eb.cBelegnr,
  -- NEU: Zusätzliche Spalte
  eb.cNeuesSpalte
FROM ...
```

✅ **Performance JOINs (MIT Test!)**
```sql
-- Nur wenn vorher getestet!
LEFT JOIN zusatztabelle ON ...
```

### VERBOTENE SQL-Änderungen:

❌ **WHERE-Clause verschärfen**
```sql
-- NIEMALS!
WHERE eb.dBelegdatumUtc >= @from
  AND eb.nBelegtyp = 0
  AND eb.neueBedingung = 'xyz'  -- ❌ Filtert Daten aus!
```

❌ **Komplexe Subqueries ohne Test**
```sql
-- NIEMALS ohne ausgiebigen Test!
LEFT JOIN (
  SELECT ... FROM ... WHERE ...
  ROW_NUMBER() OVER ...
) AS subquery
```

❌ **Tabellen oder Collection-Namen ändern**
```sql
-- NIEMALS!
FROM Rechnung.tExternerBeleg_NEU  -- ❌ Tabelle existiert nicht!
```

---

## DOKUMENTATIONS-PFLICHT

### NACH JEDER ÄNDERUNG AN KRITISCHEN APIs:

1. **Dokumentiere in `/app/docs/CHANGELOG.txt`**
   ```
   [Datum] - [API-Name]
   Was geändert: ...
   Grund: ...
   Getestet: Ja/Nein
   Daten-Status: ✅ Alle Daten noch da
   ```

2. **Update diese Datei**
   - Füge neue kritische APIs hinzu
   - Dokumentiere neue Sicherheitsmechanismen

---

## FÜR NÄCHSTE AGENTS

**LIESS DIESE DATEI BEVOR DU IRGENDETWAS AN FIBU-APIs ÄNDERST!**

Diese APIs sind das Herzstück der Buchhaltung. Wenn Daten verschwinden, ist das ein kritischer Produktions-Fehler.

**User-Regel ist absolut:**
> "Was einmal im Modul ist, bleibt auch da und kann nur manuell gelöscht werden, außer ich sage explizit: 'Lösche dies oder das!'"

---

## KONTAKT BEI UNSICHERHEIT

**WENN DU DIR NICHT 100% SICHER BIST:**

1. ❓ Frage den User BEVOR du änderst
2. 📝 Erkläre genau was du vorhast
3. ⏸️ Warte auf explizite Bestätigung
4. ✅ Erst dann ändern

**NIEMALS "einfach mal probieren" bei kritischen APIs!**

---

**Erstellt:** 15. Januar 2025  
**Grund:** Kritischer Fehler bei externer Rechnungs-API  
**Status:** AKTIV und BINDEND für alle zukünftigen Änderungen
