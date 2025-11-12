export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import { getKontenklasse, getKontenklasseName } from '../../../lib/kontenplan-utils'

/**
 * GET /api/fibu/kontenplan
 * Lädt alle Konten (mit optionalen Query-Parametern für Filterung)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const klasse = searchParams.get('klasse')
    const limit = parseInt(searchParams.get('limit') || '1000', 10)
    const skip = parseInt(searchParams.get('skip') || '0', 10)
    
    const db = await getDb()
    const collection = db.collection('fibu_konten')
    
    // Build filter
    const filter: any = {}
    if (search) {
      filter.$or = [
        { konto: { $regex: search, $options: 'i' } },
        { bezeichnung: { $regex: search, $options: 'i' } }
      ]
    }
    if (klasse && klasse !== 'alle') {
      filter.kontenklasse = parseInt(klasse, 10)
    }
    
    // Count total
    const total = await collection.countDocuments(filter)
    
    // Get konten with pagination
    const konten = await collection
      .find(filter)
      .sort({ konto: 1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    
    return NextResponse.json({
      ok: true,
      konten,
      total,
      limit,
      skip
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
