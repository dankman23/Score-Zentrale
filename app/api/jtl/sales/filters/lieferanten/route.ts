export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMssqlPool } from '@/../lib/db/mssql'

export async function GET() {
  try {
    // TODO: Lieferanten-Filter aktivieren sobald Tabelle bekannt ist
    // Vorerst leere Liste zurückgeben
    return NextResponse.json({ ok: true, values: [] })
  } catch (error: any) {
    console.error('[/api/jtl/sales/filters/lieferanten] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
