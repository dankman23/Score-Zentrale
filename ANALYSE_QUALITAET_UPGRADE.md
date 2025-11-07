# Analyse-Qualität Upgrade Plan

## 🎯 Ziel
Die Analyse ist das Herzstück des Kaltakquise-Tools. Sie muss:
- **Gründlich** sein (alle relevanten Infos erfassen)
- **Präzise** sein (korrekte Einschätzung)
- **Zuverlässig** sein (keine Fehler/Abstürze)

## ✅ Bereits implementiert

### 1. Robustheit
- ✅ Timeout-Protection (30s)
- ✅ Retry-Logic (2 Retries)
- ✅ Fallback-Analyse bei OpenAI-Fehler (Keyword-basiert)
- ✅ Graceful Degradation
- ✅ Error-Handling überall

### 2. Datenerfassung
- ✅ Website-Crawling mit Cheerio
- ✅ Text-Extraktion (max 5000 Zeichen)
- ✅ Kontakt-Extraktion (Email, Telefon, Namen)
- ✅ Priorisierung (Einkauf > Produktion > Vertrieb)

### 3. AI-Analyse
- ✅ GPT-4 für detaillierte Analyse
- ✅ Strukturierter Prompt mit Branchen-Wissen
- ✅ Scoring 0-100
- ✅ Individual-Hook für Emails

### 4. JTL-Integration
- ✅ Customer-Matching (Domain, Name, Email)
- ✅ Warnung bei existierenden Kunden
- ✅ Confidence-Score

## 🚀 Verbesserungsmöglichkeiten

### Phase 1: Tiefere Website-Analyse (EMPFOHLEN)

**1.1 Multi-Page Crawling**
- Nicht nur Homepage, sondern auch:
  * /über-uns, /about
  * /kontakt, /contact
  * /impressum
  * /team
- Mehr Daten = bessere Analyse

**1.2 Strukturierte Daten extrahieren**
- Schema.org Markup
- Meta-Tags (Open Graph)
- Strukturierte Kontakt-Infos

**1.3 Bilder analysieren**
- Werkstatt-Bilder → Rückschlüsse auf Equipment
- Produkt-Bilder → Genauere Einschätzung

**Code-Beispiel:**
```typescript
async function deepCrawl(baseUrl: string) {
  const pages = [
    baseUrl,
    `${baseUrl}/über-uns`,
    `${baseUrl}/about`,
    `${baseUrl}/kontakt`,
    `${baseUrl}/impressum`
  ]
  
  const results = await Promise.allSettled(
    pages.map(url => crawlWebsite(url))
  )
  
  // Kombiniere alle Texte
  const combinedText = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value.text_content)
    .join(' ')
    .slice(0, 10000) // Mehr Text für bessere Analyse
  
  return combinedText
}
```

### Phase 2: Erweiterte Kontakt-Erkennung

**2.1 LinkedIn Integration**
- Suche Firma auf LinkedIn
- Extrahiere Mitarbeiter-Profile
- Identifiziere Entscheider

**2.2 XING Integration**
- Deutsches Business-Netzwerk
- Bessere Abdeckung für DACH-Raum

**2.3 Email-Verifier**
- Validiere gefundene Emails
- Nutze Hunter.io oder ähnliche APIs
- Markiere verifizierte Emails

