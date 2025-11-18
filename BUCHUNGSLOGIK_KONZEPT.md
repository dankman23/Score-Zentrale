# Buchungslogik für FIBU-Modul

## 📋 Anforderungen aus Screenshot-Analyse

### Erkenntnisse aus der UI:
- **Spalten:** Datum, Anbieter, Betrag, Referenz/Auftrag, Kunde, Verwendungszweck, Zuordnung, Aktion
- **Amazon-Komponenten:** Principal, Shipping, ShippingTax
- **Status:** Offen (nicht zugeordnet) → Soll zu "Zugeordnet" werden
- **Aktion:** "Zuordnen"-Button für manuelle Zuordnung

---

## 🏦 Kontenplan für Amazon-Transaktionen

### Basis-Kontenstruktur (SKR04):

#### Aktiva (Soll = Zugang):
- **1801** - PayPal-Konto (Geldtransit)
- **1815** - Amazon-Konto (Settlement-Konto)
- **1200** - Bank

#### Erlöse (Haben = Zugang):
- **69001** - Umsatzerlöse Amazon Principal (19% MwSt)
- **69012** - Umsatzerlöse PayPal (19% MwSt)  
- **69014** - Umsatzerlöse PayPal (7% MwSt)
- **4800** - Erlöse aus Versand/Shipping

#### Aufwendungen/Gebühren (Soll = Zugang):
- **6770** - Amazon Kommissionen/Marketplace-Gebühren
- **6855** - PayPal Gebühren
- **4910** - Sonstige Verkaufsgebühren

#### Steuerkonten:
- **1370** - Abziehbare Vorsteuer (wenn Steuer abgeführt durch Marketplace)
- **1576** - Umsatzsteuer 19%
- **3800** - Verbindlichkeiten aus Umsatzsteuer

---

## 📊 Buchungslogik pro Transaktionstyp

### 1. Amazon Settlement - Principal (Verkaufserlös)
**Beispiel:** +55.83€ Principal

```
Soll 1815 (Amazon-Konto)    55.83€
  Haben 69001 (Erlöse)              46.92€  (Netto)
  Haben 1576 (USt 19%)               8.91€  (MwSt)
```

**Erklärung:**
- Amazon überweist Netto-Betrag (nach Gebühren)
- Brutto = Netto + MwSt
- Gebühren werden separat gebucht

---

### 2. Amazon Settlement - Shipping (Versanderlös)
**Beispiel:** +4.12€ Shipping

```
Soll 1815 (Amazon-Konto)    4.12€
  Haben 4800 (Versanderlöse)        3.46€  (Netto)
  Haben 1576 (USt 19%)              0.66€  (MwSt)
```

---

### 3. Amazon Settlement - ShippingTax (Marketplace Facilitator VAT)
**Beispiel:** +0.78€ ShippingTax

```
Soll 1815 (Amazon-Konto)    0.78€
  Haben 1370 (Vorsteuer)            0.78€
```

**Erklärung:**
- Amazon führt MwSt direkt ans Finanzamt ab (Marketplace Facilitator)
- Wir dürfen diese MwSt als Vorsteuer abziehen
- Konto 1370 = Abziehbare Vorsteuer

---

### 4. Amazon Settlement - Commission (Gebühren)
**Beispiel:** -8.20€ Amazon Kommission

```
Soll 6770 (Amazon Gebühren)  6.89€  (Netto)
Soll 1370 (Vorsteuer 19%)    1.31€  (MwSt)
  Haben 1815 (Amazon-Konto)          8.20€
```

**Erklärung:**
- Amazon-Gebühren sind Betriebsausgaben
- Mit 19% MwSt (Vorsteuer abziehbar)

---

### 5. Amazon Settlement - Refund (Rückerstattung)
**Beispiel:** -42.50€ Refund/ItemPrice/Principal

```
Soll 69001 (Erlöse Storno)   35.71€  (Netto)
Soll 1576 (USt 19%)           6.79€  (MwSt)
  Haben 1815 (Amazon-Konto)          42.50€
```

---

### 6. PayPal - Shop-Zahlung
**Beispiel:** RE2025-97630, +69.12€ Brutto, Gebühr -2.50€

**Buchung 1 (Zahlungseingang):**
```
Soll 1801 (PayPal-Konto)    69.12€
  Haben 69012 (Erlöse)              58.08€  (Netto)
  Haben 1576 (USt 19%)              11.04€  (MwSt)
```

**Buchung 2 (Gebühr):**
```
Soll 6855 (PayPal Gebühren)  2.10€  (Netto)
Soll 1370 (Vorsteuer 19%)    0.40€  (MwSt)
  Haben 1801 (PayPal-Konto)          2.50€
```

