# 📡 API-Dokumentation: Kaltakquise

## Base URL
```
http://localhost:3000/api/coldleads
```

---

## 🔍 DACH-Crawler

### `POST /coldleads/dach/crawl`

Startet einen DACH-Crawl für eine spezifische Region und Branche.

**Request:**
```json
{
  "country": "DE",
  "region": "Bayern",
  "industry": "Metallbau",
  "limit": 5
}
```

**Response:**
```json
{
  "ok": true,
  "prospects": [
    {
      "id": "691cfe8064c5f5d92ea64508",
      "company_name": "Mustermann Metallbau GmbH",
      "website": "https://mustermann-metallbau.de",
      "industry": "Metallbau",
      "region": "Bayern",
      "status": "new",
      "created_at": "2024-11-18T20:00:00Z"
    }
  ],
  "count": 5,
  "stats": {
    "total_crawl_jobs": 10,
    "completed_jobs": 1,
    "total_companies_found": 50
  }
}
```

**Parameter:**
- `country` (string, required): "DE", "AT", oder "CH"
- `region` (string, required): Name der Stadt/Region
- `industry` (string, required): Branche (z.B. "Metallbau")
- `limit` (number, optional): Anzahl Firmen (default: 5, max: 50)

---

## 🔬 Deep-Analysis

### `POST /coldleads/analyze-deep`

Analysiert eine Firma mit KI.

**Request:**
```json
{
  "prospectId": "691cfe8064c5f5d92ea64508",
  "website": "https://mustermann-metallbau.de",
  "firmenname": "Mustermann Metallbau GmbH",
  "branche": "Metallbau"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "firmenname": "Mustermann Metallbau GmbH",
    "website": "https://mustermann-metallbau.de",
    "branche": "Metallbau",
    "werkstoffe": [
      {
        "name": "Stahl",
        "kontext": "Verwendet für Stahlkonstruktionen"
      },
      {
        "name": "Edelstahl",
        "kontext": "Verwendet für hochwertige Geländer"
      }
    ],
    "werkstücke": [
      {
        "name": "Geländer",
        "beschreibung": "Edelstahl-Geländersysteme"
      }
    ],
    "anwendungen": [
      "Schweißen",
      "Schleifen",
      "Entgraten"
    ],
    "kontaktpersonen": [
      {
        "name": "Max Mustermann",
        "position": "Geschäftsführer",
        "bereich": "Geschäftsführung",
        "email": "m.mustermann@firma.de",
        "telefon": "+49 89 1234567",
        "confidence": 95
      }
    ],
    "potenzielle_produkte": [
      {
        "kategorie": "Schleifbänder",
        "für_werkstoff": "Stahl",
        "für_anwendung": "Entgraten",
        "begründung": "Für saubere Schweißnähte"
      }
    ],
    "firmenprofil": "Spezialisiert auf Stahl- und Edelstahlkonstruktionen",
    "analyse_qualität": 85
  }
}
```

**Parameter:**
- `prospectId` (string, optional): Prospect-ID für DB-Update
- `website` (string, required): URL der Firmenwebsite
- `firmenname` (string, optional): Name der Firma
- `branche` (string, optional): Branche

**Dauer:** 10-20 Sekunden

---

## 📧 E-Mail-Generator

### `POST /coldleads/generate-email`

Generiert personalisierte E-Mail und optional versendet sie.

**Request:**
```json
{
  "prospectId": "691cfe8064c5f5d92ea64508",
  "kontaktpersonIndex": 0,
  "sendNow": true
}
```

**Response:**
```json
{
  "success": true,
  "email": {
    "betreff": "Schleifwerkzeuge für Ihre Stahl-Bearbeitung",
    "text": "Sehr geehrter Herr Mustermann,\n\nauf der Suche nach innovativen Metallbau-Betrieben...",
    "html": "<p>Sehr geehrter Herr Mustermann,</p>..."
  },
  "sent": true,
  "sendResult": {
    "messageId": "<abc123@mail.agenturserver.de>"
  }
}
```

