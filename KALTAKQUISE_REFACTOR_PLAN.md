# Kaltakquise-Modul: Komplette Überarbeitung

## 🎯 Ziele
1. **Stabilität**: Robustes Error-Handling, keine Abstürze
2. **UX**: Klare Status-Anzeigen, Progress-Tracking, hilfreiches Feedback
3. **Nachhaltige Datenbank**: Vollständige Prospect-Historie, Lifecycle-Tracking
4. **JTL-Integration**: Matching mit bestehenden Kunden

## 📊 Datenbankstruktur (erweitert)

### Collection: `coldleads`
```javascript
{
  _id: "uuid",
  website: "https://...",
  company_name: "Firma GmbH",
  industry: "Metallbau",
  region: "Bayern",
  
  // Status Tracking
  status: "new" | "analyzed" | "contacted" | "customer" | "archived",
  lifecycle_stage: "prospect" | "lead" | "qualified" | "customer" | "lost",
  
  // JTL-Wawi Matching
  matched_customer_id: null | "JTL-Customer-ID",
  matched_customer_name: null | "Firmenname aus JTL",
  is_existing_customer: false | true,
  
  // Analysis Data
  analysis: {
    company_info: {...},
    needs_assessment: {...},
    contact_persons: [...]
  },
  score: 0-100,
  
  // Timestamps & Tracking
  created_at: "2025-11-07T...",
  analyzed_at: null | "2025-11-07T...",
  first_contact_at: null | "2025-11-07T...",
  last_contact_at: null | "2025-11-07T...",
  became_customer_at: null | "2025-11-07T...",
  
  // Communication History
  emails_sent: 0,
  last_email: {
    subject: "...",
    sent_at: "2025-11-07T...",
    body_preview: "..."
  },
  
  // Notes & Comments
  notes: "",
  tags: ["High Priority", "Edelstahl-Spezialist"],
  
  // Metadata
  source: "google_search" | "manual" | "import",
  search_query: "Metallbau Bayern"
}
```

## 🔧 Module-Überarbeitung

### 1. **Prospector** (Suche)
- ✅ Robustes Error-Handling
- ✅ Rate-Limiting für Google API
- ✅ Duplikate-Check vor DB-Insert
- ✅ Progress-Callbacks

### 2. **Analyzer** (Analyse)
- ✅ Try-Catch um alle Requests
- ✅ Fallback-Werte bei API-Fehlern
- ✅ Timeout-Handling (30s max)
- ✅ Partial Success (Analyse trotz fehlender Daten speichern)
- ✅ Bessere Contact-Extraction
- ✅ JTL-Customer-Matching integrieren

### 3. **Emailer** (Email-Generierung)
- ✅ Retry-Logic bei OpenAI-Fehlern
- ✅ Template-Fallback wenn AI fehlschlägt
- ✅ Email-Validation
- ✅ SMTP Error-Handling

### 4. **Customer Matcher** (NEU)
- Match Prospects mit JTL-Wawi Kunden
- Fuzzy Matching (Name-Ähnlichkeit, Domain-Check)
- Status automatisch auf "customer" setzen
- Warnung wenn Prospect bereits Kunde ist

## 🎨 UX-Verbesserungen

### UI-Komponenten
1. **Progress-Tracker**: Zeige 1/10, 2/10, etc. bei Suche
2. **Error-Anzeigen**: Freundliche Fehlermeldungen statt Alerts
3. **Loading-Skeletons**: Statt leere States
4. **Toast-Notifications**: Für Success/Error-Messages
5. **Batch-Actions**: Multiple Firmen auf einmal analysieren
6. **Export-Funktion**: CSV-Export aller Prospects
7. **Filter & Sortierung**: Nach Score, Status, Datum
8. **Quick-Actions**: Notizen hinzufügen, Status ändern

### Status-Flow
```
new → [Analysieren] → analyzed → [Email] → contacted → [Follow-up] → customer
                                                ↓
                                            archived (nicht interessiert)
```

## 🔗 JTL-Wawi Integration

### Customer Matching
1. Bei Analyse: Prüfe ob Firmenname in JTL existiert
2. Domain-Match: Extrahiere Domain aus Website, check gegen JTL-Customer-Emails
3. Fuzzy-Name-Match: 85%+ Ähnlichkeit = potentieller Match
4. UI-Warnung: "⚠️ Diese Firma könnte bereits Kunde sein: [JTL-Name]"
5. Button: "Als Kunde markieren" / "Ignorieren"

### SQL-Queries
```sql
-- Customers aus JTL
SELECT kKunde, cName, cMail, cWWW FROM tKunde WHERE nAktiv = 1
```

## 🚀 Implementierungs-Reihenfolge

1. ✅ Duplikat-Fehler beheben
2. 🔄 Analyzer stabilisieren (Error-Handling)
3. 🔄 Datenbank-Schema erweitern
4. 🔄 Customer-Matcher implementieren
5. 🔄 UI-Verbesserungen (Progress, Errors)
6. 🔄 Batch-Actions hinzufügen
7. 🔄 Export-Funktion
8. 🔄 Testing & Stabilisierung

## 📝 Notizen
- OPENAI_API_KEY muss gesetzt sein
- GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID für Suche
- SMTP-Config für Email-Versand
- MongoDB läuft bereits
