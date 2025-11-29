# Autopilot System - Technische Dokumentation

## Übersicht

Der Kaltakquise-Autopilot ist ein vollautomatisches System, das **unabhängig vom Frontend** im Hintergrund läuft und kontinuierlich:
1. Neue Firmen sucht
2. Diese analysiert
3. Personalisierte E-Mails versendet

## Architektur

### Backend Worker (NEU)
- **Datei:** `/app/scripts/autopilot-worker.js`
- **Prozess-Manager:** Supervisor
- **Konfiguration:** `/etc/supervisor/conf.d/autopilot-worker.conf`
- **Logs:** `/var/log/supervisor/autopilot-worker.out.log`

Der Worker ist ein eigenständiger Node.js-Prozess, der:
- Alle **60 Sekunden** automatisch läuft
- Den `/api/coldleads/autopilot/tick` Endpoint aufruft
- **Unabhängig** davon läuft, ob jemand auf der Website ist
- Überlappende Ticks verhindert
- Alle 10 Minuten einen Health Check loggt

### API Endpoint
- **Endpoint:** `POST /api/coldleads/autopilot/tick`
- **Datei:** `/app/app/api/coldleads/autopilot/tick/route.ts`
- **Timeout:** 60 Sekunden (kann länger dauern bei Firmensuche)

### Frontend (Optional)
- Das Frontend zeigt den aktuellen Status an
- Frontend-Polling ist **nicht mehr** der Trigger für den Autopilot
- Es dient nur noch zur Anzeige des aktuellen Status

## Workflow

```
┌─────────────────────────────────────────────────────────┐
│ Autopilot Worker (alle 60s)                             │
├─────────────────────────────────────────────────────────┤
│ 1. Prüfe: Ist Autopilot aktiv?                          │
│    ├─ Nein → Skip                                       │
│    └─ Ja → Weiter                                       │
│                                                          │
│ 2. Prüfe: Limit erreicht?                               │
│    ├─ Ja → Skip                                         │
│    └─ Nein → Weiter                                     │
│                                                          │
│ 3. Suche nächsten Prospect mit E-Mail                   │
│    ├─ Gefunden → Weiter zu Schritt 5                   │
│    └─ Nicht gefunden → Weiter zu Schritt 4             │
│                                                          │
│ 4. Suche neue Firmen                                    │
│    ├─ Crawle DACH-Datenbank                            │
│    ├─ Analysiere alle gefundenen Firmen                │
│    └─ Zurück zu Schritt 3                              │
│                                                          │
│ 5. Sende E-Mail an Prospect                             │
│    ├─ Generiere personalisierte E-Mail                 │
│    ├─ Versende via SMTP                                 │
│    ├─ Plane Follow-ups (Tag 3 & Tag 7)                 │
│    └─ Update Counter                                    │
│                                                          │
│ 6. Warte 60 Sekunden → Zurück zu Schritt 1             │
└─────────────────────────────────────────────────────────┘
```

## Fehlerbehandlung

### Robuste JSON-Parsing
Alle API-Aufrufe sind mit Try-Catch geschützt:
- Search API (`/api/coldleads/dach/crawl`)
- Analyze API (`/api/coldleads/analyze-deep`)
- Email API (`/api/coldleads/email-v3/send`)

Bei JSON-Parse-Fehlern:
1. Fehler wird geloggt mit den ersten 200 Zeichen der Antwort
2. Prospect wird als `autopilot_skip: true` markiert (wird nicht mehr versucht)
3. System macht mit nächstem Prospect weiter (kein Crash)

### Überlappende Ticks
Der Worker verhindert überlappende Ticks mit einem `isProcessing`-Flag:
- Wenn ein Tick länger als 60s dauert, wird der nächste übersprungen
- Log: `Previous tick still processing, skipping...`

### E-Mail-Versand-Fehler
Bei fehlgeschlagenen E-Mails:
1. Prospect wird mit `autopilot_skip: true` markiert
2. Fehler wird in `email_error` gespeichert
3. System macht mit nächstem Prospect weiter

## Verwaltung

### Status prüfen
```bash
sudo supervisorctl status autopilot-worker
```

### Worker neu starten
```bash
sudo supervisorctl restart autopilot-worker
```

### Logs anschauen (Live)
```bash
tail -f /var/log/supervisor/autopilot-worker.out.log
```

### Logs anschauen (Letzte 100 Zeilen)
```bash
tail -n 100 /var/log/supervisor/autopilot-worker.out.log
```

### Worker stoppen
```bash
sudo supervisorctl stop autopilot-worker
```

### Worker starten
```bash
sudo supervisorctl start autopilot-worker
```

## Log-Ausgaben

### Tick Start
```
[Autopilot Worker] ====== TICK #1 ====== 2025-11-29T09:44:03.426Z
```

### Autopilot inaktiv
```
[Autopilot Worker] ⏸️  Autopilot nicht aktiv
[Autopilot Worker] Tick completed in 156ms
```

