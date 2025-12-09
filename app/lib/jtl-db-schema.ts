/**
 * JTL-Wawi Datenbank Schema & Best Practices
 * 
 * WICHTIG: Diese Datei ist die zentrale Referenz für alle Agents!
 * 
 * Offizielle Doku: https://wawi-db.jtl-software.de/tables/1.10.15.0
 * Version: 1.10.15.0
 * Letzte Aktualisierung: 2025-12-05
 * 
 * Bei JTL-Version-Wechsel:
 * 1. Neue Doku aufrufen: https://wawi-db.jtl-software.de/tables/{VERSION}
 * 2. Diese Datei aktualisieren
 * 3. VERSION_INFO unten anpassen
 */

export const VERSION_INFO = {
  current: '1.10.15.0',
  last_checked: '2025-12-05',
  documentation_url: 'https://wawi-db.jtl-software.de/tables/1.10.15.0'
}

/**
 * TABELLE: tKunde (Kunden)
 * Doku: https://wawi-db.jtl-software.de/tables/1.10.15.0/tKunde
 */
export const KUNDE_SCHEMA = {
  table: 'tKunde',
  primary_key: 'kKunde',
  columns: {
    kKunde: { type: 'INT', description: 'Kunden-ID (Primary Key)' },
    cFirma: { type: 'NVARCHAR(255)', description: 'Firmenname' },
    cAnrede: { type: 'NVARCHAR(255)', description: 'Anrede (Herr/Frau/Firma)' },
    cVorname: { type: 'NVARCHAR(255)', description: 'Vorname' },
    cNachname: { type: 'NVARCHAR(255)', description: 'Nachname' },
    cStrasse: { type: 'NVARCHAR(255)', description: 'Straße' },
    cPLZ: { type: 'NVARCHAR(10)', description: 'Postleitzahl' },
    cOrt: { type: 'NVARCHAR(255)', description: 'Ort' },
    cLand: { type: 'NVARCHAR(255)', description: 'Land (DE/AT/CH)' },
    cTel: { type: 'NVARCHAR(255)', description: 'Telefon' },
    cMobil: { type: 'NVARCHAR(255)', description: 'Mobiltelefon' },
    cMail: { type: 'NVARCHAR(255)', description: 'E-Mail' },
    cWWW: { type: 'NVARCHAR(255)', description: 'Website' },
    cUSTID: { type: 'NVARCHAR(255)', description: 'USt-IdNr (wichtig für B2B!)' },
    nIstFirma: { type: 'INT', description: '1 = Firma, 0 = Privat' },
    nRegistriert: { type: 'INT', description: '1 = Aktiv, 0 = Gelöscht' },
    dErstellt: { type: 'DATETIME', description: 'Erstellungsdatum' }
  },
  best_practice: `
    -- Aktive Kunden laden
    WHERE nRegistriert = 1
  `
}

/**
 * TABELLE: tBestellung (Bestellungen)
 * Doku: https://wawi-db.jtl-software.de/tables/1.10.15.0/tBestellung
 * 
 * ⚠️ WICHTIG: Summenfelder
 * - fBruttosumme = Gesamtsumme BRUTTO (MIT MwSt)
 * - Kein direktes "fGesamtsumme" Feld!
 * - Berechnung über Positionen erforderlich
 */
export const BESTELLUNG_SCHEMA = {
  table: 'tBestellung',
  primary_key: 'kBestellung',
  columns: {
    kBestellung: { type: 'INT', description: 'Bestellungs-ID' },
    kKunde: { type: 'INT', description: 'Kunden-ID (FK)' },
    cBestellNr: { type: 'NVARCHAR(255)', description: 'Bestellnummer' },
    cStatus: { type: 'NVARCHAR(50)', description: 'Status: offen, abgeschlossen, storno, gelöscht' },
    fBruttosumme: { type: 'DECIMAL(18,2)', description: 'Gesamtsumme BRUTTO (MIT MwSt)' },
    fWarenwert: { type: 'DECIMAL(18,2)', description: 'Warenwert NETTO' },
    cZahlungsart: { type: 'NVARCHAR(255)', description: 'Zahlungsart (PayPal, Rechnung, etc.)' },
    cVersandart: { type: 'NVARCHAR(255)', description: 'Versandart' },
    dErstellt: { type: 'DATETIME', description: 'Bestelldatum' }
  },
  best_practice: `
    -- IMMER Status-Filter verwenden!
    WHERE cStatus NOT IN ('storno', 'gelöscht')
    
    -- Umsatz über Positionen berechnen (genauer):
    SELECT 
      b.kBestellung,
      SUM(bp.fAnzahl * bp.fVKNetto) as UmsatzNetto
    FROM tBestellung b
    INNER JOIN tBestellpos bp ON bp.kBestellung = b.kBestellung
    WHERE b.cStatus NOT IN ('storno', 'gelöscht')
      AND bp.nTyp = 0  -- Nur Artikel
    GROUP BY b.kBestellung
  `,
  common_mistake: `
    ❌ fGesamtsumme  -- Existiert NICHT!
    ❌ fGesamtsummeNetto  -- Existiert NICHT!
    ✅ fBruttosumme  -- Korrekt
    ✅ SUM über Positionen -- Noch genauer
  `
}

