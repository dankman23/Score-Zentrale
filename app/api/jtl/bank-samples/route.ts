export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getMssqlPool } from '@/lib/db/mssql'

/**
 * GET /api/jtl/bank-samples?kontoId=xxx
 * Holt Sample-Transaktionen für eine Konto-ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const kontoId = searchParams.get('kontoId') || '610000200'
    
    const pool = await getMssqlPool()
    
    const samples = await pool.request()
      .input('kontoId', kontoId)
      .query(`
        SELECT TOP 10
          cKontoIdentifikation,
          cTransaktionID,
          dBuchungsdatum,
          fBetrag,
          cWaehrungISO,
          cName,
          cKonto,
          cVerwendungszweck,
          kZahlungsabgleichModul
        FROM tZahlungsabgleichUmsatz
        WHERE cKontoIdentifikation = @kontoId
        ORDER BY dBuchungsdatum DESC
      `)
    
    return NextResponse.json({
      ok: true,
      kontoId,
      count: samples.recordset.length,
      samples: samples.recordset
    })
  } catch (error) {
    console.error('[JTL Bank Samples] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
