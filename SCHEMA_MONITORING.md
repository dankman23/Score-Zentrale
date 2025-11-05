# JTL-Wawi Schema-Überwachung - Score Zentrale

## 🎯 Zweck

Die Score Zentrale ist **robust gegen JTL-Wawi DB-Schema-Änderungen** durch:
1. **Dynamische Schema-Erkennung** bei jedem Query
2. **Automatische Validierung** kritischer Komponenten
3. **Graceful Degradation** bei fehlenden Features

---

## ✅ Wie funktioniert die Robustheit?

### 1. **Dynamische Tabellen-Erkennung**

Statt hartcodiert `Verkauf.tAuftrag` zu verwenden, probiert die App mehrere Varianten:

```typescript
const candidates = ['Verkauf.tAuftrag', 'dbo.tAuftrag']
const table = await firstExistingTable(pool, candidates)
```

**Vorteil:** Funktioniert auch wenn JTL das Schema ändert.

### 2. **Spalten-Existenz-Prüfung**

Vor jedem Query prüfen wir, ob die Spalte existiert:

```typescript
const hasNStorno = await hasColumn(pool, 'Verkauf.tAuftrag', 'nStorno')
const filter = hasNStorno 
  ? 'AND (o.nStorno IS NULL OR o.nStorno = 0)' 
  : ''
```

**Vorteil:** Query bricht nicht ab wenn Spalte fehlt.

### 3. **Fallback-Werte**

Wenn eine Spalte fehlt, verwenden wir sichere Defaults:

```typescript
const qtyField = await pickFirstExisting(pool, table, 
  ['fMenge', 'nMenge', 'fAnzahl']
) || 'fMenge'  // ← Fallback
```

---

## 🔍 Health-Check-Endpoints

### `/api/health/schema` - Vollständige Validierung

Prüft alle kritischen und optionalen Komponenten:

```bash
curl http://localhost:3000/api/health/schema
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2025-11-05T21:30:00Z",
  "critical_issues": [],
  "warnings": [
    "Purchase Orders (Bestellungen): Optionale Features möglicherweise eingeschränkt"
  ],
  "details": [
    {
      "category": "Orders (Aufträge)",
      "table_found": "Verkauf.tAuftrag",
      "missing_required": [],
      "missing_optional": ["kPlattform"],
      "status": "WARNING"
    }
  ],
  "recommendations": [
    "⚠️ Optionale Features könnten eingeschränkt sein",
    "💡 Beschaffungs-Module nicht aktiviert → Expenses nicht verfügbar",
    "✅ Alle Kernfunktionen einsatzbereit"
  ]
}
```

**Status Codes:**
- `200` - Alle kritischen Features OK (Warnings erlaubt)
- `503` - Kritische Features fehlen
- `500` - DB-Verbindung fehlgeschlagen

---

## 📊 Validierte Komponenten

### **Kritisch (MUST HAVE):**

| Komponente | Tabellen | Kritische Spalten |
|------------|----------|-------------------|
| Orders | `Verkauf.tAuftrag`, `dbo.tAuftrag` | `kAuftrag`, `dErstellt` |
| Order Positions | `Verkauf.tAuftragPosition` | `kAuftrag`, `kArtikel` |
| Articles | `dbo.tArtikel` | `kArtikel` |
| Customers | `dbo.tKunde` | `kKunde` |

**Wenn diese fehlen:** ❌ Zentrale funktioniert nicht

### **Optional (NICE TO HAVE):**

| Komponente | Tabellen | 
|------------|----------|
| Invoices | `Verkauf.tRechnung` |
| Purchase Orders | `Beschaffung.tBestellung` |
| Supplier Invoices | `Einkauf.tEingangsrechnung` |

**Wenn diese fehlen:** ⚠️ Einige Features deaktiviert, Rest funktioniert

---

## 🛡️ Best Practices für neue Endpoints

### ✅ **DO:**

```typescript
// 1. Immer mehrere Tabellen-Kandidaten
const table = await firstExistingTable(pool, [
  'Verkauf.tAuftrag',
  'dbo.tAuftrag'
])

if (!table) {
  return { ok: false, error: 'Orders table not found' }
}

// 2. Spalten-Existenz prüfen
const dateField = await pickFirstExisting(pool, table, 
  ['dErstellt', 'dGeaendert', 'dDatum']
) || 'dErstellt'

// 3. Optionale Spalten graceful handlen
const hasStatus = await hasColumn(pool, table, 'cStatus')
const statusFilter = hasStatus 
  ? `AND o.cStatus != 'storno'`
  : ''

// 4. Query mit dynamischen Teilen
const query = `
  SELECT * FROM ${table}
  WHERE CAST(${dateField} AS DATE) BETWEEN @from AND @to
  ${statusFilter}
`
```

### ❌ **DON'T:**

```typescript
// 1. NIEMALS hartcodiert
const query = `SELECT * FROM Verkauf.tAuftrag WHERE cStatus != 'storno'`

// 2. NIEMALS ohne Existenz-Check
const query = `SELECT kPlattform FROM ${table}`  // kPlattform könnte fehlen!

// 3. NIEMALS ohne Fallback
const col = table.columns.find(c => c.name === 'dErstellt')
// Was wenn dErstellt nicht existiert? → FEHLER!
```

---

## 🔄 Automatische Updates

Die Schema-Validierung läuft:

1. **Bei jedem Deploy** (Pre-Flight-Check)
2. **Bei jedem Query** (dynamische Prüfung)
3. **Optional: Scheduled** (z.B. täglich um 02:00)

---

## 🚨 Monitoring & Alerts

### Empfohlene Checks:

**Production:**
```bash
# Täglich
*/10 * * * * curl -f http://localhost:3000/api/health/schema || alert

# Bei Deployment
curl -f http://localhost:3000/api/health/schema || exit 1
```

**Development:**
```bash
# Vor jedem Commit
npm run health-check
```

---

## 📝 Wartung

### Neue JTL-Version?

1. **Prüfen:**
   ```bash
   curl http://localhost:3000/api/health/schema
   ```

2. **Bei Warnings:**
   - Prüfe `details` Array
   - Update `table_candidates` in `/services/sql/validation.ts`
   - Teste neu

3. **Bei Critical Issues:**
   - JTL-Doku prüfen
   - Schema-Änderungen dokumentieren
   - Code anpassen

### Feature hinzufügen?

Füge neue Requirement in `/services/sql/validation.ts` hinzu:

```typescript
{
  category: 'Mein neues Feature',
  table_candidates: ['Schema.tNeueTabelle', 'dbo.tNeueTabelle'],
  required_columns: ['kId'],
  optional_columns: ['cName', 'dErstellt'],
  critical: false  // true wenn Feature kritisch
}
```

---

## 📞 Troubleshooting

### "Critical: Database connection failed"
→ JTL-SQL-Server nicht erreichbar (Firewall, Credentials)

### "Critical: Orders table not found"
→ JTL-Schema komplett anders (sehr unwahrscheinlich)

### "Warning: Optional columns missing"
→ Normal, Feature läuft im Fallback-Modus

---

## ✅ Garantie

**Die Score Zentrale ist robust gegen:**
- ✅ JTL-Minor-Updates (1.10.x → 1.10.y)
- ✅ Fehlende optionale Module (Beschaffung, etc.)
- ✅ Schema-Variationen (Verkauf vs dbo)
- ✅ Fehlende optionale Spalten (kPlattform, etc.)

**Bei Major-Updates (2.0+):**
- Schema-Check zeigt neue Requirements
- Anpassung innerhalb 1 Tag möglich
