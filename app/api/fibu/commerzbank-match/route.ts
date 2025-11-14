import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Lade Commerzbank-Vorschläge
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const collection = db.collection('fibu_commerzbank_vorschlaege')
    
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '100')
    
    const vorschlaege = await collection
      .find({ status })
      .sort({ zahlungDatum: -1 })
      .limit(limit)
      .toArray()
    
    // Lade auch Kreditoren und Sachkonten für Dropdown
    const kreditoren = await db.collection('kreditoren').find({}).toArray()
    const kontenplan = await db.collection('kontenplan').find({
      klasse: { $in: ['5', '6'] }  // Nur Aufwandskonten
    }).toArray()
    
    const stats = {
      pending: await collection.countDocuments({ status: 'pending' }),
      approved: await collection.countDocuments({ status: 'approved' }),
      rejected: await collection.countDocuments({ status: 'rejected' })
    }
    
    return NextResponse.json({
      ok: true,
      vorschlaege,
      kreditoren,
      kontenplan,
      stats
    })
  } catch (error: any) {
    console.error('Fehler beim Laden der Vorschläge:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Manuelle Zuordnung + Regel erstellen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      vorschlagId,
      zuordnungstyp,  // 'kreditor' oder 'sachkonto'
      kreditorKonto,
      sachkonto,
      erstelleRegel
    } = body
    
    if (!vorschlagId) {
      return NextResponse.json(
        { ok: false, error: 'vorschlagId fehlt' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const vorschlaegeCol = db.collection('fibu_commerzbank_vorschlaege')
    const zahlungenCol = db.collection('fibu_zahlungen')
    const regelnCol = db.collection('fibu_zuordnungsregeln')
    
    // Lade Vorschlag
    const vorschlag = await vorschlaegeCol.findOne({ _id: vorschlagId })
    
    if (!vorschlag) {
      return NextResponse.json(
        { ok: false, error: 'Vorschlag nicht gefunden' },
        { status: 404 }
      )
    }
    
    // Update Zahlung
    const updateData: any = {
      istZugeordnet: true,
      zuordnungstyp,
      zuordnungsmethode: 'manuell',
      zugeordnetAt: new Date()
    }
    
    if (zuordnungstyp === 'kreditor' && kreditorKonto) {
      // Lade Kreditor-Details
      const kreditor = await db.collection('kreditoren').findOne({
        kreditorenNummer: kreditorKonto
      })
      
      updateData.kreditorKonto = kreditorKonto
      updateData.kreditorName = kreditor?.name || 'Unbekannt'
      updateData.aufwandskonto = kreditor?.standardAufwandskonto || '5200'
    } else if (zuordnungstyp === 'sachkonto' && sachkonto) {
      // Lade Sachkonto-Bezeichnung
      const konto = await db.collection('kontenplan').findOne({
        kontonummer: sachkonto
      })
      
      updateData.sachkonto = sachkonto
      updateData.sachkontoBezeichnung = konto?.bezeichnung || 'Unbekannt'
    }
    
    await zahlungenCol.updateOne(
      { _id: vorschlag.zahlungId },
      { $set: updateData }
    )
    
    // Erstelle Regel wenn gewünscht
    if (erstelleRegel) {
      const regel: any = {
        typ: zuordnungstyp,
        empfaenger: vorschlag.empfaenger,
        iban: vorschlag.iban,
        createdAt: new Date(),
        createdBy: 'manual'
      }
      
      // Erstelle Pattern aus Empfänger (ohne Sonderzeichen)
      if (vorschlag.empfaenger) {
        const empfaengerClean = vorschlag.empfaenger
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .trim()
        regel.empfaengerPattern = empfaengerClean
      }
      
      if (zuordnungstyp === 'kreditor') {
        regel.kreditorKonto = kreditorKonto
        regel.sachkonto = updateData.aufwandskonto
        regel.bezeichnung = updateData.kreditorName
      } else {
        regel.sachkonto = sachkonto
        regel.bezeichnung = updateData.sachkontoBezeichnung
      }
      
      // Prüfe ob Regel schon existiert
      const existingRegel = await regelnCol.findOne({
        $or: [
          { iban: vorschlag.iban },
          { empfaengerPattern: regel.empfaengerPattern }
        ]
      })
      
      if (!existingRegel) {
        await regelnCol.insertOne(regel)
      }
    }
    
    // Update Vorschlag
    await vorschlaegeCol.updateOne(
      { _id: vorschlagId },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date(),
          zuordnung: updateData,
          regelErstellt: erstelleRegel || false
        }
      }
    )
    
    return NextResponse.json({
      ok: true,
      message: erstelleRegel 
        ? 'Zahlung zugeordnet und Regel erstellt' 
        : 'Zahlung zugeordnet'
    })
  } catch (error: any) {
    console.error('Fehler bei Zuordnung:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
