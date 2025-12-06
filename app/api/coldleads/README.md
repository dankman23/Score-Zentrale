# Coldleads API - Übersicht & Migration Guide

## ✅ Aktuelle APIs (in Verwendung)

### Analyzer
| Endpoint | Status | Verwendung | Empfehlung |
|----------|--------|------------|------------|
| `/analyze-v3` | ✅ **Recommended** | Neueste Version mit Glossar | **Nutzen für neue Features** |
| `/analyze-deep` | ✅ Active | Verwendet von Autopilot + Frontend | OK für bestehenden Code |
| `/analyze` | ⚠️ **DEPRECATED** | Veraltet, gibt 410 zurück | **Migrieren zu V3** |

### Email
| Endpoint | Status | Verwendung |
|----------|--------|------------|
| `/email-v3/send` | ✅ Recommended | 3-Mail-Sequenz + Follow-ups |
| `/generate-email` | ✅ Active | Legacy Email-Generator |
| `/email` | ⚠️ Check | Legacy Send |

### DACH-Crawler
| Endpoint | Status | Verwendung |
|----------|--------|------------|
| `/dach/crawl` | ✅ Active | Systematische Firmensuche |
| `/dach/stats` | ✅ Active | Crawler-Statistiken |
| `/dach/status` | ✅ Active | Fortschritt |

### Autopilot
| Endpoint | Status | Verwendung |
|----------|--------|------------|
| `/autopilot/start` | ✅ Active | Start mit Limit |
| `/autopilot/stop` | ✅ Active | Stop |
| `/autopilot/status` | ✅ Active | Status + Metrics |
| `/autopilot/tick` | ✅ Active | Worker-Trigger (60s) |

### Prospects
| Endpoint | Status | Verwendung |
|----------|--------|------------|
| `/search` | ✅ Active | Filter + Pagination |
| `/stats` | ✅ Active | Statistiken |
| `/delete` | ✅ Active | Löschen |
| `/inbox` | ✅ Active | Antworten |
| `/postausgang` | ✅ Active | Gesendete Mails |

### Follow-ups
| Endpoint | Status | Verwendung |
|----------|--------|------------|
| `/followup/auto` | ✅ Active | Automatische Follow-ups |
| `/followup/check` | ✅ Active | Fällige Follow-ups |

## 🔄 Migration Guide: analyze → analyze-v3

### Alte API (DEPRECATED)
```typescript
POST /api/coldleads/analyze
{
  "website": "https://firma.de",
  "industry": "Metallbau"
}

// Response:
{
  "ok": true,
  "analysis": {
    "company_info": {...},
    "contact_persons": [...]
  }
}
```

### Neue API (V3)
```typescript
POST /api/coldleads/analyze-v3
{
  "website": "https://firma.de",
  "firmenname": "Firma GmbH",
  "branche": "Metallbau",
  "prospectId": "optional-id"
}

// Response:
{
  "ok": true,
  "analysis": {
    "company": "Firma GmbH",
    "url": "https://firma.de",
    "branch_guess": ["Metallverarbeitung"],
    "materials": [{ term: "Edelstahl", evidence: "..." }],
    "applications": [{ term: "Schleifen", evidence: "..." }],
    "contact_person": {
      "name": "Max Mustermann",
      "email": "max@firma.de",
      "role": "Geschäftsführer",
      "confidence": 0.8
    },
    "confidence_overall": 85,
    "recommended_brands": ["Klingspor", "3M", "Norton"]
  }
}
```

## 📝 Changelog

### 2025-12-05 - Cleanup & Deprecation
- ⚠️ `/analyze` als DEPRECATED markiert (HTTP 410)
- ✅ `/analyze-v3` als recommended deklariert
- ✅ `/analyze-deep` bleibt aktiv (Autopilot-Kompatibilität)
- ✅ Dokumentation erstellt

### Geplant
- [ ] `/email` und `/generate-email` konsolidieren
- [ ] Service-Layer vereinheitlichen
- [ ] Testing-Suite für alle APIs