**Parameter:**
- `prospectId` (string, required): Prospect-ID
- `kontaktpersonIndex` (number, optional): Index der Kontaktperson (default: 0)
- `sendNow` (boolean, optional): Sofort versenden? (default: false)

**Dauer:** 5-10 Sekunden

---

## 🤖 Autopilot

### `POST /coldleads/autopilot/start`

Startet den Autopilot.

**Request:**
```json
{
  "dailyLimit": 10
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Autopilot gestartet"
}
```

---

### `POST /coldleads/autopilot/stop`

Stoppt den Autopilot.

**Response:**
```json
{
  "ok": true,
  "message": "Autopilot gestoppt"
}
```

---

### `GET /coldleads/autopilot/status`

Gibt aktuellen Status zurück.

**Response:**
```json
{
  "ok": true,
  "state": {
    "running": true,
    "dailyLimit": 10,
    "dailyCount": 3,
    "remaining": 7,
    "totalProcessed": 150,
    "lastActivity": "2024-11-18T20:30:00Z",
    "currentPhase": "idle",
    "lastReset": "2024-11-18"
  }
}
```

**Phases:**
- `idle` - Wartet
- `searching` - Sucht Firmen
- `analyzing` - Analysiert Firmen
- `sending_email` - Versendet E-Mails
- `error` - Fehler aufgetreten

---

### `POST /coldleads/autopilot/tick`

Manuelle Tick-Ausführung (normalerweise automatisch alle 60s).

**Response:**
```json
{
  "ok": true,
  "action": "email_sent",
  "prospect": {
    "company_name": "Mustermann GmbH",
    "website": "https://mustermann.de"
  },
  "dailyCount": 4,
  "dailyLimit": 10,
  "duration": 15234
}
```

**Actions:**
- `skip` - Autopilot nicht aktiv
- `limit_reached` - Daily-Limit erreicht
- `search_no_results` - Keine Firmen gefunden
- `email_sent` - E-Mail versendet
- `email_failed` - E-Mail-Versand fehlgeschlagen
- `error` - Fehler

---

## 🔐 Authentifizierung

**Aktuell:** Keine Authentifizierung  
**TODO:** API-Keys für externe Zugriffe implementieren

---

## ⚠️ Rate Limits

**Aktuell:** Keine Rate Limits  
**Empfohlen:** 
- DACH-Crawler: Max 100 Requests/Hour
- Analyze-Deep: Max 50 Requests/Hour
- E-Mail-Generator: Max 20 Requests/Hour

**TODO:** Rate-Limiting implementieren

---

## 🐛 Error Handling

**Standard Error Response:**
```json
{
  "ok": false,
  "error": "Fehlerbeschreibung",
  "status": 500
}
```

**HTTP Status Codes:**
- `200` - OK
- `400` - Bad Request (fehlende Parameter)
- `404` - Not Found (Prospect nicht gefunden)
- `500` - Internal Server Error

---

## 📊 Webhooks

**TODO:** Webhooks für Events implementieren

**Geplante Events:**
- `prospect.analyzed` - Firma analysiert
- `email.sent` - E-Mail versendet
- `autopilot.limit_reached` - Daily-Limit erreicht
- `autopilot.error` - Fehler aufgetreten

---

## 🧪 Testing

### cURL Beispiele

**DACH-Crawler:**
```bash
curl -X POST http://localhost:3000/api/coldleads/dach/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "country": "DE",
    "region": "München",
    "industry": "Metallbau",
    "limit": 3
  }'
```

**Deep-Analysis:**
```bash
curl -X POST http://localhost:3000/api/coldleads/analyze-deep \
  -H "Content-Type: application/json" \
  -d '{
    "prospectId": "691cfe8064c5f5d92ea64508",
    "website": "https://firma.de",
    "firmenname": "Firma GmbH",
    "branche": "Metallbau"
  }'
```

**Autopilot Status:**
```bash
curl http://localhost:3000/api/coldleads/autopilot/status
```

---

**API-Dokumentation Version 1.0**  
**Letzte Aktualisierung:** 18. November 2024
