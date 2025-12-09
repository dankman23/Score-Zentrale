import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/../lib/db/mongodb'
import { getJTLConnection } from '@/../lib/db/mssql'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-10-01'
    const to = searchParams.get('to') || '2025-10-31'
    
    const startDate = new Date(from + 'T00:00:00.000Z')
    const endDate = new Date(to + 'T23:59:59.999Z')
    
    const db = await getDb()
    
    // 1. VK-Rechnungen (Verkauf)
    const vkRechnungen = await db.collection('fibu_vk_rechnungen').find({
      rechnungsdatum: { $gte: startDate, $lte: endDate }
    }).toArray()
    
    const vkRechnungenGesamt = vkRechnungen.length
    const vkRechnungenOhneDebitor = vkRechnungen.filter((r: any) => !r.debitorKonto).length
    const vkRechnungenBezahlt = vkRechnungen.filter((r: any) => r.status === 'Bezahlt').length
    const vkRechnungenOhneBezahlung = vkRechnungen.filter((r: any) => 
      r.status !== 'Bezahlt' && r.status !== 'Storniert'
    ).length
    
    // Gesamtumsatz berechnen
    const gesamtUmsatz = vkRechnungen.reduce((sum: number, r: any) => sum + (r.brutto || 0), 0)
    const nettoUmsatz = vkRechnungen.reduce((sum: number, r: any) => sum + (r.netto || 0), 0)
    
    // 2. EK-Rechnungen (Einkauf)
    const ekRechnungen = await db.collection('fibu_ek_rechnungen').find({
      rechnungsdatum: { $gte: startDate, $lte: endDate }
    }).toArray()
    
    const ekRechnungenGesamt = ekRechnungen.length
    const ekRechnungenOhneKreditor = ekRechnungen.filter((r: any) => !r.kreditorKonto).length
    const ekRechnungenZugeordnet = ekRechnungen.filter((r: any) => r.kreditorKonto).length
    
    // 3. Zahlungen
    const zahlungen = await db.collection('fibu_zahlungen').find({
      zahlungsdatum: { $gte: startDate, $lte: endDate }
    }).toArray()
    
    const zahlungenGesamt = zahlungen.length
    const zahlungenZugeordnet = zahlungen.filter((z: any) => z.istZugeordnet || z.kRechnung > 0).length
    const zahlungenNichtZugeordnet = zahlungenGesamt - zahlungenZugeordnet
    
    // 4. Gesamt-Fortschritt
    const gesamtRechnungen = vkRechnungenGesamt + ekRechnungenGesamt
    const vollstaendigZugeordnet = 
      (vkRechnungenGesamt - vkRechnungenOhneDebitor) + 
      (ekRechnungenGesamt - ekRechnungenOhneKreditor)
    
    // 5. Externe Rechnungen (Amazon VCS)
    const externeRechnungen = await db.collection('fibu_externe_rechnungen').find({
      rechnungsdatum: { $gte: startDate, $lte: endDate }
    }).toArray()
    
    const stats = {
      // VK
      vkRechnungenGesamt,
      vkRechnungenOhneDebitor,
      vkRechnungenBezahlt,
      vkRechnungenOhneBezahlung,
      
      // EK
      ekRechnungenGesamt,
      ekRechnungenOhneKreditor,
      ekRechnungenZugeordnet,
      
      // Zahlungen
      zahlungenGesamt,
      zahlungenZugeordnet,
      zahlungenNichtZugeordnet,
      
      // Umsatz
      gesamtUmsatz: Math.round(gesamtUmsatz * 100) / 100,
      nettoUmsatz: Math.round(nettoUmsatz * 100) / 100,
      
      // Fortschritt
      gesamtRechnungen,
      vollstaendigZugeordnet,
      
      // Externe
      externeRechnungenGesamt: externeRechnungen.length,
      
      // Zeitraum
      zeitraum: { from, to }
    }
    
    return NextResponse.json({
      ok: true,
      stats
    })
  } catch (error: any) {
    console.error('Fehler bei Monatsübersicht:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
