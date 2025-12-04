# 📊 Analyse-Ergebnis: JTL Amazon Settlement Oktober 2025

## 📁 Bereitgestellte Dateien

1. **`/app/jtl-amazon-oktober-2025-ROHDATEN.csv`** (7.881 Zeilen)
   - Kompletter Export aller Settlement-Positionen aus JTL
   - Format: CSV mit Semikolon-Trennung
   - Felder: kMessageId, PostedDateTime, TransactionType, OrderID, MerchantOrderID, AmountType, AmountDescription, Amount, QuantityPurchased, SellerSKU, MarketplaceName, SettlementID

2. **`/app/amazon_oktober.xlsx`** (2.812 Zeilen)
   - Referenz-Datei aus dem bestehenden Jera/ADDISON-System
   - Enthält bereits aggregierte/verarbeitete Buchungen

---

## 🔍 Wichtigste Erkenntnisse

### ✅ **In JTL VORHANDENE TransactionTypes:**

| TransactionType | Anzahl Zeilen | Summe (EUR) |
|-----------------|--------------|-------------|
| **Order** | 6.160 | +59.798,48 |
| **Refund** | 239 | -2.796,74 |
| **ServiceFee** | 3 | -640,23 |
| **other-transaction** | 23 | -206,46 |
| **Chargeback Refund** | 3 | -16,13 |
| **GESAMT** | **7.881** | **55.206,53 EUR** |

### ❌ **NICHT in JTL vorhanden:**

- **Transfer / Geldtransit** - 0 Zeilen gefunden
  - Kein "Transfer" in TransactionType
  - Keine OrderIDs mit "XRE-" Präfix
  - Keine AmountDescription mit "Transfer" oder "Geldtransit"

---

## 📊 Summen-Vergleich: Excel vs. JTL-Import

### Excel-Ziel (2.812 Zeilen):
| Konto | Beschreibung | Summe (EUR) |
|-------|-------------|-------------|
| 6770 | Gebühren/Kommission | -10.304,52 |
| 69001 | Erlöse | +12.567,52 |
| 1460 | **Geldtransit** | **+7.380,00** |
| 1370 | Marketplace VAT | +13,00 |
| 148328 | Rückerstattungen | 0,00 |
| 6600 | Werbekosten | 0,00 |
| **SUMME** | | **+9.656,00** |

### Aktueller Import (2.189 Zeilen):
| Konto | Beschreibung | Summe (EUR) | Differenz |
|-------|-------------|-------------|-----------|
| 6770 | Gebühren/Kommission | -11.354,68 | ⚠️ -1.050,16 |
| 69001 | Erlöse | +70.085,96 | ❌ +57.518,44 |
| **1460** | **Geldtransit** | **0,00** | ❌ **-7.380,00** |
| 1370 | Marketplace VAT | -34,65 | ⚠️ -47,65 |
| 148328 | Rückerstattungen | -2.796,74 | ✅ NEU |
| 6600 | Werbekosten | -640,23 | ✅ NEU |
| **SUMME** | | **+55.259,66** | **+45.603,66** |

### JTL-Rohdaten (7.881 Zeilen):
| Summe | **+55.206,53 EUR** |
|-------|-------------------|

---

## 🤔 Analyse der Diskrepanzen

### 1. **Konto 1460 (Geldtransit): -7.380,00 EUR fehlen komplett**

**Erklärung:** Transfer-Transaktionen sind NICHT in der JTL-Datenbank für Oktober 2025 vorhanden.

**Mögliche Ursachen:**
- Die Excel-Datei enthält Daten aus einer **anderen Quelle** (z.B. direkt aus ADDISON oder einer manuellen Erfassung)
- Transfer-Buchungen werden **separat** oder **monatlich** gebucht, nicht täglich
- Die 7 "Geldtransit"-Zeilen in der Excel wurden **nachträglich hinzugefügt** oder stammen aus einem anderen Prozess

**Empfehlung:** 
- Klären Sie mit dem Jera/ADDISON-System, woher die 7.380 EUR "Geldtransit" kommen
- Prüfen Sie, ob diese Buchungen aus einem anderen Monat oder einer anderen Datenquelle stammen

---

### 2. **Konto 69001 (Erlöse): +57.518,44 EUR zu viel**

**Erklärung:** Die Excel zeigt nur 12.567,52 EUR Erlöse, während der Import 70.085,96 EUR zeigt.

**Verdacht:** Die Excel enthält möglicherweise:
- Nur einen **Teil der Bestellungen** (z.B. nur bestimmte Marktplätze oder Zeiträume)
- Eine **andere Aggregationslogik** (z.B. netto statt brutto, oder nach Abzug von bestimmten Posten)
- **Vorfilterung** nach bestimmten Kriterien (z.B. nur vollständig versandte Orders, nur bestimmte SKUs)

