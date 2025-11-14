export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '../../../../lib/db/mssql'
import { getDb } from '../../../../lib/db/mongodb'

/**
 * Externe Rechnungen aus Rechnung.tExternerBeleg laden
 * Dies sind Amazon VCS-Lite Rechnungen (XRE-XXXXX)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0]
    const limit = parseInt(searchParams.get('limit') || '10000', 10)
    
    const pool = await getMssqlPool()
    
    const query = `
      SELECT TOP ${limit}
        eb.kExternerBeleg,
        eb.cBelegnr,
        eb.dBelegdatumUtc,
        eb.nBelegtyp,
        eb.cHerkunft,
        eb.kKunde,
        eb.cRAName,
        eb.cRALandISO,
        eb.cKaeuferUstId,
        eb.kZahlungsart,
        eb.cWaehrungISO,
        eck.fVkBrutto,
        eck.fVkNetto,
        za.cName AS zahlungsartName,
        -- KORREKTES MATCHING: Über Betrag + Datum (±1 Tag, ±0.50 EUR)
        -- Amazon Payments haben andere kBestellung IDs als kExternerBeleg!
        z.kZahlung,
        z.fBetrag AS zahlungsBetrag,
        z.dDatum AS zahlungsDatum,
        z.cHinweis AS zahlungsHinweis,
        z.kBestellung
      FROM Rechnung.tExternerBeleg eb
      LEFT JOIN Rechnung.tExternerBelegEckdaten eck ON eb.kExternerBeleg = eck.kExternerBeleg
      LEFT JOIN dbo.tZahlungsart za ON eb.kZahlungsart = za.kZahlungsart
      -- MATCHING über Betrag + Datum: Nehme die beste Übereinstimmung (kleinste Differenz)
      LEFT JOIN (
        SELECT 
          z_inner.kZahlung,
          z_inner.fBetrag,
          z_inner.dDatum,
          z_inner.cHinweis,
          z_inner.kBestellung,
          eck_inner.kExternerBeleg,
          -- Ranking: Beste Übereinstimmung = kleinste Betrag-Differenz
          ROW_NUMBER() OVER (
            PARTITION BY eck_inner.kExternerBeleg 
            ORDER BY ABS(z_inner.fBetrag - eck_inner.fVkBrutto) ASC, 
                     ABS(DATEDIFF(day, z_inner.dDatum, eb_inner.dBelegdatumUtc)) ASC
          ) as rn
        FROM Rechnung.tExternerBeleg eb_inner
        LEFT JOIN Rechnung.tExternerBelegEckdaten eck_inner ON eb_inner.kExternerBeleg = eck_inner.kExternerBeleg
        LEFT JOIN dbo.tZahlung z_inner ON 
          ABS(z_inner.fBetrag - eck_inner.fVkBrutto) <= 0.50
          AND ABS(DATEDIFF(day, z_inner.dDatum, eb_inner.dBelegdatumUtc)) <= 1
          AND z_inner.dDatum >= @from
          AND z_inner.dDatum < DATEADD(day, 2, @to)
        LEFT JOIN dbo.tZahlungsart za2_inner ON z_inner.kZahlungsart = za2_inner.kZahlungsart
        WHERE eb_inner.nBelegtyp = 0
          AND za2_inner.cName LIKE '%Amazon%'
      ) z ON z.kExternerBeleg = eb.kExternerBeleg AND z.rn = 1
      WHERE eb.dBelegdatumUtc >= @from
        AND eb.dBelegdatumUtc < DATEADD(day, 1, @to)
        AND eb.nBelegtyp = 0
      ORDER BY eb.dBelegdatumUtc DESC
    `
    
    const result = await pool.request()
      .input('from', from)
      .input('to', to)
      .query(query)
    
    // Hole zusätzlich MongoDB-Daten für erweiterte Infos
    const mongoDb = await getDb()
    const mongoCollection = mongoDb.collection('fibu_externe_rechnungen')
    const mongoRechnungen = await mongoCollection.find({}).toArray()
    const mongoMap = new Map(mongoRechnungen.map(r => [r.kExternerBeleg, r]))
    
    const rechnungen = result.recordset.map((r: any) => {
      const mongoData = mongoMap.get(r.kExternerBeleg) || {}
      
      const rechnungsBetrag = parseFloat(r.fVkBrutto || 0)
      const zahlungsBetrag = r.zahlungsBetrag ? parseFloat(r.zahlungsBetrag) : 0
      const hatZahlung = r.kZahlung > 0
      
      // WICHTIG: Externe Rechnungen (XRE-*) sind IMMER bereits bezahlt!
      // Sie kommen aus Amazon VCS-Lite und sind bereits abgewickelte Transaktionen
      const status = 'Bezahlt'
      
      return {
        kExternerBeleg: r.kExternerBeleg,
        rechnungsNr: mongoData.cRechnungsNr || r.cBelegnr || 'N/A',
        datum: r.dBelegdatumUtc,
        kunde: mongoData.cKundenName || r.cRAName || 'Unbekannt',
        kundenLand: r.cRALandISO || 'DE',
        kundenUstId: r.cKaeuferUstId || '',
        kKunde: r.kKunde,
        zahlungsart: r.zahlungsartName || 'Amazon Payment',
        waehrung: r.cWaehrungISO || 'EUR',
        brutto: rechnungsBetrag,
        betrag: rechnungsBetrag,
        netto: parseFloat(r.fVkNetto || 0),
        steuer: parseFloat((r.fVkBrutto || 0) - (r.fVkNetto || 0)),
        mwstSatz: r.fVkNetto > 0 ? parseFloat(((r.fVkBrutto - r.fVkNetto) / r.fVkNetto * 100).toFixed(2)) : 0,
        debitorKonto: mongoData.debitorKonto || null,
        sachkonto: mongoData.sachkonto || '8400',
        status: status,  // IMMER "Bezahlt"
        quelle: 'Amazon/Extern',
        
        // Zahlungsinformationen aus JTL DB (falls vorhanden)
        zahlungId: r.kZahlung || null,
        zahlungsdatum: r.zahlungsDatum || r.dBelegdatumUtc,  // Fallback auf Belegdatum
        zahlungsBetrag: hatZahlung ? zahlungsBetrag : rechnungsBetrag,  // Fallback auf Rechnungsbetrag
        zahlungsHinweis: r.zahlungsHinweis || 'Amazon VCS-Lite',
        bestellnummer: r.cBestellNr || '',
        kBestellung: r.kBestellung || r.kExternerBeleg,
        
        // Zusätzliche Infos
        betragDifferenz: hatZahlung ? Math.abs(rechnungsBetrag - zahlungsBetrag) : 0,
        vollstaendigBezahlt: true,  // Externe Rechnungen sind IMMER vollständig bezahlt
        
        // Originalfelder für MongoDB-Speicherung
        _mongoOriginal: {
          belegnummer: r.cBelegnr,
          belegdatum: r.dBelegdatumUtc,
          belegtyp: r.nBelegtyp,
          herkunft: r.cHerkunft,
          kZahlungsart: r.kZahlungsart
        }
      }
    })
    
    // MongoDB speichern (nutze mongoDb Variable von oben)
    const collection = mongoDb.collection('fibu_externe_rechnungen')
    
    for (const rechnung of rechnungen) {
      await collection.updateOne(
        { kExternerBeleg: rechnung.kExternerBeleg },
        { 
          $set: { 
            ...rechnung,
            updated_at: new Date() 
          },
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      )
    }
    
    return NextResponse.json({
      ok: true,
      rechnungen,
      total: rechnungen.length,
      zeitraum: { from, to }
    })
    
  } catch (error: any) {
    console.error('Fehler beim Laden externer Rechnungen:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
