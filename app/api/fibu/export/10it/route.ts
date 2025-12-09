export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/mongodb'
import { 
  Booking10itFormat,
  generate10itCSV,
  createEKBuchung,
  createVKBuchung,
  validateKontoZuordnung
} from '@/lib/export-10it-format'

/**
 * GET /api/fibu/export/10it
 * Exportiert Buchungsdaten im 10it-Format
 * 
 * Query-Parameter:
 * - from: Startdatum (YYYY-MM-DD)
 * - to: Enddatum (YYYY-MM-DD)
 * - type: Export-Typ ('alle', 'vk', 'ek') - optional
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || '2025-01-01'
    const to = searchParams.get('to') || '2025-12-31'
    const type = searchParams.get('type') || 'alle'  // 'alle', 'vk', 'ek'
    
    const startDate = new Date(from)
    const endDate = new Date(to + 'T23:59:59.999Z')
    
    console.log(`[10it Export] Exportiere ${type} von ${from} bis ${to}`)
    
    // Hole Kontenplan aus MongoDB
    const db = await getDb()
    const kontenplanCollection = db.collection('kontenplan')
    const kontenplanData = await kontenplanCollection.find({}).toArray()
    
    // Erstelle Map für schnellen Zugriff
    const kontoMap = new Map<string, string>()
    kontenplanData.forEach((k: any) => {
      kontoMap.set(k.kontonummer, k.bezeichnung || '')
    })
    
    const buchungen: Booking10itFormat[] = []
    const validationErrors: string[] = []
    let exportedVK = 0
    let exportedEK = 0
    let skippedVK = 0
    let skippedEK = 0
    
    // ========================================
    // 1. VK-RECHNUNGEN (Verkaufsrechnungen)
    // ========================================
    if (type === 'alle' || type === 'vk') {
      const vkRechnungenCol = db.collection('fibu_vk_rechnungen')
      const vkRechnungen = await vkRechnungenCol.find({
        $or: [
          { rechnungsdatum: { $gte: startDate, $lte: endDate } },
          { datum: { $gte: startDate, $lte: endDate } }
        ]
      }).toArray()
      
      console.log(`[10it Export] Gefundene VK-Rechnungen: ${vkRechnungen.length}`)
      
      for (const rechnung of vkRechnungen) {
        // Validiere Kontozuordnung
        const validation = validateKontoZuordnung(rechnung, 'vk')
        
        if (!validation.valid) {
          validationErrors.push(...validation.errors)
          skippedVK++
          continue
        }
        
        // Erstelle Buchung
        const rechnungBuchungen = createVKBuchung(rechnung, kontoMap)
        buchungen.push(...rechnungBuchungen)
        exportedVK++
      }
    }
    
    // ========================================
    // 2. EK-RECHNUNGEN (Einkaufsrechnungen)
    // ========================================
    if (type === 'alle' || type === 'ek') {
      const ekRechnungenCol = db.collection('fibu_ek_rechnungen')
      const ekRechnungen = await ekRechnungenCol.find({
        rechnungsdatum: { $gte: startDate, $lte: endDate },
        kreditorKonto: { $exists: true, $ne: null }  // Nur Rechnungen mit Kreditor
      }).toArray()
      
      console.log(`[10it Export] Gefundene EK-Rechnungen: ${ekRechnungen.length}`)
      
      for (const rechnung of ekRechnungen) {
        // Validiere Kontozuordnung
        const validation = validateKontoZuordnung(rechnung, 'ek')
        
        if (!validation.valid) {
          validationErrors.push(...validation.errors)
          skippedEK++
          continue
        }
        
        // Erstelle Buchung
        const rechnungBuchungen = createEKBuchung(rechnung, kontoMap)
        buchungen.push(...rechnungBuchungen)
        exportedEK++
      }
    }
    
    // ========================================
    // 3. CSV GENERIEREN
    // ========================================
    const csv = generate10itCSV(buchungen)
    
    // Log Statistik
    console.log(`[10it Export] Export abgeschlossen:`)
    console.log(`  - VK-Rechnungen exportiert: ${exportedVK}`)
    console.log(`  - VK-Rechnungen übersprungen: ${skippedVK}`)
    console.log(`  - EK-Rechnungen exportiert: ${exportedEK}`)
    console.log(`  - EK-Rechnungen übersprungen: ${skippedEK}`)
    console.log(`  - Gesamt Buchungen: ${buchungen.length}`)
    
    if (validationErrors.length > 0) {
      console.warn(`[10it Export] ⚠️ ${validationErrors.length} Validierungsfehler:`)
      validationErrors.forEach(err => console.warn(`  - ${err}`))
    }
    
    // Als CSV-Download zurückgeben
    const filename = `EXTF_Buchungsstapel_${from}_${to}.csv`
    
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Stats': JSON.stringify({
          exportedVK,
          exportedEK,
          skippedVK,
          skippedEK,
          totalBuchungen: buchungen.length,
          validationErrorsCount: validationErrors.length
        })
      }
    })
    
  } catch (error: any) {
    console.error('[10it Export] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