---

### 7. PayPal - Transfer zu Bank
**Beispiel:** "Paypal an Bank" -500.00€

```
Soll 1200 (Bank)             500.00€
  Haben 1801 (PayPal-Konto)          500.00€
```

---

### 8. PayPal - Einkauf (externe Dienste)
**Beispiel:** Shopware AG, 79.00€

```
Soll 79000 (Einkauf Dienste) 66.39€  (Netto)
Soll 1370 (Vorsteuer 19%)    12.61€  (MwSt)
  Haben 1801 (PayPal-Konto)          79.00€
```

---

## 🔄 Datenstruktur-Erweiterungen

### MongoDB Collections - Neue Felder:

```typescript
// fibu_amazon_settlements
{
  transactionId: string,
  datum: string,
  datumDate: Date,
  betrag: number,
  waehrung: string,
  
  // NEU: Buchungsinformationen
  buchung: {
    sollKonto: string,      // 1815
    habenKonto: string,     // 69001, 4800, 1370, 6770
    nettoBetrag: number,    // Betrag ohne MwSt
    mwstSatz: number,       // 19, 7, 0
    mwstBetrag: number,     // Berechnete MwSt
    bruttoBetrag: number,   // = betrag (wie in Excel)
    buchungstext: string,   // "Amazon Principal XRE-4064"
    gegenkontoTyp: string,  // "erloes", "gebuehr", "vorsteuer"
  },
  
  // Bestehende Felder
  kategorie: string,
  amountType: string,
  orderId: string,
  sku: string,
  
  // Zuordnung
  istZugeordnet: boolean,
  zugeordneteRechnung: string,  // XRE-4064
  zugeordnetesKonto: string,
  ...
}
```

```typescript
// fibu_paypal_transactions
{
  transactionId: string,
  datum: string,
  datumDate: Date,
  betrag: number,
  gebuehr: number,
  nettoBetrag: number,
  waehrung: string,
  
  // NEU: Buchungsinformationen
  buchungHaupt: {
    sollKonto: string,      // 1801
    habenKonto: string,     // 69012, 69014
    nettoBetrag: number,
    mwstSatz: number,
    mwstBetrag: number,
    bruttoBetrag: number,
    buchungstext: string,
  },
  
  buchungGebuehr: {
    sollKonto: string,      // 6855
    habenKonto: string,     // 1801
    nettoBetrag: number,
    mwstSatz: number,
    mwstBetrag: number,
    bruttoBetrag: number,   // = gebuehr
    buchungstext: string,
  },
  
  // Bestehende Felder
  rechnungsNr: string,
  kundenName: string,
  kundenEmail: string,
  
  // Zuordnung
  istZugeordnet: boolean,
  zugeordneteRechnung: string,
  ...
}
```

---

## 🎯 Automatische Kontenzuordnung

### Mapping-Regeln:

```typescript
// Amazon amountType → Konten
const amazonKontenMapping = {
  // Erlöse
  'ItemPrice': {
    sollKonto: '1815',
    habenKonto: '69001',
    mwstSatz: 19,
    typ: 'erloes'
  },
  
  // Versand
  'Shipping': {
    sollKonto: '1815',
    habenKonto: '4800',
    mwstSatz: 19,
    typ: 'erloes'
  },
  
  // Marketplace Facilitator VAT
  'MarketplaceFacilitatorVAT-Shipping': {
    sollKonto: '1815',
    habenKonto: '1370',  // Abziehbare Vorsteuer
    mwstSatz: 0,
    typ: 'vorsteuer'
  },
  
  // Gebühren
  'Commission': {
    sollKonto: '6770',
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  'FBAPerUnitFulfillmentFee': {
    sollKonto: '6770',
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  
  // Rückerstattungen
  'Refund': {
    sollKonto: '69001',  // Storno
    habenKonto: '1815',
    mwstSatz: 19,
    typ: 'storno'
  }
}

// PayPal → Konten
const paypalKontenMapping = {
  // Standard Shop-Zahlung
  'payment': {
    sollKonto: '1801',
    habenKonto: '69012',  // oder 69014 je nach MwSt
    mwstSatz: 19,
    typ: 'erloes'
  },
  
  // Gebühr
  'fee': {
    sollKonto: '6855',
    habenKonto: '1801',
    mwstSatz: 19,
    typ: 'gebuehr'
  },
  
  // Transfer
  'transfer_to_bank': {
    sollKonto: '1200',
    habenKonto: '1801',
    mwstSatz: 0,
    typ: 'transfer'
  },
  
  // Einkauf
  'purchase': {
    sollKonto: '79000',
    habenKonto: '1801',
    mwstSatz: 19,
    typ: 'einkauf'
  }
}
```

