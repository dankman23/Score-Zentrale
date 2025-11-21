export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/amazon/bulletpoints/download
 * Download der generierten Bulletpoints CSV
 */
export async function GET(request: NextRequest) {
  try {
    const csvPath = '/tmp/bulletpoints_results.csv'
    
    // Prüfe ob Datei existiert
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({
        ok: false,
        error: 'Keine CSV-Datei gefunden. Bitte erst Bulletpoints generieren.'
      }, { status: 404 })
    }
    
    // Lese Datei
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    
    // Erstelle Dateiname mit Timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `amazon_bulletpoints_${timestamp}.csv`
    
    // Sende als Download
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(csvContent, 'utf-8').toString()
      }
    })
    
  } catch (error: any) {
    console.error('[Download] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