**Nächster Schritt zur Klärung:**
1. Vergleichen Sie eine **einzelne OrderID** aus der Excel mit der JTL-CSV
2. Prüfen Sie, ob die Excel vielleicht nur **Settlement-IDs** enthält, die bereits ausgezahlt wurden
3. Analysieren Sie, ob es Zeitverschiebungen gibt (PostedDateTime vs. Settlement-Datum)

---

### 3. **Konto 6770 (Gebühren): -1.050,16 EUR Differenz**

**Erklärung:** Kleinere Abweichung, könnte durch:
- Zusätzliche Gebührentypen in JTL (z.B. DigitalServicesFee, die in Excel anders zugeordnet werden)
- Rundungsdifferenzen
- "other-transaction" Positionen (Shipping label purchase = -160 EUR)

---

## 📋 TransactionType-Details aus JTL

### Order (6.160 Zeilen)
- ItemPrice/Principal: 1.298 Zeilen = +54.841,11 EUR
- ItemPrice/Tax: 1.164 Zeilen = +8.774,26 EUR
- ItemPrice/Shipping: 1.242 Zeilen = +5.595,43 EUR
- ItemPrice/ShippingTax: 1.108 Zeilen = +894,07 EUR
- ItemFees/Commission: 1.298 Zeilen = -10.135,03 EUR
- ItemFees/ShippingHB: 1.242 Zeilen = -1.016,66 EUR
- ItemFees/DigitalServicesFee: 239 Zeilen = -52,44 EUR
- ItemWithheldTax/MarketplaceFacilitatorVAT-Principal: 11 Zeilen = -26,26 EUR
- ItemWithheldTax/MarketplaceFacilitatorVAT-Shipping: 11 Zeilen = -8,39 EUR

### Refund (239 Zeilen)
- ItemPrice/Principal: 39 Zeilen = -3.104,63 EUR
- ItemPrice/Tax: 34 Zeilen = -136,06 EUR
- ItemPrice/Shipping: 30 Zeilen = -111,04 EUR
- ItemPrice/ShippingTax: 25 Zeilen = -16,16 EUR
- ItemFees/Commission: 39 Zeilen = +573,80 EUR
- ItemFees/RefundCommission: 35 Zeilen = -31,09 EUR
- ItemFees/ShippingHB: 30 Zeilen = +19,67 EUR
- ItemFees/DigitalServicesFee: 7 Zeilen = +8,77 EUR

### ServiceFee (3 Zeilen)
- Cost of Advertising/TransactionTotalAmount: 3 Zeilen = -640,23 EUR

### other-transaction (23 Zeilen)
- Shipping label purchase for return: 22 Zeilen = -160,05 EUR
- Subscription Fee: 1 Zeile = -46,41 EUR

### Chargeback Refund (3 Zeilen)
- ItemPrice/Principal: 1 Zeile = -18,91 EUR
- ItemFees/Commission: 1 Zeile = +3,47 EUR
- ItemFees/RefundCommission: 1 Zeile = -0,69 EUR

---

## 🎯 Empfohlene nächste Schritte

### Option A: Geldtransit-Quelle klären (DRINGEND)
1. **Frage:** Woher kommen die 7.380 EUR "Geldtransit" in der Excel?
2. **Prüfen:** Sind diese aus einem anderen Monat, einer anderen Datenbank oder wurden sie manuell hinzugefügt?
3. **Entscheidung:** Soll der Import diese Buchungen aus einer anderen Quelle holen oder werden sie separat gebucht?

### Option B: Erlös-Diskrepanz analysieren (WICHTIG)
1. **Vergleichen:** Eine konkrete OrderID aus der Excel mit der JTL-CSV vergleichen
2. **Prüfen:** Gibt es in der Excel einen Filter nach SettlementID oder Zeitraum?
3. **Analysieren:** Werden in der Excel vielleicht nur "ausgezahlte" Settlements berücksichtigt?

### Option C: Einzelzeilen-Vergleich (EMPFOHLEN)
1. Suchen Sie eine OrderID aus der Excel (z.B. die erste Order)
2. Vergleichen Sie diese mit den entsprechenden Zeilen in der JTL-CSV
3. So können wir verstehen, ob die Aggregationslogik oder die Datengrundlage unterschiedlich ist

---

## 📧 Nächste Aktion

Bitte teilen Sie mir mit:
1. **Woher kommen die Transfer-Buchungen?** (Konto 1460, 7.380 EUR)
2. **Soll ich eine konkrete OrderID aus der Excel mit der JTL-CSV vergleichen?**
3. **Gibt es weitere Filterkriterien in der Excel, die ich beachten muss?** (z.B. nur bestimmte SettlementIDs, nur ausgezahlte Beträge)

Sobald wir diese Punkte geklärt haben, kann ich die Logik entsprechend anpassen! 🚀
