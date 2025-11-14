# FIBU Belege-System - Dokumentation

## Übersicht

Das FIBU-Modul verarbeitet EK-Rechnungen (Lieferantenrechnungen), die per E-Mail als PDF-Anhänge eingehen.

## Architektur

### 1. E-Mail-Eingang & Speicherung

**Quelle**: E-Mails mit PDF-Rechnungen im Anhang

**MongoDB Collection**: `fibu_email_inbox`

**Datenstruktur**:
```javascript
{
  _id: ObjectId("..."),
  emailFrom: "lieferant@example.com",
  emailSubject: "Rechnung 12345",
  emailDate: ISODate("2025-10-15T10:30:00Z"),
  emailMessageId: "msg-unique-id",
  emailTextBody: "Email-Inhalt...",
  
  // PDF-Anhang
  filename: "rechnung_12345.pdf",
  pdfBase64: "JVBERi0xLjQK...",  // PDF als Base64
  fileSize: 245678,
  
  // Status
  status: "pending" | "processed" | "error",
  createdAt: ISODate("..."),
  processedAt: ISODate("...") | null,
  rechnungId: ObjectId("...") | null  // Verknüpfung zu fibu_ek_rechnungen
}
```

### 2. Rechnungs-Parsing & Verarbeitung

**MongoDB Collection**: `fibu_ek_rechnungen`

**Datenstruktur**:
```javascript
{
  _id: ObjectId("..."),
  
  // Rechnungsdaten (geparst aus PDF)
  lieferantName: "August Rüggeberg GmbH & Co. KG",
  rechnungsNummer: "93259096",
  rechnungsdatum: ISODate("2025-10-31T00:00:00Z"),
  gesamtBetrag: 31.31,
  nettoBetrag: 26.31,
  steuerBetrag: 5.00,
  steuersatz: 19,
  
  // FIBU-Zuordnung
  kreditorKonto: "70001" | null,      // Kreditor-Nummer (SKR04)
  aufwandskonto: "5200",              // Aufwandskonto (SKR04)
  zahlungId: ObjectId("...") | null,  // Verknüpfung zu Zahlung
  
  // Verknüpfung zum Beleg
  sourceEmailId: ObjectId("69159a41db645816d9f08f31"),  // -> fibu_email_inbox._id
  
  // Parsing-Info
  parsing: {
    method: "emergent-gemini",
    confidence: 85,
    parsedAt: ISODate("...")
  },
  
  // Qualitätssicherung
  needsManualReview: true | false,
  created_at: ISODate("...")
}
```

## Workflow

### Phase 1: E-Mail-Empfang
1. IMAP-Client holt neue E-Mails ab
2. PDF-Anhänge werden extrahiert
3. Speicherung in `fibu_email_inbox` (PDF als Base64)

### Phase 2: PDF-Parsing
1. PDF wird mit AI (Gemini) geparst
2. Extraktion von: Lieferant, Rechnungsnummer, Betrag, Datum
3. Speicherung in `fibu_ek_rechnungen` mit `sourceEmailId`-Link

### Phase 3: Zuordnung (Manuell)
Rechnungen erscheinen im **"Kreditor-Zuordnung"**-Tab wenn:
- `kreditorKonto` = null (noch kein Lieferant zugeordnet)
- ODER `gesamtBetrag` = 0 (Parsing-Fehler)

### Phase 4: Geprüfte Rechnungen
Nach Zuordnung erscheinen sie im **"EK-Rechnungen"**-Tab wenn:
- `kreditorKonto` != null (Lieferant zugeordnet)
- UND `gesamtBetrag` > 0 (Betrag vorhanden)

## API-Endpunkte

### 1. Geprüfte EK-Rechnungen anzeigen
```
GET /api/fibu/ek-rechnungen/list?from=2025-01-01&to=2025-12-31
```
**Zeigt nur**: Rechnungen mit Kreditor UND Betrag > 0

### 2. Rechnungen für Zuordnung
```
GET /api/fibu/zuordnung/ek-liste?from=2025-01-01&to=2025-12-31
```
**Zeigt nur**: Rechnungen ohne Kreditor ODER Betrag = 0

### 3. PDF-Beleg anzeigen
```
GET /api/fibu/beleg/:sourceEmailId
```
**Beispiel**: `/api/fibu/beleg/69159a41db645816d9f08f31`

**Response**: PDF-Datei (Content-Type: application/pdf)

## Datenfilterung

### Automatisch ausgeschlossen:
- **SCORE Handels GmbH** (eigene Firma)
- **Amazon Payment** (sind VK-Rechnungen, keine EK)
- **eBay Managed Payments** (sind VK-Rechnungen, keine EK)
- **Duplikate** (gleicher Lieferant + RgNr + Betrag + Datum)

### Qualitätssicherung:
- Rechnungen mit Betrag = 0€ bleiben in Zuordnung
- Rechnungen ohne Kreditor bleiben in Zuordnung
- Erst nach manueller Prüfung erscheinen sie in "EK-Rechnungen"

## Implementierte Features

✅ **E-Mail-Import**: PDFs aus E-Mails automatisch speichern
✅ **AI-Parsing**: Automatische Extraktion mit Gemini
✅ **Duplikate-Check**: Verhindert doppelte Erfassung
✅ **Datenfilterung**: SCORE und fehlerhafte Einträge raus
✅ **Beleg-Anzeige**: PDF per API abrufbar
✅ **2-Phasen-System**: Zuordnung → Geprüfte Rechnungen

## Nächste Schritte (geplant)

🔲 Edit-Funktion für Zuordnungs-Tab
🔲 Beleg-Anzeige in UI integrieren
🔲 "Zurück in Zuordnung"-Button für EK-Rechnungen Tab
🔲 Automatische Kreditor-Erkennung für bekannte Lieferanten
