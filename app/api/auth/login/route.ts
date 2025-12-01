export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Admin accounts from environment variable (JSON format)
// Example: ADMIN_USERS='[{"username":"Alex","password":"Ali","role":"admin","displayName":"Alex"}]'
const USERS = process.env.ADMIN_USERS 
  ? JSON.parse(process.env.ADMIN_USERS)
  : [
      // Fallback for development only
      { username: 'Alex', password: 'Ali', role: 'admin', displayName: 'Alex' },
      { username: 'David', password: 'Enste', role: 'admin', displayName: 'David' },
      { username: 'Danki', password: 'lll', role: 'admin', displayName: 'Danki' }
    ]

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({
        ok: false,
        error: 'Benutzername und Passwort erforderlich'
      }, { status: 400 })
    }

    // Find user (case-insensitive username)
    const user = USERS.find(u => u.username.toLowerCase() === username.toLowerCase())

    if (!user || user.password !== password) {
      console.log(`[Auth] Failed login attempt for: ${username}`)
      return NextResponse.json({
        ok: false,
        error: 'Ungültiger Benutzername oder Passwort'
      }, { status: 401 })
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex')
    const sessionData = {
      token,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      loginTime: new Date().toISOString()
    }

    console.log(`[Auth] Successful login: ${user.displayName} (${user.role})`)

    return NextResponse.json({
      ok: true,
      token,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    })

  } catch (error: any) {
    console.error('[Auth] Login error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Interner Server-Fehler'
    }, { status: 500 })
  }
}
