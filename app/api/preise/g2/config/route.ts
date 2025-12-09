export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/api'

/**
 * GET /api/preise/g2/config
 * Lädt g2-Konfigurationen
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const configs = await db.collection('g2_configs').find({}).toArray()
    
    // Default-Config falls keine vorhanden
    if (configs.length === 0) {
      const defaultConfig = {
        warengruppe: 'lagerware',
        gstart_ek: 12,
        gneu_ek: 100,
        gneu_vk: 189,
        fixcost1: 0.35,  // pa
        fixcost2: 1.4,   // Fixkosten
        varpct1: 0.25,   // eba
        varpct2: 0.02,   // paypal
        aufschlag: 1.08,
        shp_fac: 0.92,
        aa_threshold: 18,
        created_at: new Date()
      }
      await db.collection('g2_configs').insertOne(defaultConfig)
      return NextResponse.json({ ok: true, configs: [defaultConfig] })
    }

    return NextResponse.json({ ok: true, configs })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/preise/g2/config
 * Speichert g2-Konfiguration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { warengruppe, params } = body

    if (!warengruppe || !params) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Warengruppe und Parameter erforderlich' 
      }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    
    await db.collection('g2_configs').updateOne(
      { warengruppe },
      { 
        $set: { 
          ...params,
          warengruppe,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    )

    return NextResponse.json({ 
      ok: true, 
      message: 'Konfiguration gespeichert' 
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