### Limit erreicht
```
[Autopilot Worker] 🛑 Limit erreicht: 500/500
[Autopilot Worker] Tick completed in 234ms
```

### E-Mail versendet
```
[Autopilot Worker] ✅ Email versendet: Firma XYZ GmbH
[Autopilot Worker]    Count: 42/500
[Autopilot Worker]    Duration: 13745ms
[Autopilot Worker] Tick completed in 13813ms
```

### Firmensuche
```
[Autopilot Worker] 🔍 Keine neuen Firmen gefunden
[Autopilot Worker] Tick completed in 3421ms
```

### Keine E-Mail gefunden
```
[Autopilot Worker] 📧 Firmen analysiert, aber keine E-Mail gefunden
[Autopilot Worker] Tick completed in 64751ms
```

### E-Mail fehlgeschlagen
```
[Autopilot Worker] ⚠️  Email fehlgeschlagen: Firma XYZ GmbH
[Autopilot Worker]    Fehler: SMTP connection timeout
[Autopilot Worker] Tick completed in 5234ms
```

### Fehler
```
[Autopilot Worker] ❌ Fehler: Connection refused
[Autopilot Worker] Tick completed in 123ms
```

### Health Check (alle 10 Minuten)
```
[Autopilot Worker] ❤️  Health Check:
[Autopilot Worker]    Uptime: 2h 15m
[Autopilot Worker]    Total Ticks: 135
[Autopilot Worker]    Last Tick: 2025-11-29T11:59:03.426Z
[Autopilot Worker]    Processing: No
```

## Autopilot starten/stoppen (via API)

### Autopilot starten
```bash
curl -X POST http://localhost:3000/api/coldleads/autopilot/start \
  -H "Content-Type: application/json" \
  -d '{"dailyLimit": 500}'
```

### Autopilot stoppen
```bash
curl -X POST http://localhost:3000/api/coldleads/autopilot/stop
```

### Status abfragen
```bash
curl http://localhost:3000/api/coldleads/autopilot/status
```

## Unterschied zur vorherigen Version

### ❌ Alte Version (Frontend-Polling)
- Autopilot lief **nur**, wenn jemand auf der Seite war
- Frontend-`setInterval` triggerte alle 60s den Tick
- Bei geschlossenem Browser: **Keine E-Mails**
- Abhängig von Browser/Tab-Zustand

### ✅ Neue Version (Backend Worker)
- Autopilot läuft **24/7** im Hintergrund
- Unabhängiger Node.js-Prozess via Supervisor
- Läuft auch wenn **niemand** auf der Website ist
- Robust gegen Crashes (Supervisor startet Worker automatisch neu)
- Health Monitoring integriert

## Performance

- **Tick-Intervall:** 60 Sekunden
- **Timeout pro Tick:** 60 Sekunden (Next.js API Route)
- **Durchschnittliche Tick-Dauer:**
  - Skip/Limit: ~100-200ms
  - E-Mail versenden: ~10-15 Sekunden
  - Firmensuche + Analyse: ~60-90 Sekunden

## Deployment

Der Worker startet automatisch mit:
```bash
sudo supervisorctl restart all
```

Oder nur der Worker:
```bash
sudo supervisorctl restart autopilot-worker
```

## Troubleshooting

### Worker läuft nicht
```bash
# Status prüfen
sudo supervisorctl status autopilot-worker

# Logs prüfen
tail -n 50 /var/log/supervisor/autopilot-worker.out.log

# Worker manuell starten
sudo supervisorctl start autopilot-worker
```

### "Connection refused" Fehler
Der Next.js Server ist nicht erreichbar. Prüfen:
```bash
sudo supervisorctl status nextjs
curl http://localhost:3000/api/coldleads/autopilot/status
```

### Ticks dauern zu lang
- Normal: Firmensuche + Analyse kann 60-90s dauern
- Der Worker überspringt den nächsten Tick automatisch
- Kein Grund zur Sorge, solange Fortschritt sichtbar ist

### Keine E-Mails werden versendet
1. Prüfe Autopilot-Status: `curl http://localhost:3000/api/coldleads/autopilot/status`
2. Prüfe ob `running: true`
3. Prüfe ob Limit erreicht: `dailyCount < dailyLimit`
4. Prüfe Worker-Logs auf Fehler
5. Prüfe Next.js-Logs: `tail -n 100 /var/log/supervisor/nextjs.out.log | grep Autopilot`

## Sicherheit

- Der Worker läuft mit denselben Berechtigungen wie der Next.js-Server
- Alle API-Aufrufe gehen über localhost (keine externen Zugriffe)
- Umgebungsvariablen werden aus `.env` gelesen

## Zukunft

Mögliche Erweiterungen:
- Konfigurierbare Tick-Intervalle (z.B. 30s, 120s)
- Mehrere parallele Worker für höheren Durchsatz
- Erweiterte Metriken (Prometheus, Grafana)
- Slack/Discord-Benachrichtigungen bei Fehlern
- Automatische Pause bei zu vielen Fehlern
