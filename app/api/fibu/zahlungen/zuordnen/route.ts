export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db/mongodb'
import { ObjectId } from 'mongodb'

/**
 * POST /api/fibu/zahlungen/zuordnen
 * 
 * Ordnet eine oder mehrere Zahlungen einem Beleg (Rechnung) zu
 * Unterstützt:
 * - Mehrere Zahlungen → ein Beleg (Teilzahlungen)
 * - Betrag-Abweichungen mit Grund (Skonto, Währung, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      zahlungIds,        // Array von Zahlungs-IDs
      rechnungId,        // ID der Rechnung/des Belegs
      rechnungsNr,       // Rechnungsnummer (optional, für Display)
      abweichungsgrund,  // 'teilzahlung' | 'skonto' | 'währung' | 'sonstiges' | null
      abweichungsBetrag, // Differenz (optional)
      notiz              // Freitext-Notiz (optional)
    } = body
    
    if (!zahlungIds || !Array.isArray(zahlungIds) || zahlungIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'zahlungIds Array erforderlich' },
        { status: 400 }
      )
    }
    
    if (!rechnungId) {
      return NextResponse.json(
        { ok: false, error: 'rechnungId erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    
    console.log('[Zuordnung] Starte:', { zahlungIds, rechnungId, abweichungsgrund })
    
    // Validiere Abweichungsgrund
    const validGruende = ['teilzahlung', 'skonto', 'währung', 'sonstiges', null]
    if (abweichungsgrund && !validGruende.includes(abweichungsgrund)) {
      return NextResponse.json(
        { ok: false, error: `Ungültiger Abweichungsgrund. Erlaubt: ${validGruende.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Bestimme Collection für jede Zahlung (kann aus verschiedenen Quellen sein)
    const sources = [
      { name: 'Amazon', collection: 'fibu_amazon_settlements', idField: 'transactionId' },
      { name: 'PayPal', collection: 'fibu_paypal_transactions', idField: 'transactionId' },
      { name: 'Commerzbank', collection: 'fibu_commerzbank_transactions', idField: 'transactionId' },
      { name: 'Postbank', collection: 'fibu_postbank_transactions', idField: 'transactionId' },
      { name: 'Mollie', collection: 'fibu_mollie_transactions', idField: 'transactionId' }
    ]
    
    const updated = []
    
    // Update jede Zahlung
    for (const zahlungId of zahlungIds) {
      let found = false
      
      // Versuche jede Collection
      for (const source of sources) {
        const collection = db.collection(source.collection)
        
        // Versuche als ObjectId
        let filter: any = { _id: new ObjectId(zahlungId) }
        let zahlung = await collection.findOne(filter)
        
        // Falls nicht gefunden, versuche als transactionId
        if (!zahlung) {
          filter = { [source.idField]: zahlungId }
          zahlung = await collection.findOne(filter)
        }
        
        if (zahlung) {
          // Prüfe ob bereits zugeordnet
          if (zahlung.istZugeordnet && zahlung.zugeordneteRechnung !== rechnungsNr) {
            console.warn(`[Zuordnung] Warnung: ${zahlungId} bereits zugeordnet zu ${zahlung.zugeordneteRechnung}`)
          }
          
          // Bestimme Zuordnungsart
          const zuordnungsArt = rechnungId ? 'rechnung' : (body.kontoNr ? 'konto' : null)
          
          // Lade VK-Rechnung für vk_beleg_id, falls vorhanden
          let vk_beleg_id = null
          let konto_id = body.kontoNr || null
          
          if (rechnungId || rechnungsNr) {
            const rechnung = await db.collection('fibu_vk_rechnungen').findOne({
              $or: [
                { _id: new ObjectId(rechnungId) },
                { cRechnungsNr: rechnungsNr }
              ]
            })
            
            if (rechnung) {
              vk_beleg_id = rechnung._id.toString()
              // Wenn kein Konto vom User gesetzt: Konto aus Rechnung übernehmen
              if (!konto_id) {
                konto_id = rechnung.sachkonto || rechnung.debitorKonto
              }
            }
          }
          
          // Berechne zuordnungs_status basierend auf Belegpflicht
          const { berechneZuordnungsStatus } = await import('../../../../lib/fibu-matching-pipeline')
          const matchResult = {
            vk_beleg_id,
            konto_id,
            match_source: 'manuell' as const,
            match_confidence: 100,
            match_details: 'Manuelle Zuordnung durch Benutzer'
          }
          const zuordnungs_status = await berechneZuordnungsStatus(zahlung, matchResult, db)
          
          // Update Zahlung
          const updateData: any = {
            istZugeordnet: true,
            zugeordneteRechnung: zuordnungsArt === 'rechnung' ? (rechnungsNr || rechnungId) : null,
            zugeordnetesKonto: konto_id,
            zuordnungsArt,
            zuordnungsDatum: new Date(),
            zuordnungsMethode: 'manuell',
            abweichungsgrund: abweichungsgrund || null,
            abweichungsBetrag: abweichungsBetrag || null,
            zuordnungsNotiz: notiz || null,
            // NEUE FELDER
            vk_beleg_id,
            match_source: 'manuell',
            match_confidence: 100,
            zuordnungs_status
          }
          
          await collection.updateOne(filter, { $set: updateData })
          
          updated.push({
            zahlungId,
            anbieter: source.name,
            betrag: zahlung.betrag
          })
          
          found = true
          console.log(`[Zuordnung] ✅ ${source.name} Zahlung ${zahlungId} → ${rechnungsNr}`)
          break
        }
      }
      
      if (!found) {
        console.error(`[Zuordnung] ❌ Zahlung ${zahlungId} nicht gefunden`)
        return NextResponse.json(
          { ok: false, error: `Zahlung ${zahlungId} nicht gefunden` },
          { status: 404 }
        )
      }
    }
    
    // Berechne Gesamt-Zahlungsbetrag
    const gesamtBetrag = updated.reduce((sum, z) => sum + (z.betrag || 0), 0)
    
    console.log('[Zuordnung] Abgeschlossen:', {
      zahlungen: updated.length,
      gesamtBetrag,
      rechnungId
    })
    
    return NextResponse.json({
      ok: true,
      updated: updated.length,
      zahlungen: updated,
      gesamtBetrag,
      rechnungId,
      rechnungsNr,
      abweichungsgrund
    })
    
  } catch (error: any) {
    console.error('[Zuordnung] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/fibu/zahlungen/zuordnen
 * 
 * Entfernt Zuordnung von Zahlungen
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { zahlungIds } = body
    
    if (!zahlungIds || !Array.isArray(zahlungIds) || zahlungIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'zahlungIds Array erforderlich' },
        { status: 400 }
      )
    }
    
    const db = await getDb()
    const sources = [
      'fibu_amazon_settlements',
      'fibu_paypal_transactions',
      'fibu_commerzbank_transactions',
      'fibu_postbank_transactions',
      'fibu_mollie_transactions'
    ]
    
    let removed = 0
    
    for (const zahlungId of zahlungIds) {
      for (const collectionName of sources) {
        const collection = db.collection(collectionName)
        
        const result = await collection.updateMany(
          {
            $or: [
              { _id: new ObjectId(zahlungId) },
              { transactionId: zahlungId }
            ],
            istZugeordnet: true
          },
          {
            $set: {
              istZugeordnet: false,
              zugeordneteRechnung: null,
              zugeordnetesKonto: null,
              zuordnungsArt: null,
              abweichungsgrund: null,
              abweichungsBetrag: null,
              zuordnungsNotiz: null
            }
          }
        )
        
        if (result.modifiedCount > 0) {
          removed += result.modifiedCount
          console.log(`[Zuordnung] ❌ Entfernt: ${zahlungId}`)
        }
      }
    }
    
    return NextResponse.json({
      ok: true,
      removed
    })
    
  } catch (error: any) {
    console.error('[Zuordnung DELETE] Fehler:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
