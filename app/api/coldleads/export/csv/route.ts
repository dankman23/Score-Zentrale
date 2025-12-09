export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * GET /api/coldleads/export/csv
 * Exportiert Prospects als CSV (mit Filtern)
 * 
 * Query-Parameter:
 * - status: Filter nach Status (all, new, analyzed, contacted, etc.)
 * - includeAnalysis: Boolean - Analyse-Daten inkludieren? (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'all'
    const includeAnalysis = searchParams.get('includeAnalysis') === 'true'
    
    console.log(`[CSV Export] Starting export with status=${status}, includeAnalysis=${includeAnalysis}`)
    
    const { db } = await connectToDatabase()
    const collection = db.collection('prospects')
    
    // Filter aufbauen (gleiche Logik wie Search-API)
    let filter: any = {}
    if (status === 'replied') {
      filter = { hasReply: true }
    } else if (status === 'jtl_customers') {
      filter = { customer_source: 'jtl' }
    } else if (status === 'new_customers') {
      filter = { customer_source: 'coldlead', status: 'customer' }
    } else if (status !== 'all') {
      filter = { status }
    }
    
    // Lade alle Prospects (kein Limit für Export)
    const prospects = await collection.find(filter).sort({ created_at: -1 }).toArray()
    
    console.log(`[CSV Export] Found ${prospects.length} prospects`)
    
    // CSV-Header
    const headers = [
      'Firmenname',
      'Website',
      'Status',
      'Region',
      'Branche',
      'Score',
      'E-Mail',
      'Kontaktperson Name',
      'Kontaktperson Rolle',
      'Erstellt am',
      'Aktualisiert am'
    ]
    
    if (includeAnalysis) {
      headers.push(
        'Materialien',
        'Anwendungen',
        'Maschinen',
        'Confidence',
        'Empfohlene Marken'
      )
    }
    
    if (status === 'jtl_customers' || filter.customer_source === 'jtl') {
      headers.push(
        'JTL-Kundennummer',
        'Umsatz Gesamt',
        'Anzahl Rechnungen',
        'Letzte Rechnung',
        'Ort',
        'PLZ',
        'Telefon'
      )
    }
    
    // CSV-Rows erstellen
    const rows = prospects.map(p => {
      const row = [
        escapeCsv(p.company_name || ''),
        escapeCsv(p.website || ''),
        escapeCsv(p.status || ''),
        escapeCsv(p.region || ''),
        escapeCsv(p.industry || ''),
        p.score || '',
        escapeCsv(p.analysis_v3?.contact_person?.email || p.email || ''),
        escapeCsv(p.analysis_v3?.contact_person?.name || ''),
        escapeCsv(p.analysis_v3?.contact_person?.role || ''),
        p.created_at ? new Date(p.created_at).toLocaleDateString('de-DE') : '',
        p.updated_at ? new Date(p.updated_at).toLocaleDateString('de-DE') : ''
      ]
      
      if (includeAnalysis && p.analysis_v3) {
        row.push(
          escapeCsv(p.analysis_v3.materials?.map((m: any) => m.term).join(', ') || ''),
          escapeCsv(p.analysis_v3.applications?.map((a: any) => a.term).join(', ') || ''),
          escapeCsv(p.analysis_v3.machines?.map((m: any) => m.term).join(', ') || ''),
          p.analysis_v3.confidence_overall || '',
          escapeCsv(p.analysis_v3.recommended_brands?.join(', ') || '')
        )
      } else if (includeAnalysis) {
        // Leere Spalten wenn keine Analyse vorhanden
        row.push('', '', '', '', '')
      }
      
      if (status === 'jtl_customers' || filter.customer_source === 'jtl') {
        if (p.jtl_customer) {
          row.push(
            p.jtl_customer.kKunde || '',
            p.jtl_customer.umsatzGesamt?.toFixed(2) || '0.00',
            p.jtl_customer.anzahlRechnungen || '0',
            p.jtl_customer.letzteRechnung ? new Date(p.jtl_customer.letzteRechnung).toLocaleDateString('de-DE') : '',
            escapeCsv(p.jtl_customer.ort || ''),
            escapeCsv(p.jtl_customer.plz || ''),
            escapeCsv(p.jtl_customer.telefon || '')
          )
        } else {
          row.push('', '', '', '', '', '', '')
        }
      }
      
      return row
    })
    
    // CSV zusammenbauen
    const csvContent = [
      headers.join(';'), // Semikolon für deutsche Excel-Kompatibilität
      ...rows.map(row => row.join(';'))
    ].join('\n')
    
    // BOM für UTF-8 (wichtig für Excel!)
    const bom = '\uFEFF'
    const csvWithBom = bom + csvContent
    
    // Dateiname mit Timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `prospects_${status}_${timestamp}.csv`
    
    console.log(`[CSV Export] ✅ Export complete: ${prospects.length} rows, ${filename}`)
    
    // Response mit Download-Headers
    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error: any) {
    console.error('[CSV Export] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'CSV-Export fehlgeschlagen'
    }, { status: 500 })
  }
}

/**
 * Escapes CSV-Werte (Anführungszeichen, Kommas, Zeilenumbrüche)
 */
function escapeCsv(value: string): string {
  if (!value) return ''
  
  // Wenn Wert Sonderzeichen enthält, in Anführungszeichen setzen
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // Anführungszeichen verdoppeln (CSV-Standard)
    return '"' + value.replace(/"/g, '""') + '"'
  }
  
  return value
}
