export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        ok: false,
        authenticated: false
      })
    }

    const token = authHeader.substring(7)
    
    // For now, we just check if token exists (simple validation)
    // In production, validate against database or session store
    if (token && token.length > 0) {
      return NextResponse.json({
        ok: true,
        authenticated: true
      })
    }

    return NextResponse.json({
      ok: false,
      authenticated: false
    })

  } catch (error: any) {
    console.error('[Auth] Session check error:', error)
    return NextResponse.json({
      ok: false,
      authenticated: false
    }, { status: 500 })
  }
}
