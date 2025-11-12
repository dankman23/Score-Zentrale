export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import { getKontenklasse, getKontenklasseName } from '../../../lib/kontenplan-utils'

/**
 * GET /api/fibu/kontenplan
 * Lädt alle Konten
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const konten = await db.collection('fibu_konten')
      .find({})
      .sort({ konto: 1 })
      .toArray()
    
    return NextResponse.json({
      ok: true,
      konten
    })
  } catch (error: any) {
    console.error('[Kontenplan GET] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fibu/kontenplan
 * Erstellt oder aktualisiert ein Konto
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { konto, bezeichnung, typ } = body
    
    if (!konto || !bezeichnung) {
      return NextResponse.json(
        { ok: false, error: 'Konto und Bezeichnung erforderlich' },
        { status: 400 }
      )
    }
    
    // Automatische Kontenklassen-Erkennung
    const kontenklasse = getKontenklasse(konto)
    const kontenklasseName = getKontenklasseName(kontenklasse)
    
    const db = await getDb()
    await db.collection('fibu_konten').updateOne(
      { konto },
      {
        $set: {
          konto,
          bezeichnung,
          kontenklasse,
          kontenklasseName,
          typ: typ || kontenklasseName,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date(),
          aktiv: true
        }
      },
      { upsert: true }
    )
    
    return NextResponse.json({
      ok: true,
      message: 'Konto gespeichert'
    })
  } catch (error: any) {
    console.error('[Kontenplan POST] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/fibu/kontenplan
 * Aktualisiert ein bestehendes Konto
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { oldKonto, konto, bezeichnung, typ } = body
    
    if (!oldKonto || !konto || !bezeichnung) {
      return NextResponse.json(
        { ok: false, error: 'Alte Kontonummer, neue Kontonummer und Bezeichnung erforderlich' },
        { status: 400 }
      )
    }
    
    // Automatische Kontenklassen-Erkennung
    const kontenklasse = getKontenklasse(konto)
    const kontenklasseName = getKontenklasseName(kontenklasse)
    
    const db = await getDb()
    
    // Prüfen ob neues Konto bereits existiert (falls Kontonummer geändert wurde)
    if (oldKonto !== konto) {
      const existing = await db.collection('fibu_konten').findOne({ konto })
      if (existing) {
        return NextResponse.json(
          { ok: false, error: 'Ein Konto mit dieser Nummer existiert bereits' },
          { status: 400 }
        )
      }
    }
    
    // Altes Konto löschen, neues anlegen
    await db.collection('fibu_konten').deleteOne({ konto: oldKonto })
    await db.collection('fibu_konten').insertOne({
      konto,
      bezeichnung,
      kontenklasse,
      kontenklasseName,
      typ: typ || kontenklasseName,
      updated_at: new Date(),
      created_at: new Date(),
      aktiv: true
    })
    
    return NextResponse.json({
      ok: true,
      message: 'Konto aktualisiert'
    })
  } catch (error: any) {
    console.error('[Kontenplan PUT] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/fibu/kontenplan
 * Löscht ein Konto
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const konto = searchParams.get('konto')
    
    if (!konto) {
      return NextResponse.json(
        { ok: false, error: 'Kontonummer erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    await db.collection('fibu_konten').deleteOne({ konto })
    
    return NextResponse.json({
      ok: true,
      message: 'Konto gelöscht'
    })
  } catch (error: any) {
    console.error('[Kontenplan DELETE] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
