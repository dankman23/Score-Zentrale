# 🐛 BUGFIX-ZUSAMMENFASSUNG: Autopilot Debugging

## ✅ Behobene Probleme

### 1. Autopilot sendet mehrere E-Mails an dieselbe Adresse
**Problem:** Der Autopilot sendete wiederholt E-Mails an dieselbe Adresse (z.B. info@kromm-metallbau.de) ohne den Prospect als "contacted" zu markieren.

**Root Cause:** Die `updateOne`-Query in `/app/app/api/coldleads/email-v3/send/route.ts` (Zeile 150-153) verwendete nur `{ id: prospect_id }`, aber viele Prospects in der Datenbank haben nur ein `_id`-Feld (ObjectId) und kein String-`id`-Feld.

**Fix:** Die Update-Query wurde geändert um dieselbe `$or`-Logik wie beim Laden zu verwenden:
```typescript
await prospectsCollection.updateOne(
  query,  // Verwendet dieselbe $or-Query (id ODER _id)
  { $set: updates }
)
```

**Status:** ✅ BEHOBEN

---

### 2. Website-Anzeige zeigt Unterseiten statt Hauptdomain
**Problem:** Im Frontend wurden URLs wie `slv-duisburg.de/impressum/` angezeigt statt nur `slv-duisburg.de`.

**Root Cause:** 
- Der DACH-Crawler speicherte URLs mit vollständigen Pfaden (/impressum/, /kontakt/, etc.)
- Dies führte zu Duplikaten: dieselbe Firma wurde mehrfach mit verschiedenen URLs gespeichert

**Fix - Frontend:** URL-Normalisierung in der Anzeige (`/app/app/page.js` Zeile 4168-4169):
```javascript
{(() => {
  try {
    const url = new URL(p.website.startsWith('http') ? p.website : 'https://' + p.website)
    return url.hostname.replace('www.', '')
  } catch (e) {
    return p.website.replace('https://','').replace('http://','').replace('www.','').split('/')[0]
  }
})()}
```

**Fix - Backend:** URL-Normalisierung beim Speichern (`/app/app/api/coldleads/dach/crawl/route.ts`):
```typescript
const normalizeWebsite = (url: string): string => {
  if (!url) return url
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url)
    return `${urlObj.protocol}//${urlObj.hostname}`
  } catch (e) {
    return url.replace(/\/[^\/]*\/?$/, '')
  }
}
```

**Datenbank-Bereinigung:**
- Script erstellt: `/app/scripts/fix-duplicate-prospects.js`
- **415 URLs normalisiert**
- **54 Duplikate zusammengeführt**
- Prospects reduziert: 519 → 465

**Status:** ✅ BEHOBEN

---

### 3. Test-Modus für E-Mails
**Problem:** Alle E-Mails wurden an echte Empfänger gesendet, auch während der Testphase.

**Lösung:** Neues Environment-Flag `EMAIL_TEST_MODE` implementiert in `/app/lib/email-client.ts`:

**Test-Modus aktiviert:**
```bash
EMAIL_TEST_MODE=true
```

**Funktionsweise:**
- ✅ Im Test-Modus: E-Mails gehen **NUR** an BCC (leismann@score-schleifwerkzeuge.de, danki.leismann@gmx.de)
- ✅ Subject erhält `[TEST]`-Prefix
- ✅ E-Mail-Body zeigt Hinweis: "Diese E-Mail würde normalerweise an [empfänger@example.com] gesendet"
- ✅ Kein TO-Empfänger gesetzt

**Produktiv-Modus:**
```bash
EMAIL_TEST_MODE=false  # oder weglassen
```
- E-Mails gehen an TO + BCC wie gewohnt

**Status:** ✅ IMPLEMENTIERT & AKTIV

---

## 🎯 Zusätzliche Verbesserungen

### Autopilot-Tick bereits optimiert
Der Autopilot (`/app/app/api/coldleads/autopilot/tick/route.ts`) normalisiert bereits URLs vor der Analyse (Zeile 145-153).

### Datenbank-Konsistenz
Nach der Bereinigung:
- **Total:** 465 Prospects (vorher 519)
- **Neu:** 454
- **Analysiert:** 3
- **Kontaktiert:** 8

---

## 📝 Verwendung

### Test-Modus aktivieren/deaktivieren
```bash
# Test-Modus aktivieren
echo "EMAIL_TEST_MODE=true" >> /app/.env
sudo supervisorctl restart nextjs

# Test-Modus deaktivieren
sed -i '/EMAIL_TEST_MODE/d' /app/.env
sudo supervisorctl restart nextjs
```

### Datenbank erneut bereinigen (falls nötig)
```bash
cd /app
node scripts/fix-duplicate-prospects.js
```

---

## ✅ Nächste Schritte

1. **Test-Modus läuft aktuell:** Alle E-Mails gehen nur an BCC
2. **Autopilot testen:** Wenn alles stabil läuft, Test-Modus deaktivieren
3. **Monitoring:** Logs prüfen ob Prospects korrekt als "contacted" markiert werden

