export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Minuten für großen Import

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'
import { getMssqlPool } from '@/lib/db/mssql'

/**
 * POST /api/coldleads/jtl-customers/import
 * Importiert ALLE JTL-Kunden in die MongoDB
 * Wird einmalig ausgeführt, danach nur noch Updates
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('[JTL-Import] Starting full import...')
    
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    
    // Lade ALLE Kunden aus JTL-Wawi
    const pool = await connectToMSSQLRead()
    
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
    console.log(`[JTL-Import] Loaded ${jtlCustomers.length} customers from JTL`)
    
    let imported = 0
    let updated = 0
    let skipped = 0
    
    for (const customer of jtlCustomers) {
      // Normalisiere Website-URL
      let website = customer.cHomepage
      if (website) {
        website = website.trim()
        if (!website.startsWith('http')) {
          website = 'https://' + website
        }
      }
      
      // Bestimme Region aus PLZ
      let region = 'Deutschland'
      if (customer.cLand === 'AT') region = 'Österreich'
      else if (customer.cLand === 'CH') region = 'Schweiz'
      else if (customer.cPLZ) {
        const plz = parseInt(customer.cPLZ)
        if (plz >= 10000 && plz < 20000) region = 'Berlin/Brandenburg'
        else if (plz >= 20000 && plz < 30000) region = 'Hamburg/Schleswig-Holstein'
        else if (plz >= 30000 && plz < 40000) region = 'Niedersachsen'
        else if (plz >= 40000 && plz < 50000) region = 'Nordrhein-Westfalen'
        else if (plz >= 50000 && plz < 60000) region = 'Nordrhein-Westfalen'
        else if (plz >= 60000 && plz < 70000) region = 'Hessen'
        else if (plz >= 70000 && plz < 80000) region = 'Baden-Württemberg'
        else if (plz >= 80000 && plz < 90000) region = 'Bayern'
        else if (plz >= 90000 && plz < 100000) region = 'Bayern'
      }
      
      // Prospect-Dokument erstellen
      const prospectData = {
        company_name: customer.cFirma,
        website: website || null,
        status: 'customer',
        customer_source: 'jtl', // WICHTIG: Kennzeichnet als JTL-Kunde
        region: region,
        industry: null, // Könnte später angereichert werden
        score: null,
        
        // JTL-spezifische Daten
        jtl_customer: {
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
        },
        
        // Auto-Skip für Autopilot
        autopilot_skip: true,
        
        // Kontaktperson aus JTL
        analysis_v3: website ? null : undefined, // Nur setzen wenn Website vorhanden
        email: customer.cEmail,
        
        history: [],
        hasReply: false,
        lastReplyAt: null,
        
        imported_from_jtl: true,
        imported_at: new Date(),
        updated_at: new Date()
      }
      
      // WICHTIG: Nur JTL-Felder updaten, REST UNANGETASTET LASSEN!
      // Zuerst prüfen ob Kunde bereits existiert
      const existingProspect = await prospectsCollection.findOne({
        'jtl_customer.kKunde': customer.kKunde
      })
      
      if (existingProspect) {
        // UPDATE: Nur JTL-spezifische Felder aktualisieren
        const updateResult = await prospectsCollection.updateOne(
          { 'jtl_customer.kKunde': customer.kKunde },
          { 
            $set: {
              // Nur JTL-Daten updaten
              'jtl_customer': prospectData.jtl_customer,
              'company_name': prospectData.company_name, // Name könnte sich ändern
              'website': prospectData.website || existingProspect.website, // Nur wenn neu
              'updated_at': new Date()
            }
          }
        )
        updated++
      } else {
        // INSERT: Neuer Kunde
        await prospectsCollection.insertOne({
          ...prospectData,
          created_at: new Date()
        })
        imported++
      }
      
      // Zähler wurden bereits in if/else gesetzt
    }
    
    const duration = Date.now() - startTime
    
    console.log(`[JTL-Import] ✅ Complete in ${duration}ms`)
    console.log(`[JTL-Import] Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`)
    
    return NextResponse.json({
      ok: true,
      imported: imported,
      updated: updated,
      skipped: skipped,
      total: jtlCustomers.length,
      duration: duration
    })
    
  } catch (error: any) {
    console.error('[JTL-Import] Error:', error)
    
    let errorMessage = error.message || 'Import fehlgeschlagen'
    let statusCode = 500
    
    if (error.message?.includes('MSSQL') || error.message?.includes('connection')) {
      errorMessage = 'JTL-Datenbankverbindung fehlgeschlagen'
      statusCode = 503
    }
    
    return NextResponse.json({
      ok: false,
      error: errorMessage,
      errorType: error.name || 'Error'
    }, { status: statusCode })
  }
}

/**
 * GET /api/coldleads/jtl-customers/import
 * Zeigt Status des Imports
 */
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const prospectsCollection = db.collection('prospects')
    
    // Statistiken
    const jtlCustomersCount = await prospectsCollection.countDocuments({ 
      customer_source: 'jtl' 
    })
    
    const coldleadCustomersCount = await prospectsCollection.countDocuments({ 
      customer_source: 'coldlead' 
    })
    
    const lastImport = await prospectsCollection
      .find({ imported_from_jtl: true })
      .sort({ imported_at: -1 })
      .limit(1)
      .toArray()
    
    return NextResponse.json({
      ok: true,
      stats: {
        jtl_customers: jtlCustomersCount,
        coldlead_customers: coldleadCustomersCount,
        last_import: lastImport[0]?.imported_at || null
      }
    })
    
  } catch (error: any) {
    console.error('[JTL-Import Stats] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
