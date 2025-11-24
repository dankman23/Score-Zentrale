export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/telegram/send
 * Sendet eine Nachricht über Telegram Bot API
 */
export async function POST(request: NextRequest) {
  try {
    const { botToken, chatId, message } = await request.json()

    if (!botToken || !chatId || !message) {
      return NextResponse.json({
        ok: false,
        error: 'Bot Token, Chat ID und Nachricht sind erforderlich'
      }, { status: 400 })
    }

    // Telegram Bot API aufrufen
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML' // Unterstützt HTML-Formatierung
      })
    })

    const data = await response.json()

    if (!response.ok || !data.ok) {
      console.error('[Telegram] Fehler:', data)
      return NextResponse.json({
        ok: false,
        error: data.description || 'Telegram API Fehler'
      }, { status: response.status })
    }

    console.log('[Telegram] Nachricht erfolgreich gesendet:', {
      chatId,
      messageId: data.result.message_id
    })

    return NextResponse.json({
      ok: true,
      messageId: data.result.message_id,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[Telegram] Unerwarteter Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Interner Server-Fehler'
    }, { status: 500 })
  }
}
