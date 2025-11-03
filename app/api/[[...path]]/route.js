import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

// Single Mongo connection (no hardcoded DB name, taken from URI)
let client
let db

async function connectToMongo() {
  if (!client) {
    const uri = process.env.MONGO_URL
    if (!uri) throw new Error('MONGO_URL is not set')
    client = new MongoClient(uri)
    await client.connect()
    db = client.db() // use DB from URI (no hardcoding)
  }
  return db
}

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function dateRange(days = 30) {
  const out = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function generateKpisMock() {
  const dates = dateRange(30)
  const jtlSeries = []
  const adsSeries = []
  let revTotal = 0, ordersTotal = 0, marginTotal = 0
  let adsCostTotal = 0, clicksTotal = 0, convTotal = 0, convValTotal = 0, impTotal = 0

  dates.forEach((d, idx) => {
    const r = Math.round(800 + seededRandom(idx + 1) * 1200)
    const o = Math.round(5 + seededRandom(idx + 11) * 20)
    const m = Math.round(r * (0.22 + seededRandom(idx + 21) * 0.15))
    jtlSeries.push({ date: d, revenue: r, orders: o, margin: m })
    revTotal += r; ordersTotal += o; marginTotal += m

    const cost = Math.round(50 + seededRandom(idx + 31) * 200)
    const clicks = Math.round(40 + seededRandom(idx + 41) * 160)
    const conv = Math.round(2 + seededRandom(idx + 51) * 10)
    const convValue = Math.round(conv * (40 + seededRandom(idx + 61) * 80))
    const imp = Math.round(2000 + seededRandom(idx + 71) * 8000)
    adsSeries.push({ date: d, cost, clicks })
    adsCostTotal += cost; clicksTotal += clicks; convTotal += conv; convValTotal += convValue; impTotal += imp
  })

  const ga4Totals = {
    users: Math.round(1200 + seededRandom(1) * 800),
    sessions: Math.round(2000 + seededRandom(2) * 1200),
    engagedSessions: Math.round(1400 + seededRandom(3) * 600),
    revenue: Math.round(3000 + seededRandom(4) * 2000)
  }

  const adsCampaigns = [
    { name: 'Brand DACH', cost: 980, clicks: 2200, conversions: 95, roas: 3.8 },
    { name: 'Bänder Industrie', cost: 640, clicks: 1400, conversions: 52, roas: 4.2 },
    { name: 'Scheiben Handwerk', cost: 420, clicks: 900, conversions: 31, roas: 2.9 }
  ]

  return {
    jtl: {
      totals: { revenue: revTotal, orders: ordersTotal, margin: marginTotal },
      series: jtlSeries
    },
    ads: {
      totals: {
        cost: adsCostTotal,
        impressions: impTotal,
        clicks: clicksTotal,
        conversions: convTotal,
        conversion_value: convValTotal,
        roas: convValTotal > 0 ? (convValTotal / (adsCostTotal || 1)).toFixed(2) : 0
      },
      series: adsSeries,
      campaigns: adsCampaigns
    },
    ga4: {
      totals: ga4Totals,
      sourceMedium: [
        { sourceMedium: 'google / cpc', users: 820, sessions: 1100, revenue: 1800 },
        { sourceMedium: 'direct / (none)', users: 460, sessions: 700, revenue: 950 },
        { sourceMedium: 'linkedin / referral', users: 210, sessions: 300, revenue: 420 }
      ]
    }
  }
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    // Simple health checks
    if ((route === '/' || route === '/root') && method === 'GET') {
      return cors(NextResponse.json({ message: 'Score Zentrale API online' }))
    }

    // KPIs (mocked)
    if (route === '/kpis' && method === 'GET') {
      const data = generateKpisMock()
      return cors(NextResponse.json(data))
    }

    // Prospects CRUD (minimal)
    if (route === '/prospects' && method === 'GET') {
      const items = await db.collection('prospects')
        .find({})
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return cors(NextResponse.json(cleaned))
    }

    if (route === '/prospects' && method === 'POST') {
      const body = await request.json()
      const now = new Date()
      const domain = (body.website || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
      const existing = await db.collection('prospects').findOne({ website: { $regex: domain, $options: 'i' } })
      if (existing) {
        return cors(NextResponse.json({ duplicate: true, prospect: { ...existing, _id: undefined } }))
      }
      const doc = {
        id: uuidv4(),
        name: body.name || domain || 'Unbekannt',
        website: body.website || '',
        region: body.region || '',
        industry: body.industry || '',
        size: body.size || '',
        source: body.source || 'manual',
        linkedinUrl: body.linkedinUrl || '',
        score: Math.round(50 + seededRandom(now.getTime()) * 50),
        createdAt: now,
        ownerUid: body.ownerUid || null
      }
      await db.collection('prospects').insertOne(doc)
      const { _id, ...cleanDoc } = doc
      return cors(NextResponse.json(cleanDoc))
    }

    // Company Analyzer (mocked, heuristic). Also logs into companies + activities
    if (route === '/analyze' && method === 'POST') {
      const body = await request.json()
      const industry = (body.industry || '').toLowerCase()
      const name = body.name || 'Firma'
      const website = body.website || ''

      const mappings = {
        metall: {
          productGroups: ['Schleifbänder', 'Fiberscheiben', 'Fächerscheiben', 'Vlies', 'Trennscheiben'],
          materials: ['Baustahl', 'Edelstahl', 'Aluminium'],
          machines: ['Bandschleifer', 'Winkelschleifer', 'Stationär']
        },
        holz: {
          productGroups: ['Schleifbänder', 'Schleifscheiben', 'Vlies'],
          materials: ['Hartholz', 'Weichholz', 'MDF'],
          machines: ['Bandschleifer', 'Exzenterschleifer', 'Parkett']
        }
      }
      const key = industry.includes('metall') ? 'metall' : industry.includes('holz') ? 'holz' : 'metall'
      const base = mappings[key]
      const hypotheses = [
        { need: 'Bänder 50×2000', grit: 'K80', quality: 'VSM XK870X', use: 'Kanten-/Flächenschliff' },
        { need: 'Fiberscheiben Ø125', grit: 'K60', quality: 'Klingspor CS565', use: 'Schweißnahtbearbeitung' },
        { need: 'Vliesrolle 115×10m', grit: 'Sehr fein', quality: '3M', use: 'Oberflächenfinish' }
      ]

      const result = {
        company: { name, website, industry: body.industry || '' },
        materials: base.materials,
        machines: base.machines,
        productGroups: base.productGroups,
        hypotheses
      }

      const companyDoc = {
        id: uuidv4(),
        domain: website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(),
        name,
        industry: body.industry || '',
        techNotes: '',
        scoreTags: base.productGroups,
        lastAnalyzedAt: new Date()
      }
      await db.collection('companies').updateOne(
        { domain: companyDoc.domain },
        { $set: companyDoc },
        { upsert: true }
      )
      await db.collection('activities').insertOne({
        id: uuidv4(),
        type: 'analyze',
        refId: companyDoc.id,
        note: `Analyze mock for ${name}`,
        createdAt: new Date(),
        user: body.user || null
      })

      return cors(NextResponse.json(result))
    }

    // Mail compose (mocked, template)
    if (route === '/mailer/compose' && method === 'POST') {
      const body = await request.json()
      const company = body.company || 'Ihr Unternehmen'
      const contactRole = body.contactRole || 'Einkauf'
      const industry = body.industry || 'Industrie'
      const useCases = Array.isArray(body.useCases) ? body.useCases.join(', ') : (body.useCases || 'Schleifanwendungen')
      const hypotheses = Array.isArray(body.hypotheses) ? body.hypotheses.map(h => (typeof h === 'string' ? h : `${h.need || ''} ${h.grit || ''} ${h.quality || ''}`)).join('; ') : (body.hypotheses || '')

      const subject = `Kurzabstimmung Schleifbedarf – ${company}`
      const text = `Guten Tag ${contactRole},\n\nwir unterstützen Fertiger aus der ${industry} bei der zuverlässigen Versorgung mit Schleifmitteln.\nAuf Basis Ihrer Anwendungen (${useCases}) sehe ich u.a.: ${hypotheses}.\n\nWenn Sie möchten, klären wir in 10 Minuten die aktuell benötigten Größen/Körnungen und Referenzqualitäten – ich sende direkt Muster/Angebot.\n\nPasst ein kurzer Austausch diese oder nächste Woche?\n\nBeste Grüße\nSCORE Schleifwerkzeuge`
      const html = `<p>Guten Tag ${contactRole},</p><p>wir unterstützen Fertiger aus der <strong>${industry}</strong> bei der zuverlässigen Versorgung mit Schleifmitteln.</p><p>Auf Basis Ihrer Anwendungen (${useCases}) sehe ich u.a.: ${hypotheses}.</p><p>Wenn Sie möchten, klären wir in 10 Minuten die aktuell benötigten Größen/Körnungen und Referenzqualitäten – ich sende direkt Muster/Angebot.</p><p>Passt ein kurzer Austausch diese oder nächste Woche?</p><p>Beste Grüße<br/>SCORE Schleifwerkzeuge</p>`

      return cors(NextResponse.json({ subject, text, html }))
    }

    // Save email draft
    if (route === '/emails' && method === 'POST') {
      const body = await request.json()
      const doc = {
        id: uuidv4(),
        companyId: body.companyId || null,
        contactId: body.contactId || null,
        subject: body.subject || '',
        body: body.body || '',
        status: 'draft',
        sentAt: null
      }
      await db.collection('emails').insertOne(doc)
      return cors(NextResponse.json(doc))
    }

    // Status debug endpoints from template keep working
    if (route === '/status' && method === 'POST') {
      const body = await request.json()
      if (!body.client_name) {
        return cors(NextResponse.json({ error: 'client_name is required' }, { status: 400 }))
      }
      const statusObj = { id: uuidv4(), client_name: body.client_name, timestamp: new Date() }
      await db.collection('status_checks').insertOne(statusObj)
      return cors(NextResponse.json(statusObj))
    }

    if (route === '/status' && method === 'GET') {
      const statusChecks = await db.collection('status_checks').find({}).limit(1000).toArray()
      const cleaned = statusChecks.map(({ _id, ...rest }) => rest)
      return cors(NextResponse.json(cleaned))
    }

    return cors(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (err) {
    console.error('API Error:', err)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
