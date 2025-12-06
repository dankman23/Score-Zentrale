export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../app/lib/api'
import { getMssqlPool } from '../../../../../app/lib/db/mssql'
import { detectB2B, determinePrimaryChannel, calculateOrderFrequency } from '../../../../../lib/customer-intelligence'

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
        f.cName as cFirma,
        f.cStrasse,
        f.cPLZ,
        f.cOrt,
        f.cLand,
        f.cTel,
        f.cFax,
        f.cEMail,
        f.cWWW,
        k.dErstellt,
        -- Umsatz über Auftragspositionen (NETTO)
        ISNULL(SUM(op.fAnzahl * op.fVKNetto), 0) as nUmsatzGesamt,
        COUNT(DISTINCT o.kAuftrag) as nAnzahlBestellungen,
        MAX(o.dErstellt) as dLetzteBestellung,
        MIN(o.dErstellt) as dErsteBestellung
      FROM tKunde k
      LEFT JOIN tFirma f ON f.kFirma = k.kFirma
      LEFT JOIN Verkauf.tAuftrag o ON o.kKunde = k.kKunde 
        AND (o.nStorno IS NULL OR o.nStorno = 0)
        AND o.cAuftragsNr LIKE 'AU%'
      LEFT JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
        AND op.kArtikel > 0
      WHERE 
        k.nRegistriert = 1
      GROUP BY 
        k.kKunde, f.cName, f.cStrasse, f.cPLZ, f.cOrt, f.cLand, 
        f.cTel, f.cFax, f.cEMail, f.cWWW, k.dErstellt
      ORDER BY nUmsatzGesamt DESC
    `)
    
    const jtlCustomers = result.recordset
    console.log(`[JTL-Sync] Loaded ${jtlCustomers.length} customers from JTL`)
    
    let updated = 0
    let newCustomers = 0
    let unchanged = 0
    
    for (const customer of jtlCustomers) {
      // Normalisiere Website-URL
      let website = customer.cHomepage
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
        // Bestellungen laden (aus Verkauf.tAuftrag)
        const ordersResult = await pool.request()
          .input('kKunde', customer.kKunde)
          .query(`
            SELECT
              o.kAuftrag,
              o.cAuftragsNr,
              o.cZahlungsart,
              o.cVersandart,
              o.fGesamtsumme,
              o.dErstellt
            FROM Verkauf.tAuftrag o
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
          
          // Hauptartikel bestimmen (meist gekaufte Produktkategorie nach Umsatz)
          try {
            const produkteResult = await pool.request()
              .input('kKunde', customer.kKunde)
              .query(`
                SELECT TOP 1
                  ISNULL(a.cName, 'Sonstige') as hauptkategorie,
                  SUM(op.fAnzahl * op.fVKNetto) as umsatz
                FROM Verkauf.tAuftrag o
                INNER JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
                INNER JOIN tArtikel art ON art.kArtikel = op.kArtikel
                LEFT JOIN tArtikelAttribut aa ON aa.kArtikel = art.kArtikel AND aa.cName = 'Produktkategorie'
                LEFT JOIN tArtikelAttribut a ON a.kArtikel = art.kArtikel AND a.cName = 'attr_produktkategorie'
                WHERE o.kKunde = @kKunde
                  AND (o.nStorno IS NULL OR o.nStorno = 0)
                  AND o.cAuftragsNr LIKE 'AU%'
                  AND op.kArtikel > 0
                GROUP BY ISNULL(a.cName, 'Sonstige')
                ORDER BY umsatz DESC
              `)
            
            if (produkteResult.recordset.length > 0) {
              hauptartikel = produkteResult.recordset[0].hauptkategorie
            }
          } catch (produktError) {
            console.error(`[JTL-Sync] Fehler beim Laden der Produktkategorien:`, produktError.message)
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
        anrede: customer.cAnrede,
        vorname: customer.cVorname,
        nachname: customer.cNachname,
        strasse: customer.cStrasse,
        plz: customer.cPLZ,
        ort: customer.cOrt,
        land: customer.cLand,
        telefon: customer.cTel,
        mobil: customer.cMobil,
        email: customer.cEmail,
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
              'email': customer.cEmail || existingProspect.email,
              
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
          email: customer.cEmail,
          
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
