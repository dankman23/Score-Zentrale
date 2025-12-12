export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { getMssqlPool } from '@/lib/db/mssql'
import { detectB2B, determinePrimaryChannel, calculateOrderFrequency } from '@/lib/customer-intelligence'

/**
 * POST /api/coldleads/jtl-customers/sync-daily
 * Täglicher Sync: Nur JTL-Daten aktualisieren, REST bleibt unberührt
 * 
 * WICHTIG: Löscht NIE Kunden, nur Updates!
 * Erhält: warm_aquise_score, custom_notes, alle manuellen Daten
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('[JTL-Sync] Starting daily sync...')
    
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    
    // Lade ALLE Kunden aus JTL-Wawi mit aktuellen Daten
    const pool = await getMssqlPool()
    
    // Lade Kunden mit Bestell-Statistiken
    // Umsatz über Verkauf.tAuftragPosition berechnen (NETTO)
    const result = await pool.request().query(`
      SELECT 
        k.kKunde,
        a.cFirma,
        a.cVorname,
        a.cName as cNachname,
        a.cStrasse,
        a.cPLZ,
        a.cOrt,
        a.cLand,
        a.cTel,
        a.cFax,
        a.cMail as cEMail,
        k.cWWW,
        k.dErstellt,
        -- Umsatz über Auftragspositionen (NETTO)
        ISNULL(SUM(op.fAnzahl * op.fVKNetto), 0) as nUmsatzGesamt,
        COUNT(DISTINCT o.kAuftrag) as nAnzahlBestellungen,
        MAX(o.dErstellt) as dLetzteBestellung,
        MIN(o.dErstellt) as dErsteBestellung
      FROM tKunde k
      LEFT JOIN tAdresse a ON a.kKunde = k.kKunde AND a.nStandard = 1
      LEFT JOIN Verkauf.tAuftrag o ON o.kKunde = k.kKunde 
        AND (o.nStorno IS NULL OR o.nStorno = 0)
        AND o.cAuftragsNr LIKE 'AU%'
      LEFT JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
        AND op.kArtikel > 0
      WHERE 
        1=1  -- Alle Kunden
        -- Uncomment für schnelleren Test: AND k.kKunde < 101000
      GROUP BY 
        k.kKunde, a.cFirma, a.cVorname, a.cName, a.cStrasse, a.cPLZ, a.cOrt, a.cLand, 
        a.cTel, a.cFax, a.cMail, k.cWWW, k.dErstellt
      ORDER BY nUmsatzGesamt DESC
    `)
    
    const jtlCustomers = result.recordset
    console.log(`[JTL-Sync] Loaded ${jtlCustomers.length} customers from JTL`)
    
    let updated = 0
    let newCustomers = 0
    let unchanged = 0
    
    for (const customer of jtlCustomers) {
      // Normalisiere Website-URL
      let website = customer.cWWW
      if (website) {
        website = website.trim()
        if (!website.startsWith('http')) {
          website = 'https://' + website
        }
      }
      
      // B2B-Erkennung
      const b2bResult = detectB2B(customer)
      
      // Lade Bestellungen für Kanal-Analyse & Hauptartikel (alle Bestellungen)
      let channelData = { primary: 'unknown', channels: [] }
      let orderFrequency = 0
      let lastOrderChannel = 'unknown'
      let hauptartikel = null
      
      try {
        // Bestellungen laden (aus Verkauf.tAuftrag mit JOINs)
        const ordersResult = await pool.request()
          .input('kKunde', customer.kKunde)
          .query(`
            SELECT
              o.kAuftrag,
              o.cAuftragsNr,
              ISNULL(z.cName, '') as cZahlungsart,
              ISNULL(v.cName, '') as cVersandart,
              o.dErstellt
            FROM Verkauf.tAuftrag o
            LEFT JOIN tZahlungsart z ON z.kZahlungsart = o.kZahlungsart
            LEFT JOIN tVersandart v ON v.kVersandArt = o.kVersandArt
            WHERE o.kKunde = @kKunde
              AND (o.nStorno IS NULL OR o.nStorno = 0)
              AND o.cAuftragsNr LIKE 'AU%'
            ORDER BY o.dErstellt DESC
          `)
        
        const orders = ordersResult.recordset
        
        if (orders.length > 0) {
          // Kanal-Analyse
          channelData = determinePrimaryChannel(orders)
          
          // Kanal der LETZTEN Bestellung (wichtig für Spalte!)
          const lastOrder = orders[0]
          const channelCheck = determinePrimaryChannel([lastOrder])
          lastOrderChannel = channelCheck.primary
          
          // Bestell-Frequenz berechnen
          if (customer.dErsteBestellung && customer.dLetzteBestellung && customer.nAnzahlBestellungen > 0) {
            orderFrequency = calculateOrderFrequency(
              new Date(customer.dErsteBestellung),
              new Date(customer.dLetzteBestellung),
              customer.nAnzahlBestellungen
            )
          }
          
          // Hauptartikel bestimmen (meist gekaufte Produktkategorie)
          // Sucht nach bekannten Produktkategorien im Artikelnamen (z.B. Schleifscheibe, Fächerscheibe, etc.)
          try {
            const produkteResult = await pool.request()
              .input('kKunde', customer.kKunde)
              .query(`
                WITH Produktnamen AS (
                  SELECT 
                    ab.cName as produktname,
                    SUM(op.fAnzahl * op.fVKNetto) as umsatz
                  FROM Verkauf.tAuftrag o
                  INNER JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
                  INNER JOIN tArtikel art ON art.kArtikel = op.kArtikel
                  INNER JOIN tArtikelBeschreibung ab ON ab.kArtikel = art.kArtikel
                    AND ab.kSprache = 1
                  WHERE o.kKunde = @kKunde
                    AND (o.nStorno IS NULL OR o.nStorno = 0)
                    AND o.cAuftragsNr LIKE 'AU%'
                    AND op.kArtikel > 0
                    AND ab.cName IS NOT NULL
                  GROUP BY ab.cName
                ),
                KategorienMatch AS (
                  SELECT 
                    CASE 
                      WHEN produktname LIKE '%Schleifscheibe%' THEN 'Schleifscheibe'
                      WHEN produktname LIKE '%Fächerscheibe%' THEN 'Fächerscheibe'
                      WHEN produktname LIKE '%Trennscheibe%' THEN 'Trennscheibe'
                      WHEN produktname LIKE '%Schleifband%' THEN 'Schleifband'
                      WHEN produktname LIKE '%Schleifbänder%' THEN 'Schleifband'
                      WHEN produktname LIKE '%Fräser%' THEN 'Fräser'
                      WHEN produktname LIKE '%Bohrer%' THEN 'Bohrer'
                      WHEN produktname LIKE '%Schleifpapier%' THEN 'Schleifpapier'
                      WHEN produktname LIKE '%Vlies%' THEN 'Vlies'
                      WHEN produktname LIKE '%Polierscheibe%' THEN 'Polierscheibe'
                      WHEN produktname LIKE '%Fächerschleifscheibe%' THEN 'Fächerscheibe'
                      WHEN produktname LIKE '%Fiberscheibe%' THEN 'Fiberscheibe'
                      WHEN produktname LIKE '%Schruppscheibe%' THEN 'Schruppscheibe'
                      WHEN produktname LIKE '%Lamellenscheibe%' THEN 'Lamellenscheibe'
                      ELSE NULL
                    END as kategorie,
                    umsatz
                  FROM Produktnamen
                )
                SELECT TOP 1 kategorie, SUM(umsatz) as total_umsatz
                FROM KategorienMatch
                WHERE kategorie IS NOT NULL
                GROUP BY kategorie
                ORDER BY total_umsatz DESC
              `)
            
            if (produkteResult.recordset.length > 0) {
              hauptartikel = produkteResult.recordset[0].kategorie
            }
          } catch (produktError) {
            console.error(`[JTL-Sync] Fehler beim Laden der Hauptkategorie:`, produktError.message)
          }
        }
      } catch (orderError) {
        console.error(`[JTL-Sync] Fehler beim Laden der Bestellungen für kKunde ${customer.kKunde}:`, orderError.message)
      }
      
      // Prüfe ob Kunde in MongoDB existiert
      const existingProspect = await prospectsCollection.findOne({
        'jtl_customer.kKunde': customer.kKunde
      })
      
      // JTL-Daten zusammenstellen
      const jtlData = {
        kKunde: customer.kKunde,
        firma: customer.cFirma,
        vorname: customer.cVorname,
        nachname: customer.cNachname,
        strasse: customer.cStrasse,
        plz: customer.cPLZ,
        ort: customer.cOrt,
        land: customer.cLand,
        telefon: customer.cTel,
        fax: customer.cFax,
        email: customer.cEMail,
        website: customer.cWWW,
        erstellt: customer.dErstellt,
        umsatzGesamt: customer.nUmsatzGesamt,
        anzahlBestellungen: customer.nAnzahlBestellungen,
        ersteBestellung: customer.dErsteBestellung,
        letzteBestellung: customer.dLetzteBestellung
      }
      
      if (existingProspect) {
        // UPDATE: Nur JTL-Felder, REST unberührt!
        const updateResult = await prospectsCollection.updateOne(
          { 'jtl_customer.kKunde': customer.kKunde },
          { 
            $set: {
              // JTL-Stammdaten
              'jtl_customer': jtlData,
              'company_name': customer.cFirma,
              'website': website || existingProspect.website,
              'email': customer.cEMail || existingProspect.email,
              
              // Neu: B2B-Klassifizierung
              'is_b2b': b2bResult.is_b2b,
              'b2b_confidence': b2bResult.confidence,
              'b2b_indicators': b2bResult.indicators,
              
              // Neu: Kanal-Zuordnung
              'primary_channel': channelData.primary,
              'channels': channelData.channels,
              'last_order_channel': lastOrderChannel,
              
              // Neu: Hauptartikel
              'hauptartikel': hauptartikel,
              
              // Neu: Statistiken
              'stats.total_orders': customer.nAnzahlBestellungen || 0,
              'stats.total_revenue': customer.nUmsatzGesamt || 0,
              'stats.avg_order_value': customer.nAnzahlBestellungen > 0 
                ? (customer.nUmsatzGesamt || 0) / customer.nAnzahlBestellungen 
                : 0,
              'stats.first_order': customer.dErsteBestellung,
              'stats.last_order': customer.dLetzteBestellung,
              'stats.order_frequency': orderFrequency,
              
              'updated_at': new Date(),
              'last_jtl_sync': new Date()
            }
            // WICHTIG: warm_aquise_score, analysis_v3, email_sequence NICHT touched!
          }
        )
        
        if (updateResult.modifiedCount > 0) {
          updated++
        } else {
          unchanged++
        }
      } else {
        // NEU: Kunde existiert noch nicht in MongoDB
        const region = customer.cLand === 'AT' ? 'Österreich' : 
                      customer.cLand === 'CH' ? 'Schweiz' : 'Deutschland'
        
        // PRÜFUNG: War dieser Kunde vorher im Kaltakquise-Tool?
        // Prüfe über Email, Website oder Firma-Name
        let wasContacted = false
        let previousProspect: any = null
        let conversionSource = null
        
        try {
          // Suche nach matching Prospects (status=contacted oder analyzed)
          const matchQuery: any[] = []
          
          if (customer.cEMail) {
            matchQuery.push({ 'analysis_v3.contact_person.email': customer.cEMail })
            matchQuery.push({ email: customer.cEMail })
          }
          
          if (website) {
            matchQuery.push({ website: website })
          }
          
          if (customer.cFirma) {
            // Name-Matching (case-insensitive, ähnlich)
            matchQuery.push({ 
              company_name: { 
                $regex: customer.cFirma.trim(), 
                $options: 'i' 
              } 
            })
          }
          
          if (matchQuery.length > 0) {
            previousProspect = await prospectsCollection.findOne({
              $or: matchQuery,
              status: { $in: ['contacted', 'analyzed', 'replied', 'new'] }
            })
            
            if (previousProspect) {
              wasContacted = true
              conversionSource = 'coldleads'
              console.log(`[JTL-Sync] 🎉 CONVERSION! ${customer.cFirma} war vorher kontaktiert (${previousProspect.status})`)
            }
          }
        } catch (matchError: any) {
          console.error('[JTL-Sync] Error checking previous contact:', matchError.message)
        }
        
        // Wenn Kunde vorher kontaktiert wurde: UPDATE statt INSERT
        if (wasContacted && previousProspect) {
          // Update den vorhandenen Prospect zu "customer" 
          await prospectsCollection.updateOne(
            { _id: previousProspect._id },
            {
              $set: {
                status: 'customer',
                customer_source: 'jtl',
                converted_from_coldleads: true,
                conversion_date: new Date(),
                previous_status: previousProspect.status,
                jtl_customer: jtlData,
                
                // Behalte alle anderen Daten vom Prospect
                company_name: customer.cFirma,
                website: website || previousProspect.website,
                email: customer.cEMail || previousProspect.email,
                
                // Statistiken (vereinfacht)
                'stats.total_orders': customer.nAnzahlBestellungen || 0,
                'stats.total_revenue': customer.nUmsatzGesamt || 0,
                
                updated_at: new Date(),
                last_jtl_sync: new Date()
              }
            }
          )
          
          newCustomers++
        } else {
          // INSERT: Komplett neuer Kunde (kein Match in Kaltakquise)
          await prospectsCollection.insertOne({
            company_name: customer.cFirma,
            website: website || null,
            status: 'customer',
            customer_source: 'jtl',
          region: region,
          industry: null,
          score: null,
          
          jtl_customer: jtlData,
          
          autopilot_skip: true,
          email: customer.cEMail,
          
          // Platzhalter für später hinzugefügte Daten
          warm_aquise_score: null,
          custom_notes: null,
          
          history: [],
          hasReply: false,
          lastReplyAt: null,
          
          imported_from_jtl: true,
          imported_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          last_jtl_sync: new Date()
        })
        
        newCustomers++
      }
    }
    // Ende des else-Blocks (Zeile 268)
    
    const duration = Date.now() - startTime
    
    console.log(`[JTL-Sync] ✅ Complete in ${duration}ms`)
    console.log(`[JTL-Sync] New: ${newCustomers}, Updated: ${updated}, Unchanged: ${unchanged}`)
    
    return NextResponse.json({
      ok: true,
      new_customers: newCustomers,
      updated: updated,
      unchanged: unchanged,
      total: jtlCustomers.length,
      duration: duration
    })
  } catch (error: any) {
    console.error('[JTL-Sync] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Sync fehlgeschlagen'
    }, { status: 500 })
  }
}
}
