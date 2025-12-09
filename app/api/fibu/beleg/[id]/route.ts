export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import { ObjectId } from 'mongodb'

/**
 * Zeigt PDF-Beleg einer EK-Rechnung an
 * GET /api/fibu/beleg/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json({ error: 'ID fehlt' }, { status: 400 })
    }
    
    const db = await getDb()
    
    // Hole Email mit PDF
    const email = await db.collection('fibu_email_inbox').findOne({
      _id: new ObjectId(id)
    })
    
    if (!email) {
      return NextResponse.json({ 
        error: 'Beleg nicht gefunden',
        id 
      }, { status: 404 })
    }
    
    if (!email.pdfBase64) {
      return NextResponse.json({ 
        error: 'Kein PDF vorhanden',
        filename: email.filename 
      }, { status: 404 })
    }
    
    // Konvertiere Base64 zu Buffer
    const pdfBuffer = Buffer.from(email.pdfBase64, 'base64')
    
    // Sende PDF als Response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${email.filename || 'beleg.pdf'}"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
    
  } catch (error: any) {
    console.error('[Beleg] Fehler:', error)
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
