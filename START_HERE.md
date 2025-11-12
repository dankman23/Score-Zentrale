# 🚀 START HERE - Score Zentrale v3.0

**Letzte Aktualisierung:** 12.11.2025  
**Version:** 3.0 (Preisberechnung g2 + Artikel-Präsenz)

---

## 📌 Für neue Entwickler: Lies ZUERST diese Dateien

### 1️⃣ **README.md** (5 Min)
→ Projekt-Übersicht, Features, Tech-Stack, neue v3.0 Features

### 2️⃣ **FORK_READY_GUIDE.md** (10 Min)  
→ Deployment-Checkliste, Environment Setup, Testing, Troubleshooting

### 3️⃣ **JTL_API_KNOWLEDGE.md** (Optional, 10 Min)
→ JTL-Wawi Datenbank-Schema, Best Practices, wichtige Tabellen

---

## 🎯 Schnell-Navigation

### **⭐ NEU in v3.0: Preisberechnung**

**APIs:**
- `/app/app/api/preise/formeln/route.ts` - Alte Formeln (7 Warengruppen)
- `/app/app/api/preise/berechnen/route.ts` - Alte Berechnung
- `/app/app/api/preise/g2/berechnen/route.ts` - g2-Berechnung (3 Intervalle)
- `/app/app/api/preise/g2/config/route.ts` - g2-Konfiguration

**Frontend:**
- `/app/components/PreiseModule.js` - Alte PB + Vergleich
- `/app/components/PreiseG2Module.js` - Neue g2-Berechnung

**Formeln:**
- **Alte:** Excel-basiert, 7 Warengruppen, A.A. Threshold
- **g2:** 3 Intervalle, S-Übergang, warengruppen-basiert

### **⭐ NEU in v3.0: Artikel-Management**

**Import:**
- `/app/app/api/jtl/articles/import/continue/route.ts` - Cursor-basiert ✅
- `/app/scripts/cursor-import-small.js` - Import-Script
- Supervisor-Service: `jtl-import` (automatischer Neustart)

**Präsenz:**
- `/app/app/api/jtl/articles/presence/[kArtikel]/route.ts` ⭐ NEU
- Zeigt: Stücklisten, eBay, Amazon, Shops, Verkaufskanäle

**Preisvergleich:**
- `/app/app/api/preisvergleich/search/route.ts` ⭐ NEU
- Google Custom Search + Jina.ai Crawling
- VE-Erkennung & Preis pro Stück

### **Kaltakquise V3 System**
- `/app/services/coldleads/analyzer-v3.ts` - Multi-Page Crawl + LLM
- `/app/services/coldleads/emailer-v3.ts` - 3 Mails (Erst + 2 Follow-ups)
- `/app/app/api/coldleads/analyze-v3/route.ts` - Komplett-Analyse
- `/app/app/api/coldleads/email-v3/send/route.ts` - Email-Versand
- `/app/app/api/coldleads/autopilot/` - Autopilot-System

### **JTL Artikel-Verwaltung**
- `/app/app/api/jtl/articles/list/route.ts` - Browser mit Filter & Pagination
- `/app/app/api/jtl/articles/filters/route.ts` - Dynamische Filter
- `/app/app/api/jtl/articles/count/route.ts` - Artikel zählen

---

## ⚠️ KRITISCHE INFORMATIONEN

### **MongoDB Collections**
```javascript
// WICHTIG: Richtige Collection-Namen verwenden!
prospects      // Kaltakquise-Firmen (NICHT cold_prospects!)
articles       // JTL-Artikel (166.855)
preisformeln   // Alte Preisberechnung (7 Warengruppen)
g2_configs     // Neue g2-Konfigurationen
autopilot_state // Autopilot-Status
```

### **Import-Methoden**
```javascript
// ✅ EMPFOHLEN: Cursor-basiert
// POST /api/jtl/articles/import/continue
// WHERE kArtikel > lastKArtikel
// Findet ALLE Artikel, überspringt keine

// ⚠️ OFFSET-basiert (kann Artikel überspringen!)
// POST /api/jtl/articles/import/start  
// OFFSET x ROWS
// Nur für initiales Setup
```

### **Preisberechnung - Wichtig!**
```javascript
// Alte PB: Bis gstart_ek identisch mit g2
// g2: Nutzt Warengruppen-Regler (1a, 2c, 3e)
// Test: EK=10€ (Klingspor)
//   Alte PB: 27.60€
//   g2 (gstart=12): 27.60€  ✅ IDENTISCH!
```

---

## 🔥 Häufige Probleme & Lösungen

### Problem: "Import stoppt bei 116k Artikeln"
**Lösung:** OFFSET-Import überspringt Artikel. Nutze Cursor-Import!
```bash
node /app/scripts/cursor-import-small.js
```

### Problem: "Preise stimmen nicht mit Excel überein"
**Lösung:** 
1. Prüfe Regler in UI
2. Vergleiche mit Excel-Vorlage
3. Konfiguration ausklappen und Werte prüfen

### Problem: "g2 gibt andere Werte als Alte PB (bei EK < gstart)"
**Lösung:** Bug in f_alt! Muss identisch sein:
- Alte: `(zaehler / nenner) * (1 + aufschlag%) / ve`
- g2: `(zaehler / nenner) * (1 + aufschlag%) / ve` ✅ GLEICH

### Problem: "Artikel-Präsenz zeigt keine Daten"
**Lösung:**
- Prüfe JTL-Wawi Verbindung
- Prüfe Tabellen: `ebay_item`, `pf_amazon_angebot`, `tArtikelShop`

---

## 📞 Support & Fragen

Bei Fragen oder Problemen:
1. Prüfe `FORK_READY_GUIDE.md` → Troubleshooting
2. Prüfe `JTL_API_KNOWLEDGE.md` → Datenbank-Schema
3. Prüfe Logs: `sudo supervisorctl tail -f nextjs`

---

## 🆕 Neue Features in v3.0

### **Preisberechnung:**
- ✅ 7 alte Warengruppen (Excel-basiert)
- ✅ g2-Formel mit 3 Intervallen
- ✅ Vergleichs-Tool (Tabellen + Diagramm)
- ✅ Ausklappbare Konfigurationen
- ✅ Live-Speicherung

### **Artikel-Management:**
- ✅ 166.855 Artikel importiert
- ✅ Cursor-basierter Import (robust)
- ✅ Artikel-Präsenz (Stücklisten, Plattformen)
- ✅ Preisvergleich (Wettbewerber)
- ✅ Verwaiste Artikel-Erkennung

### **UI-Verbesserungen:**
- ✅ 50% kompakteres Design
- ✅ Header glänzend weiß
- ✅ Ausklappbare Sections
- ✅ Responsive Tabellen

---

**Viel Erfolg! 🚀**