/**
 * TABELLE: tBestellpos (Bestellpositionen)
 * Doku: https://wawi-db.jtl-software.de/tables/1.10.15.0/tBestellpos
 */
export const BESTELLPOS_SCHEMA = {
  table: 'tBestellpos',
  primary_key: 'kBestellpos',
  columns: {
    kBestellpos: { type: 'INT', description: 'Positions-ID' },
    kBestellung: { type: 'INT', description: 'Bestellungs-ID (FK)' },
    kArtikel: { type: 'INT', description: 'Artikel-ID (FK)' },
    cName: { type: 'NVARCHAR(255)', description: 'Artikelname' },
    cArtNr: { type: 'NVARCHAR(255)', description: 'Artikelnummer' },
    fAnzahl: { type: 'DECIMAL(18,2)', description: 'Menge' },
    fVKNetto: { type: 'DECIMAL(18,2)', description: 'VK-Preis NETTO pro Stück' },
    nTyp: { type: 'INT', description: '0 = Artikel, 1 = Versand, 2 = Gutschein' }
  },
  best_practice: `
    -- Nur echte Artikel, keine Versandkosten/Gutscheine
    WHERE nTyp = 0
    
    -- Umsatz berechnen:
    SUM(fAnzahl * fVKNetto) as UmsatzNetto
  `
}

/**
 * TABELLE: tArtikel (Artikel/Produkte)
 * Doku: https://wawi-db.jtl-software.de/tables/1.10.15.0/tArtikel
 */
export const ARTIKEL_SCHEMA = {
  table: 'tArtikel',
  primary_key: 'kArtikel',
  columns: {
    kArtikel: { type: 'INT', description: 'Artikel-ID' },
    cArtNr: { type: 'NVARCHAR(255)', description: 'Artikelnummer' },
    cName: { type: 'NVARCHAR(255)', description: 'Artikelname' },
    cBeschreibung: { type: 'NTEXT', description: 'Beschreibung' },
    fVKNetto: { type: 'DECIMAL(18,2)', description: 'Standard-VK NETTO' },
    fLagerbestand: { type: 'DECIMAL(18,2)', description: 'Lagerbestand' },
    cAktiv: { type: 'CHAR(1)', description: 'Y = Aktiv, N = Inaktiv' }
  },
  best_practice: `
    -- Nur aktive Artikel
    WHERE cAktiv = 'Y'
  `
}

/**
 * Helper: Korrekte Query für Kunden mit Umsatz
 */
export function getCustomersWithRevenueQuery() {
  return `
    SELECT 
      k.kKunde,
      k.cFirma,
      k.cVorname,
      k.cNachname,
      k.cMail,
      k.cUSTID,
      k.nIstFirma,
      k.dErstellt,
      -- Umsatz über Bestellpositionen (GENAUER als fBruttosumme!)
      ISNULL(SUM(bp.fAnzahl * bp.fVKNetto), 0) as nUmsatzGesamt,
      COUNT(DISTINCT b.kBestellung) as nAnzahlBestellungen,
      MAX(b.dErstellt) as dLetzteBestellung,
      MIN(b.dErstellt) as dErsteBestellung
    FROM tKunde k
    LEFT JOIN tBestellung b ON b.kKunde = k.kKunde 
      AND b.cStatus NOT IN ('storno', 'gelöscht')
    LEFT JOIN tBestellpos bp ON bp.kBestellung = b.kBestellung
      AND bp.nTyp = 0  -- Nur Artikel
    WHERE 
      k.nRegistriert = 1
    GROUP BY 
      k.kKunde, k.cFirma, k.cVorname, k.cNachname,
      k.cMail, k.cUSTID, k.nIstFirma, k.dErstellt
    ORDER BY nUmsatzGesamt DESC
  `
}

/**
 * Helper: Query für Hauptartikel eines Kunden
 */
export function getMainProductCategoryQuery() {
  return `
    SELECT TOP 1
      ISNULL(aa.cWert, 'Sonstige') as hauptkategorie,
      SUM(bp.fAnzahl * bp.fVKNetto) as umsatz
    FROM tBestellung b
    INNER JOIN tBestellpos bp ON bp.kBestellung = b.kBestellung
    INNER JOIN tArtikel a ON a.kArtikel = bp.kArtikel
    LEFT JOIN tArtikelAttribut aa ON aa.kArtikel = a.kArtikel 
      AND aa.cName = 'attr_produktkategorie'
    WHERE b.kKunde = @kKunde
      AND b.cStatus NOT IN ('storno', 'gelöscht')
      AND bp.nTyp = 0
    GROUP BY ISNULL(aa.cWert, 'Sonstige')
    ORDER BY umsatz DESC
  `
}

/**
 * WICHTIG für Agents: Diese Datei IMMER referenzieren!
 * 
 * Import in TypeScript:
 * import { getCustomersWithRevenueQuery, VERSION_INFO } from '@/lib/jtl-db-schema'
 * 
 * Vor JTL-Queries IMMER:
 * 1. Diese Datei prüfen
 * 2. Schema-Definitionen verwenden
 * 3. Best Practices befolgen
 */
