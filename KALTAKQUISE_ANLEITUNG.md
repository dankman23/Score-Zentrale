# 📧 Kaltakquise-Tool - Benutzeranleitung

## 🎯 Übersicht

Das Kaltakquise-Tool findet automatisch potenzielle B2B-Kunden, analysiert sie mit AI und generiert personalisierte Emails.

---

## 🚀 Schnellstart

### 1. Tab öffnen
```
http://localhost:3000 → Tab "Kaltakquise"
```

### 2. Firmen suchen
```
Branche: Metallbau
Region: Berlin
Limit: 10
→ "Suchen" klicken
```

### 3. Warten
- Google durchsucht das Web (~5-10 Sek)
- Firmen erscheinen in Tabelle

### 4. Analysieren
- Button "Analysieren" klicken
- OpenAI crawlt Website & bewertet
- Status wird "analyzed"
- Score 0-100 wird berechnet

### 5. Details ansehen
- Button "Details" klicken
- Zeigt: Produkte, Bedarfe, Ansprechpartner, Score

### 6. Email generieren
- Button "Email" klicken
- GPT-4 schreibt personalisierte Email
- Vorschau erscheint

### 7. Versenden
- Email prüfen
- "Jetzt versenden" klicken
- Geht direkt über SMTP

---

## 📊 Statistiken-Dashboard

Oben sehen Sie 4 Kacheln:

| Kachel | Bedeutung |
|--------|-----------|
| **Gesamt** | Alle Prospects in DB |
| **Neu** | Noch nicht analysiert |
| **Analysiert** | AI-Analyse abgeschlossen |
| **Kontaktiert** | Email wurde versendet |

---

## 🔍 Status-Filter

Mit den Buttons können Sie filtern:

- **Alle** - Zeigt alle Prospects
- **Neu** - Nur unanalysierte
- **Analysiert** - Nur AI-bewertete
- **Kontaktiert** - Nur Email-versendete

---

## 🏭 Branchen-Beispiele

### Metallverarbeitung
```
Branche: Metallbau
Region: Berlin
→ Findet: Schlossereien, Schweißereien, Stahlbauer
```

```
Branche: Edelstahlverarbeitung
Region: Hamburg
→ Findet: Apparatebau, Food-Ausstatter
```

### Holzverarbeitung
```
Branche: Holzbearbeitung
Region: München
→ Findet: Tischlereien, Schreinereien, Möbelbauer
```

```
Branche: Parkett
Region: Stuttgart
→ Findet: Parkettleger, Bodenleger
```

### Lackierung
```
Branche: Lackiererei
Region: Frankfurt
→ Findet: Karosserie, Industrielackierung
```

### Maschinenbau
```
Branche: Maschinenbau
Region: Deutschland
→ Findet: Anlagenbau, Sondermaschinenbau
```

---

## 💡 Tipps & Tricks

### Bessere Suchergebnisse

**✅ Gut:**
- Spezifische Branchen: "Edelstahlverarbeitung"
- Konkrete Städte: "Berlin", "München"
- Relevante Keywords: "Metallbau Schweißerei"

**❌ Vermeiden:**
- Zu allgemein: "Fertigung"
- Zu breit: "Deutschland" (bei erster Suche)
- Irrelevant: "Handel" (wir wollen Produzenten)

### Optimaler Workflow

1. **Klein starten:** Limit 5-10 für erste Tests
2. **Lokal suchen:** Erst eine Stadt, dann ausweiten
3. **Batch-Analyse:** Mehrere auf einmal analysieren
4. **Score beachten:** Erst 70+ kontaktieren, dann 50+

### Score-Interpretation

| Score | Bedeutung | Aktion |
|-------|-----------|--------|
| 80-100 | 🔥 Top-Lead | Sofort kontaktieren |
| 60-79 | ⭐ Gut | Definitiv kontaktieren |
| 40-59 | 👍 OK | Falls Zeit: kontaktieren |
| 0-39 | 👎 Schwach | Überspringen |

---

## ⚙️ Erweiterte Features

### Automatisches Laden
- Beim Tab-Öffnen werden gespeicherte Prospects automatisch geladen
- Filter werden angewendet
- Statistiken aktualisiert

### Persistenz
- Alle gefundenen Firmen werden in MongoDB gespeichert
- Sie können jederzeit zurückkommen
- Kein erneutes Suchen nötig

### Multi-Session
- Suchen Sie heute "Metallbau Berlin"
- Morgen "Holzbearbeitung München"
- Alle bleiben gespeichert

---

## 💰 Kosten

| Aktion | Kosten | Limit |
|--------|--------|-------|
| **Google Search** | Kostenlos | 100/Tag |
| **Analyse (OpenAI)** | ~€0.02 | Unbegrenzt |
| **Email-Generierung** | ~€0.03 | Unbegrenzt |
| **SMTP-Versand** | Kostenlos | Eigener Server |

**Total pro Lead:** ~€0.05

**100 Leads pro Tag:** ~€5

---

## 🐛 Troubleshooting

### "Google Search API Error"
→ Tages-Limit erreicht (100 Anfragen)
→ Lösung: Warten bis morgen ODER gespeicherte Prospects nutzen

### "OpenAI API Error"
→ API-Key ungültig oder Guthaben leer
→ Lösung: OpenAI-Dashboard prüfen

### "SMTP-Fehler"
→ Credentials falsch oder Server nicht erreichbar
→ Lösung: .env prüfen

### "Keine Ansprechpartner gefunden"
→ Website hat kein Impressum/Kontakt
→ Lösung: Manuell auf Website suchen

### "Score 0"
→ Website nicht erreichbar oder Analyse fehlgeschlagen
→ Lösung: Manuell Website prüfen

---

## 📈 Best Practices

### 1. Vorbereitung
- Definieren Sie Ziel-Branchen
- Erstellen Sie Stadt-Liste
- Legen Sie Score-Mindestgrenze fest (z.B. 60)

### 2. Suche
- Starten Sie mit 5-10 Firmen pro Branche
- Testen Sie verschiedene Keywords
- Prüfen Sie Qualität der Ergebnisse

### 3. Analyse
- Analysieren Sie alle gefundenen Firmen
- Sortieren Sie nach Score
- Fokussieren Sie auf 70+

### 4. Email
- Lesen Sie generierte Emails IMMER durch
- Passen Sie ggf. an (Kopieren → Editieren → Manuell senden)
- Oder: Direkt versenden bei guter Qualität

### 5. Follow-Up
- Notieren Sie sich versendete Emails (extern)
- Warten Sie 5-7 Tage auf Antwort
- Bei Interesse: Persönliches Follow-Up

---

## 🔐 Datenschutz

- **Gespeichert wird:**
  - Firmenname
  - Website-URL
  - Öffentliche Kontaktdaten (Impressum)
  - AI-Analyse-Ergebnisse

- **NICHT gespeichert wird:**
  - Private Daten
  - Interne Firmendaten
  - Passwörter

- **DSGVO-konform:**
  - Nur öffentlich verfügbare Daten
  - Kein Tracking
  - Keine Cookies

---

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfen Sie diese Anleitung
2. Schauen Sie in Browser-Console (F12)
3. Prüfen Sie .env Konfiguration

---

## 🎉 Viel Erfolg!

Das Kaltakquise-Tool spart Ihnen Stunden an manueller Recherche und hilft, gezielt die richtigen Firmen anzusprechen!