**Code-Beispiel:**
```typescript
async function verifyEmail(email: string): Promise<boolean> {
  // Hunter.io API oder eigene Verification
  try {
    const response = await fetch(`https://api.hunter.io/v2/email-verifier?email=${email}&api_key=...`)
    const data = await response.json()
    return data.data.status === 'valid'
  } catch {
    return false // Fallback: Akzeptiere Email
  }
}
```

### Phase 3: Branchen-spezifische Analyse

**3.1 Spezial-Prompts**
- Unterschiedliche Prompts für:
  * Metallbau (Fokus: Schweißen, Schleifen)
  * Holzbau (Fokus: Schleifbänder, Finish)
  * Automotive (Fokus: Präzision, Volumina)

**3.2 Konkurrenz-Analyse**
- Welche Schleifmittel-Hersteller nutzen sie aktuell?
- Erwähnung von Klingspor, VSM, 3M auf Website?
- Potenzial für Wechsel?

**3.3 Volumen-Schätzung**
- Mitarbeiter-Anzahl
- Produktions-Größe
- Geschätzter Jahresbedarf

### Phase 4: Scoring-Verbesserung

**4.1 Multi-Faktor-Scoring**
```
Score = (
  Website-Qualität * 0.1 +
  Branchen-Fit * 0.3 +
  Oberflächenbearbeitungs-Indikatoren * 0.25 +
  Kontakte-Qualität * 0.15 +
  Firmen-Größe * 0.2
) * 100
```

**4.2 Red Flags Detection**
- Bereits Kunde (JTL-Match)
- Zu klein (Hobby-Werkstatt)
- Falsche Branche

**4.3 Hot Leads Identification**
- Großer Betrieb + Viele Schweißnähte = 🔥
- Neu gegründet + Wachstum = 🌱
- Messe-Teilnahme erwähnt = 📈

### Phase 5: Reporting & Insights

**5.1 Analyse-Report generieren**
```
✅ Was spricht für SCORE:
- Spezialisiert auf Edelstahl-Verarbeitung
- 50+ Mitarbeiter → hohes Volumen
- Erwähnt "Qualität" als USP

⚠️ Was könnte problematisch sein:
- Bereits Logo von VSM auf Website
- Kein Impressum gefunden
- Website sehr alt (2015)

💡 Empfehlung:
Kontakt aufnehmen mit Fokus auf:
- Schleifbänder für Edelstahl
- Komplettes Sortiment vs. aktueller Lieferant
- Preisvergleich anbieten
```

**5.2 Konkurrenz-Tracking**
- Welche Hersteller werden erwähnt?
- Häufigkeits-Analyse über alle Prospects

**5.3 Success-Tracking**
- Welche Scores führten zu Kunden?
- Welche Branchen konvertieren am besten?
- Kontinuierliche Verbesserung

## 📊 Implementierungs-Prioritäten

### JETZT (High Priority)
1. ✅ Fehler beheben (Done)
2. ✅ "Erneut analysieren" Button (Done)
3. ✅ JTL-Matching (Done)
4. ✅ Besseres Error-Handling (Done)

### BALD (Medium Priority)
1. Multi-Page Crawling → +30% Daten-Qualität
2. Email-Verification → Höhere Kontakt-Rate
3. Verbessertes Scoring → Bessere Priorisierung

### SPÄTER (Nice to Have)
1. LinkedIn/XING Integration
2. Konkurrenz-Analyse
3. Detaillierte Reports

## 💰 Kosten-Nutzen

### OpenAI Kosten
- Aktuell: ~$0.03 pro Analyse (GPT-4)
- Mit mehr Text (10k statt 5k): ~$0.06 pro Analyse
- **Empfehlung:** Bleib bei 5k-10k für gutes Kosten/Nutzen-Verhältnis

### Externe APIs
- Hunter.io: $49/Monat für 1000 Verifications
- LinkedIn API: Komplex & teuer
- **Empfehlung:** Erst bei >100 Analysen/Monat

## 🎯 Sofort-Maßnahmen

1. **Mehr Kontext für AI:**
   - Erhöhe `slice(0, 5000)` → `slice(0, 8000)`
   - Mehr Text = bessere Einschätzung

2. **Bessere Kontakt-Patterns:**
   - Erweitere Regex für deutsche Namen
   - Suche nach "Geschäftsführer", "Inhaber"

3. **Branchen-Templates:**
   - Erstelle 5-10 Best-Practice Prompts
   - A/B-Testing welcher besser performt

4. **Quality Assurance:**
   - Speichere jede Analyse mit Timestamp
   - Manuelles Review von ersten 20 Analysen
   - Iterative Verbesserung basierend auf Feedback

## ✅ Checkliste für perfekte Analyse

- [ ] Website erreichbar?
- [ ] Mind. 1000 Zeichen Text extrahiert?
- [ ] Mind. 1 Kontakt gefunden?
- [ ] Branchen-Fit erkannt?
- [ ] Score > 30?
- [ ] Individual-Hook generiert?
- [ ] JTL-Matching durchgeführt?
- [ ] Alle Daten in MongoDB gespeichert?

**Ziel:** 95%+ Success-Rate bei Analysen!
