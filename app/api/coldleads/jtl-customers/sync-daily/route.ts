export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../app/lib/api'
import { getMssqlPool } from '../../../../../app/lib/db/mssql'

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
    
    const result = await pool.request().query(`
      SELECT 
        k.kKunde,
        k.cFirma,
        k.cAnrede,
        k.cVorname,
        k.cNachname,
        k.cStrasse,
        k.cPLZ,
        k.cOrt,
        k.cLand,
        k.cTel,
        k.cMobil,
        k.cFax,
        k.cMail as cEmail,
        k.cWWW as cHomepage,
        k.cUSTID,
        k.dErstellt,
        ISNULL(SUM(r.fGesamtsumme), 0) as nUmsatzGesamt,
        COUNT(DISTINCT r.kRechnung) as nAnzahlRechnungen,
        MAX(r.dErstellt) as dLetzteRechnung
      FROM tKunde k
      LEFT JOIN tRechnung r ON r.kKunde = k.kKunde AND r.cStatus != 'storno'
      WHERE 
        k.nRegistriert = 1
        AND k.cFirma IS NOT NULL
        AND k.cFirma != ''
      GROUP BY 
        k.kKunde, k.cFirma, k.cAnrede, k.cVorname, k.cNachname,
        k.cStrasse, k.cPLZ, k.cOrt, k.cLand, k.cTel, k.cMobil,
        k.cFax, k.cMail, k.cWWW, k.cUSTID, k.dErstellt
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
        fax: customer.cFax,
        email: customer.cEmail,
        ustid: customer.cUSTID,
        erstellt: customer.dErstellt,
        umsatzGesamt: customer.nUmsatzGesamt,
        anzahlRechnungen: customer.nAnzahlRechnungen,
        letzteRechnung: customer.dLetzteRechnung
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
              'updated_at': new Date(),
              'last_jtl_sync': new Date()
            }
            // WICHTIG: warm_aquise_score, custom_notes, etc. NICHT touched!
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