---

## 🔧 Implementierung

### API-Endpunkt: Buchungsinformationen berechnen

```typescript
// /app/api/fibu/zahlungen/berechne-buchung/route.ts
export async function POST(request: NextRequest) {
  const { zahlung, quelle } = await request.json()
  
  let buchung = null
  
  if (quelle === 'Amazon') {
    const mapping = amazonKontenMapping[zahlung.amountType]
    
    if (mapping) {
      const bruttoBetrag = Math.abs(zahlung.betrag)
      const nettoBetrag = bruttoBetrag / (1 + mapping.mwstSatz / 100)
      const mwstBetrag = bruttoBetrag - nettoBetrag
      
      buchung = {
        sollKonto: mapping.sollKonto,
        habenKonto: mapping.habenKonto,
        nettoBetrag: parseFloat(nettoBetrag.toFixed(2)),
        mwstSatz: mapping.mwstSatz,
        mwstBetrag: parseFloat(mwstBetrag.toFixed(2)),
        bruttoBetrag: bruttoBetrag,
        buchungstext: `Amazon ${zahlung.amountType} ${zahlung.orderId}`,
        gegenkontoTyp: mapping.typ
      }
    }
  }
  
  else if (quelle === 'PayPal') {
    const bruttoBetrag = Math.abs(zahlung.betrag)
    const nettoBetrag = bruttoBetrag / 1.19
    const mwstBetrag = bruttoBetrag - nettoBetrag
    
    buchung = {
      hauptbuchung: {
        sollKonto: '1801',
        habenKonto: '69012',
        nettoBetrag: parseFloat(nettoBetrag.toFixed(2)),
        mwstSatz: 19,
        mwstBetrag: parseFloat(mwstBetrag.toFixed(2)),
        bruttoBetrag: bruttoBetrag,
        buchungstext: `PayPal ${zahlung.rechnungsNr}`
      }
    }
    
    // Gebühr separat
    if (zahlung.gebuehr && zahlung.gebuehr > 0) {
      const gebuehrBrutto = Math.abs(zahlung.gebuehr)
      const gebuehrNetto = gebuehrBrutto / 1.19
      const gebuehrMwst = gebuehrBrutto - gebuehrNetto
      
      buchung.gebuehrBuchung = {
        sollKonto: '6855',
        habenKonto: '1801',
        nettoBetrag: parseFloat(gebuehrNetto.toFixed(2)),
        mwstSatz: 19,
        mwstBetrag: parseFloat(gebuehrMwst.toFixed(2)),
        bruttoBetrag: gebuehrBrutto,
        buchungstext: `PayPal Gebühr ${zahlung.rechnungsNr}`
      }
    }
  }
  
  return NextResponse.json({ ok: true, buchung })
}
```

---

## 📤 Export-Format für 10it/DATEV

### CSV-Struktur:
```
Konto;Gegenkonto;Betrag;Währung;Datum;Belegnummer;Buchungstext;Steuerschlüssel
1815;69001;46.92;EUR;31.10.2025;XRE-4064;Amazon Principal Order 306-4519634;VSt19
1815;1576;8.91;EUR;31.10.2025;XRE-4064;Amazon MwSt Principal;
1815;4800;3.46;EUR;31.10.2025;XRE-4064;Amazon Shipping;VSt19
1815;1576;0.66;EUR;31.10.2025;XRE-4064;Amazon MwSt Shipping;
1815;1370;0.78;EUR;31.10.2025;XRE-4064;Amazon ShippingTax abgeführt;
```

---

## ✅ Zusammenfassung

### Was implementiert werden muss:

1. **Buchungsinformationen in Datenstruktur aufnehmen**
   - Soll-Konto, Haben-Konto
   - Netto, MwSt, Brutto
   - Buchungstext

2. **Automatische Berechnung bei Import**
   - Beim Laden von Amazon/PayPal Daten
   - Mapping über `amountType` / Transaktionstyp

3. **UI-Anzeige erweitern**
   - Zeige Gegenkonto in Tabelle
   - Zeige Buchungsvorschau bei Zuordnung
   - Export-Preview mit korrekten Konten

4. **Export-Funktion erweitern**
   - 10it/DATEV Export mit Soll/Haben
   - Korrekte MwSt-Schlüssel

### Erwartete Verbesserung:
- ✅ Klare Kontenzuordnung für jede Transaktion
- ✅ Automatische MwSt-Berechnung
- ✅ Korrekter DATEV/10it Export
- ✅ Bessere Nachvollziehbarkeit für Steuerberater
