export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('[Auth] User logged out')

    return NextResponse.json({
      ok: true,
      message: 'Erfolgreich abgemeldet'
    })

  } catch (error: any) {
    console.error('[Auth] Logout error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Interner Server-Fehler'
    }, { status: 500 })
  }
}
