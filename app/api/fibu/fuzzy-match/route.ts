import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/mongodb'
import { spawn } from 'child_process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Lade Matching-Vorschläge
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const collection = db.collection('fibu_matching_vorschlaege')
    
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const vorschlaege = await collection
      .find({ status })
      .sort({ confidence: -1 })
      .limit(limit)
      .toArray()
    
    const stats = {
      pending: await collection.countDocuments({ status: 'pending' }),
      approved: await collection.countDocuments({ status: 'approved' }),
      rejected: await collection.countDocuments({ status: 'rejected' })
    }
    
    return NextResponse.json({
      ok: true,
      vorschlaege,
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

// POST - Führe Fuzzy Matching aus
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const action = body.action
    
    if (action === 'run') {
      // Führe Fuzzy Matching Script aus
      return new Promise<NextResponse>((resolve) => {
        const scriptPath = '/app/scripts/fuzzy-match-zahlungen.js'
        const process = spawn('node', [scriptPath])
        
        let output = ''
        let errorOutput = ''
        
        process.stdout.on('data', (data) => {
          output += data.toString()
        })
        
        process.stderr.on('data', (data) => {
          errorOutput += data.toString()
        })
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve(NextResponse.json({
              ok: true,
              message: 'Fuzzy Matching erfolgreich ausgeführt',
              output
            }))
          } else {
            resolve(NextResponse.json(
              { ok: false, error: errorOutput || 'Script-Fehler', output },
              { status: 500 }
            ))
          }
        })
      })
    } else if (action === 'approve' || action === 'reject') {
      // Genehmige oder lehne Vorschlag ab
      const vorschlagId = body.vorschlagId
      
      if (!vorschlagId) {
        return NextResponse.json(
          { ok: false, error: 'vorschlagId fehlt' },
          { status: 400 }
        )
      }
      
      const db = await getDb()
      const vorschlaegeCol = db.collection('fibu_matching_vorschlaege')
      const zahlungenCol = db.collection('fibu_zahlungen')
      
      // Lade Vorschlag
      const vorschlag = await vorschlaegeCol.findOne({ _id: vorschlagId })
      
      if (!vorschlag) {
        return NextResponse.json(
          { ok: false, error: 'Vorschlag nicht gefunden' },
          { status: 404 }
        )
      }
      
      if (action === 'approve') {
        // Update Zahlung
        await zahlungenCol.updateOne(
          { _id: vorschlag.zahlungId },
          {
            $set: {
              kRechnung: vorschlag.rechnungId.kRechnung,
              rechnungsNr: vorschlag.rechnungNr,
              istZugeordnet: true,
              matchedAt: new Date(),
              matchMethod: 'fuzzy-manual',
              matchConfidence: vorschlag.confidence
            }
          }
        )
        
        // Update Vorschlag
        await vorschlaegeCol.updateOne(
          { _id: vorschlagId },
          {
            $set: {
              status: 'approved',
              approvedAt: new Date()
            }
          }
        )
        
        return NextResponse.json({
          ok: true,
          message: 'Vorschlag genehmigt und Zahlung zugeordnet'
        })
      } else {
        // Ablehnen
        await vorschlaegeCol.updateOne(
          { _id: vorschlagId },
          {
            $set: {
              status: 'rejected',
              rejectedAt: new Date()
            }
          }
        )
        
        return NextResponse.json({
          ok: true,
          message: 'Vorschlag abgelehnt'
        })
      }
    }
    
    return NextResponse.json(
      { ok: false, error: 'Ungültige Action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Fehler beim Fuzzy Matching:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
