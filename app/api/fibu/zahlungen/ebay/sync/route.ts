export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../lib/db/mongodb'
import { getEbayAPI } from '../../../lib/ebay-api'

/**
 * POST /api/fibu/zahlungen/ebay/sync
 * Synchronisiert eBay Managed Payments Transaktionen
 * 
 * Body:
 * - from: Startdatum (YYYY-MM-DD)
 * - to: Enddatum (YYYY-MM-DD)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const from = body.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const to = body.to || new Date().toISOString().split('T')[0]

    console.log(`[eBay Sync] Starte Synchronisation: ${from} bis ${to}`)

    // Initialisiere eBay API
    const ebayAPI = getEbayAPI()
    
    // Validiere Config
    const validation = ebayAPI.validateConfig()
    if (!validation.valid) {
      console.error('[eBay Sync] Konfiguration ungültig:', validation.errors)
      return NextResponse.json({
        ok: false,
        error: 'eBay API nicht konfiguriert',
        details: validation.errors
      }, { status: 400 })
    }

    // Hole Transaktionen von eBay
    const fromISO = new Date(from).toISOString()
    const toISO = new Date(to + 'T23:59:59').toISOString()
    
    const transactions = await ebayAPI.getTransactions(fromISO, toISO, 200)
    console.log(`[eBay Sync] ${transactions.length} Transaktionen von eBay API erhalten`)

    if (transactions.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Keine neuen Transaktionen gefunden',
        imported: 0,
        updated: 0,
        skipped: 0
      })
    }

    // Transformiere und speichere in MongoDB
    const db = await getDb()
    const collection = db.collection('fibu_ebay_transactions')

    let imported = 0
    let updated = 0
    let skipped = 0

    for (const transaction of transactions) {
      const transformed = ebayAPI.transformTransaction(transaction)

      // Prüfe ob bereits vorhanden
      const existing = await collection.findOne({
        transactionId: transformed.transactionId
      })

      if (existing) {
        // Update wenn Status sich geändert hat
        if (existing.status !== transformed.status) {
          await collection.updateOne(
            { transactionId: transformed.transactionId },
            { $set: { ...transformed, updatedAt: new Date() } }
          )
          updated++
          console.log(`[eBay Sync] Updated: ${transformed.transactionId}`)
        } else {
          skipped++
        }
      } else {
        // Neu einfügen
        await collection.insertOne({
          ...transformed,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        imported++
        console.log(`[eBay Sync] Imported: ${transformed.transactionId}`)
      }
    }

    console.log(`[eBay Sync] Abgeschlossen: ${imported} neu, ${updated} aktualisiert, ${skipped} übersprungen`)

    return NextResponse.json({
      ok: true,
      message: `eBay Sync erfolgreich`,
      imported,
      updated,
      skipped,
      total: transactions.length,
      period: { from, to }
    })

  } catch (error: any) {
    console.error('[eBay Sync] Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message,
      details: error.toString()
    }, { status: 500 })
  }
}

/**
 * GET /api/fibu/zahlungen/ebay/sync
 * Zeigt Status der eBay Integration
 */
export async function GET(request: NextRequest) {
  try {
    const ebayAPI = getEbayAPI()
    const validation = ebayAPI.validateConfig()

    const db = await getDb()
    const collection = db.collection('fibu_ebay_transactions')
    
    const count = await collection.countDocuments()
    const latest = await collection
      .find()
      .sort({ datumDate: -1 })
      .limit(1)
      .toArray()

    return NextResponse.json({
      ok: true,
      configured: validation.valid,
      configErrors: validation.errors,
      env: process.env.EBAY_ENV || 'SANDBOX',
      marketplace: process.env.EBAY_MARKETPLACE || 'EBAY_DE',
      stats: {
        totalTransactions: count,
        latestTransaction: latest[0] || null
      }
    })

  } catch (error: any) {
    console.error('[eBay Sync] Status-Fehler:', error)
    return NextResponse.json({
      ok: false,
      error: error.message
    }, { status: 500 })
  }
}
