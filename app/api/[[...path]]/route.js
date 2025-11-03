export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import sql from 'mssql'

// Mongo connection
let client
let db
async function connectToMongo() {
  if (!client) {
    const uri = process.env.MONGO_URL
    if (!uri) throw new Error('MONGO_URL is not set')
    client = new MongoClient(uri)
    await client.connect()
    db = client.db()
  }
  return db
}

// MSSQL singleton (env-credentials)
let sqlPool = null
async function getMssqlPool(){
  if (sqlPool) return sqlPool
  const config = {
    user: process.env.JTL_SQL_USER,
    password: process.env.JTL_SQL_PASSWORD,
    server: process.env.JTL_SQL_HOST,
    port: parseInt(process.env.JTL_SQL_PORT || '1433', 10),
    database: process.env.JTL_SQL_DB,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true }
  }
  sqlPool = await sql.connect(config)
  return sqlPool
}

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

function seededRandom(seed) { let x = Math.sin(seed) * 10000; return x - Math.floor(x) }
function dateRange(days = 30) { const out=[]; const now=new Date(); for(let i=days-1;i>=0;i--){const d=new Date(now); d.setDate(now.getDate()-i); out.push(d.toISOString().slice(0,10))} return out }

function generateKpisMock() {
  const dates = dateRange(30)
  const jtlSeries = []
  const adsSeries = []
  let revTotal=0, ordersTotal=0, marginTotal=0
  let adsCostTotal=0, clicksTotal=0, convTotal=0, convValTotal=0, impTotal=0
  dates.forEach((d, idx)=>{
    const r = Math.round(800 + seededRandom(idx+1)*1200)
    const o = Math.round(5 + seededRandom(idx+11)*20)
    const m = Math.round(r*(0.22 + seededRandom(idx+21)*0.15))
    jtlSeries.push({ date:d, revenue:r, orders:o, margin:m }); revTotal+=r; ordersTotal+=o; marginTotal+=m
    const cost = Math.round(50 + seededRandom(idx+31)*200)
    const clicks = Math.round(40 + seededRandom(idx+41)*160)
    const conv = Math.round(2 + seededRandom(idx+51)*10)
    const convValue = Math.round(conv*(40 + seededRandom(idx+61)*80))
    const imp = Math.round(2000 + seededRandom(idx+71)*8000)
    adsSeries.push({ date:d, cost, clicks }); adsCostTotal+=cost; clicksTotal+=clicks; convTotal+=conv; convValTotal+=convValue; impTotal+=imp
  })
  const ga4Totals = { users:Math.round(1200+seededRandom(1)*800), sessions:Math.round(2000+seededRandom(2)*1200), engagedSessions:Math.round(1400+seededRandom(3)*600), revenue:Math.round(3000+seededRandom(4)*2000) }
  const adsCampaigns = [ { name:'Brand DACH', cost:980, clicks:2200, conversions:95, roas:3.8 }, { name:'Bänder Industrie', cost:640, clicks:1400, conversions:52, roas:4.2 }, { name:'Scheiben Handwerk', cost:420, clicks:900, conversions:31, roas:2.9 } ]
  return { jtl:{ totals:{ revenue:revTotal, orders:ordersTotal, margin:marginTotal }, series:jtlSeries }, ads:{ totals:{ cost:adsCostTotal, impressions:impTotal, clicks:clicksTotal, conversions:convTotal, conversion_value:convValTotal, roas: convValTotal>0? (convValTotal/(adsCostTotal||1)).toFixed(2):0 }, series:adsSeries, campaigns:adsCampaigns }, ga4:{ totals:ga4Totals, sourceMedium:[ {sourceMedium:'google / cpc', users:820, sessions:1100, revenue:1800 }, {sourceMedium:'direct / (none)', users:460, sessions:700, revenue:950 }, {sourceMedium:'linkedin / referral', users:210, sessions:300, revenue:420 } ] } }
}

function buildDateParams(searchParams){ const from = searchParams.get('from') || new Date(Date.now()-29*24*3600*1000).toISOString().slice(0,10); const to = searchParams.get('to') || new Date().toISOString().slice(0,10); return { from, to } }

async function jtlPing(req){
  // Basic Auth once; no redeclare
  const authHeader = req?.headers?.get ? (req.headers.get('authorization') || req.headers.get('Authorization')) : undefined
  if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
    try {
      const b64 = authHeader.split(' ')[1]
      const decoded = Buffer.from(b64, 'base64').toString('utf8')
      const [user, password] = decoded.split(':')
      const cfg = { user, password, server: process.env.JTL_SQL_HOST, port: parseInt(process.env.JTL_SQL_PORT||'1433',10), database: process.env.JTL_SQL_DB, pool:{max:1,min:0,idleTimeoutMillis:5000}, options:{ encrypt:false, trustServerCertificate:true } }
      const pool = await new sql.ConnectionPool(cfg).connect()
      const r = await pool.request().query('SELECT DB_NAME() as db, @@VERSION as version')
      await pool.close()
      return { ok:true, db:r.recordset?.[0]?.db, version:r.recordset?.[0]?.version, auth:'basic' }
    } catch (e) {
      return { ok:false, error:String(e?.message||e), auth:'basic' }
    }
  }
  // Fallback to ?u=&p=
  try { const sp=new URL(req.url).searchParams; const u=sp.get('u'); const p=sp.get('p'); if (u && p) { const pool=await new sql.ConnectionPool({ user:u, password:p, server:process.env.JTL_SQL_HOST, port: parseInt(process.env.JTL_SQL_PORT||'1433',10), database:process.env.JTL_SQL_DB, pool:{max:1,min:0,idleTimeoutMillis:5000}, options:{ encrypt:false, trustServerCertificate:true } }).connect(); const r=await pool.request().query('SELECT DB_NAME() as db, @@VERSION as version'); await pool.close(); return { ok:true, db:r.recordset?.[0]?.db, version:r.recordset?.[0]?.version, auth:'query' } } } catch(_) {}
  // Env pool
  const pool = await getMssqlPool(); const r = await pool.request().query('SELECT DB_NAME() as db, @@VERSION as version'); return { ok:true, db:r.recordset?.[0]?.db, version:r.recordset?.[0]?.version, auth:'env' }
}

async function jtlKpi(pool, {from,to}){
  const request = pool.request(); request.input('from', sql.DateTime2, new Date(from+'T00:00:00')); request.input('to', sql.DateTime2, new Date(to+'T23:59:59'))
  const q = `WITH base AS (SELECT r.kRechnung, CAST(r.dErstellt AS date) AS d, ISNULL(rp.kArtikel,0) AS kArtikel, ISNULL(rp.fVKNetto,0) * ISNULL(rp.fMenge,1) AS vk, ISNULL(rp.fEKNetto,0) * ISNULL(rp.fMenge,1) AS ek FROM Rechnung.tRechnung r JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung WHERE r.dErstellt BETWEEN @from AND @to AND NOT EXISTS(SELECT 1 FROM Rechnung.tRechnungStorno s WHERE s.kRechnung = r.kRechnung) AND ISNULL(rp.kArtikel,0) > 0) SELECT SUM(vk) AS revenue, COUNT(DISTINCT kRechnung) AS orders, SUM(vk - ek) AS margin_items FROM base`
  const r = await request.query(q); return { revenue:r.recordset?.[0]?.revenue||0, orders:r.recordset?.[0]?.orders||0, margin:r.recordset?.[0]?.margin_items||0 }
}

async function jtlTopProducts(pool, {from,to,limit=20}){ const request=pool.request(); request.input('from', sql.DateTime2, new Date(from+'T00:00:00')); request.input('to', sql.DateTime2, new Date(to+'T23:59:59')); request.input('limit', sql.Int, limit); const q = `SELECT TOP (@limit) a.cArtNr AS artikelNr, a.cName AS name, SUM(ISNULL(rp.fVKNetto,0)*ISNULL(rp.fMenge,1)) AS umsatz, SUM(ISNULL(rp.fMenge,1)) AS menge, SUM(ISNULL(rp.fVKNetto,0)*ISNULL(rp.fMenge,1) - ISNULL(rp.fEKNetto,0)*ISNULL(rp.fMenge,1)) AS marge FROM Rechnung.tRechnung r JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung LEFT JOIN dbo.tArtikel a ON a.kArtikel = rp.kArtikel WHERE r.dErstellt BETWEEN @from AND @to AND NOT EXISTS(SELECT 1 FROM Rechnung.tRechnungStorno s WHERE s.kRechnung = r.kRechnung) AND ISNULL(rp.kArtikel,0) > 0 GROUP BY a.cArtNr, a.cName ORDER BY umsatz DESC`; const {recordset}=await request.query(q); return recordset||[] }

async function jtlTopCategories(pool,{from,to,limit=20}){ const request=pool.request(); request.input('from', sql.DateTime2, new Date(from+'T00:00:00')); request.input('to', sql.DateTime2, new Date(to+'T23:59:59')); request.input('limit', sql.Int, limit); const q = `SELECT TOP (@limit) k.cName AS kategorie, SUM(ISNULL(rp.fVKNetto,0)*ISNULL(rp.fMenge,1)) AS umsatz, SUM(ISNULL(rp.fMenge,1)) AS menge, SUM(ISNULL(rp.fVKNetto,0)*ISNULL(rp.fMenge,1) - ISNULL(rp.fEKNetto,0)*ISNULL(rp.fMenge,1)) AS marge FROM Rechnung.tRechnung r JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung JOIN dbo.tkategorieartikel ka ON ka.kArtikel = rp.kArtikel JOIN dbo.tkategorie k ON k.kKategorie = ka.kKategorie WHERE r.dErstellt BETWEEN @from AND @to AND NOT EXISTS(SELECT 1 FROM Rechnung.tRechnungStorno s WHERE s.kRechnung = r.kRechnung) AND ISNULL(rp.kArtikel,0) > 0 GROUP BY k.cName ORDER BY umsatz DESC`; const {recordset}=await request.query(q); return recordset||[] }

async function jtlTimeseries(pool,{from,to}){ const request=pool.request(); request.input('from', sql.DateTime2, new Date(from+'T00:00:00')); request.input('to', sql.DateTime2, new Date(to+'T23:59:59')); const q = `SELECT CONVERT(date, r.dErstellt) AS date, SUM(ISNULL(rp.fVKNetto,0)*ISNULL(rp.fMenge,1)) AS revenue, COUNT(DISTINCT r.kRechnung) AS orders, SUM(ISNULL(rp.fVKNetto,0)*ISNULL(rp.fMenge,1) - ISNULL(rp.fEKNetto,0)*ISNULL(rp.fMenge,1)) AS margin FROM Rechnung.tRechnung r JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung WHERE r.dErstellt BETWEEN @from AND @to AND NOT EXISTS(SELECT 1 FROM Rechnung.tRechnungStorno s WHERE s.kRechnung = r.kRechnung) AND ISNULL(rp.kArtikel,0) > 0 GROUP BY CONVERT(date, r.dErstellt) ORDER BY date`; const {recordset}=await request.query(q); return recordset||[] }

async function jtlPlatformTimeseries(pool,{from,to}){ const request=pool.request(); request.input('from', sql.DateTime2, new Date(from+'T00:00:00')); request.input('to', sql.DateTime2, new Date(to+'T23:59:59')); const q = `WITH pos AS (SELECT r.kRechnung, CONVERT(date, r.dErstellt) AS d, ISNULL(rp.fVKNetto,0)*ISNULL(rp.fMenge,1) AS vk, ar.kAuftrag FROM Rechnung.tRechnung r JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung LEFT JOIN Verkauf.tAuftragRechnung ar ON ar.kRechnung = r.kRechnung WHERE r.dErstellt BETWEEN @from AND @to AND NOT EXISTS(SELECT 1 FROM Rechnung.tRechnungStorno s WHERE s.kRechnung = r.kRechnung) AND ISNULL(rp.kArtikel,0) > 0), ax AS (SELECT p.d, p.vk, a.kPlattform, a.kShop, p.kRechnung FROM pos p LEFT JOIN Verkauf.tAuftrag a ON a.kAuftrag = p.kAuftrag) SELECT CASE WHEN ax.kPlattform IS NOT NULL AND ax.kPlattform>0 THEN ISNULL(pl.cName,'Plattform') WHEN ax.kShop IS NOT NULL AND ax.kShop>0 THEN ISNULL(s.cName,'Shop') ELSE 'Direktvertrieb' END AS pName, ax.d AS date, SUM(ax.vk) AS revenue FROM ax LEFT JOIN dbo.tPlattform pl ON pl.kPlattform = ax.kPlattform LEFT JOIN dbo.tShop s ON s.kShop = ax.kShop GROUP BY CASE WHEN ax.kPlattform IS NOT NULL AND ax.kPlattform>0 THEN ISNULL(pl.cName,'Plattform') WHEN ax.kShop IS NOT NULL AND ax.kShop>0 THEN ISNULL(s.cName,'Shop') ELSE 'Direktvertrieb' END, ax.d ORDER BY ax.d`; const {recordset}=await request.query(q); return recordset||[] }

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') { return cors(NextResponse.json({ message: 'Score Zentrale API online' })) }

    if (route === '/jtl/ping' && method === 'GET') { const data = await jtlPing(request); return cors(NextResponse.json(data)) }
    if (route === '/jtl/sales/kpi' && method === 'GET') { const pool=await getMssqlPool(); const {from,to}=buildDateParams(new URL(request.url).searchParams); const data=await jtlKpi(pool,{from,to}); return cors(NextResponse.json(data)) }
    if (route === '/jtl/sales/top-products' && method === 'GET') { const pool=await getMssqlPool(); const sp=new URL(request.url).searchParams; const {from,to}=buildDateParams(sp); const limit=parseInt(sp.get('limit')||'20',10); const list=await jtlTopProducts(pool,{from,to,limit}); return cors(NextResponse.json(list)) }
    if (route === '/jtl/sales/top-categories' && method === 'GET') { const pool=await getMssqlPool(); const sp=new URL(request.url).searchParams; const {from,to}=buildDateParams(sp); const limit=parseInt(sp.get('limit')||'20',10); const list=await jtlTopCategories(pool,{from,to,limit}); return cors(NextResponse.json(list)) }
    if (route === '/jtl/sales/timeseries' && method === 'GET') { const pool=await getMssqlPool(); const {from,to}=buildDateParams(new URL(request.url).searchParams); const list=await jtlTimeseries(pool,{from,to}); return cors(NextResponse.json(list)) }
    if (route === '/jtl/sales/platform-timeseries' && method === 'GET') { const pool=await getMssqlPool(); const {from,to}=buildDateParams(new URL(request.url).searchParams); const list=await jtlPlatformTimeseries(pool,{from,to}); return cors(NextResponse.json(list)) }

    if (route === '/kpis' && method === 'GET') { const data = generateKpisMock(); return cors(NextResponse.json(data)) }

    if (route === '/prospects' && method === 'GET') { const items = await db.collection('prospects').find({}).sort({ createdAt:-1 }).limit(200).toArray(); const cleaned = items.map(({ _id, ...rest }) => rest); return cors(NextResponse.json(cleaned)) }
    if (route === '/prospects' && method === 'POST') { const body=await request.json(); const now=new Date(); const domain=(body.website||'').replace(/^https?:\/\//,'').replace(/\/.*$/,'').toLowerCase(); const existing=await db.collection('prospects').findOne({ website:{ $regex:domain,$options:'i' } }); if (existing) return cors(NextResponse.json({ duplicate:true, prospect:{ ...existing, _id: undefined } })); const doc={ id:uuidv4(), name:body.name||domain||'Unbekannt', website:body.website||'', region:body.region||'', industry:body.industry||'', size:body.size||'', source:body.source||'manual', linkedinUrl:body.linkedinUrl||'', score:Math.round(50+Math.random()*50), createdAt:now, ownerUid:body.ownerUid||null }; await db.collection('prospects').insertOne(doc); const { _id, ...cleanDoc } = doc; return cors(NextResponse.json(cleanDoc)) }

    if (route === '/analyze' && method === 'POST') { const body=await request.json(); const industry=(body.industry||'').toLowerCase(); const name=body.name||'Firma'; const website=body.website||''; const mappings={ metall:{ productGroups:['Schleifbänder','Fiberscheiben','Fächerscheiben','Vlies','Trennscheiben'], materials:['Baustahl','Edelstahl','Aluminium'], machines:['Bandschleifer','Winkelschleifer','Stationär'] }, holz:{ productGroups:['Schleifbänder','Schleifscheiben','Vlies'], materials:['Hartholz','Weichholz','MDF'], machines:['Bandschleifer','Exzenterschleifer','Parkett'] } }; const key=industry.includes('metall')?'metall':industry.includes('holz')?'holz':'metall'; const base=mappings[key]; const hypotheses=[ {need:'Bänder 50×2000',grit:'K80',quality:'VSM XK870X',use:'Kanten-/Flächenschliff'},{need:'Fiberscheiben Ø125',grit:'K60',quality:'Klingspor CS565',use:'Schweißnahtbearbeitung'},{need:'Vliesrolle 115×10m',grit:'Sehr fein',quality:'3M',use:'Oberflächenfinish'} ]; const result={ company:{ name, website, industry: body.industry||'' }, materials:base.materials, machines:base.machines, productGroups:base.productGroups, hypotheses }; const companyDoc={ id:uuidv4(), domain:website.replace(/^https?:\/\//,'').replace(/\/.*$/,'').toLowerCase(), name, industry: body.industry||'', techNotes:'', scoreTags: base.productGroups, lastAnalyzedAt:new Date() }; const mongo=await connectToMongo(); await mongo.collection('companies').updateOne({ domain:companyDoc.domain },{ $set:companyDoc },{ upsert:true }); await mongo.collection('activities').insertOne({ id:uuidv4(), type:'analyze', refId:companyDoc.id, note:`Analyze mock for ${name}`, createdAt:new Date(), user: body.user||null }); return cors(NextResponse.json(result)) }

    if (route === '/mailer/compose' && method === 'POST') { const body=await request.json(); const company=body.company||'Ihr Unternehmen'; const contactRole=body.contactRole||'Einkauf'; const industry=body.industry||'Industrie'; const useCases=Array.isArray(body.useCases)?body.useCases.join(', '):(body.useCases||'Schleifanwendungen'); const hypotheses=Array.isArray(body.hypotheses)?body.hypotheses.map(h=> (typeof h==='string'?h:`${h.need||''} ${h.grit||''} ${h.quality||''}`)).join('; '):(body.hypotheses||''); const subject=`Kurzabstimmung Schleifbedarf – ${company}`; const text=`Guten Tag ${contactRole},\n\nwir unterstützen Fertiger aus der ${industry} bei der zuverlässigen Versorgung mit Schleifmitteln.\nAuf Basis Ihrer Anwendungen (${useCases}) sehe ich u.a.: ${hypotheses}.\n\nWenn Sie möchten, klären wir in 10 Minuten die aktuell benötigten Größen/Körnungen und Referenzqualitäten – ich sende direkt Muster/Angebot.\n\nPasst ein kurzer Austausch diese oder nächste Woche?\n\nBeste Grüße\nSCORE Schleifwerkzeuge`; const html=`<p>Guten Tag ${contactRole},</p><p>wir unterstützen Fertiger aus der <strong>${industry}</strong> bei der zuverlässigen Versorgung mit Schleifmitteln.</p><p>Auf Basis Ihrer Anwendungen (${useCases}) sehe ich u.a.: ${hypotheses}.</p><p>Wenn Sie möchten, klären wir in 10 Minuten die aktuell benötigten Größen/Körnungen und Referenzqualitäten – ich sende direkt Muster/Angebot.</p><p>Passt ein kurzer Austausch diese oder nächste Woche?</p><p>Beste Grüße<br/>SCORE Schleifwerkzeuge</p>`; return cors(NextResponse.json({ subject, text, html })) }

    if (route === '/emails' && method === 'POST') { const body=await request.json(); const doc={ id:uuidv4(), companyId:body.companyId||null, contactId:body.contactId||null, subject:body.subject||'', body:body.body||'', status:'draft', sentAt:null }; const mongo=await connectToMongo(); await mongo.collection('emails').insertOne(doc); return cors(NextResponse.json(doc)) }

    if (route === '/status' && method === 'POST') { const body=await request.json(); if (!body.client_name) return cors(NextResponse.json({ error:'client_name is required' }, { status:400 })); const statusObj={ id:uuidv4(), client_name:body.client_name, timestamp:new Date() }; const mongo=await connectToMongo(); await mongo.collection('status_checks').insertOne(statusObj); return cors(NextResponse.json(statusObj)) }
    if (route === '/status' && method === 'GET') { const mongo=await connectToMongo(); const statusChecks=await mongo.collection('status_checks').find({}).limit(1000).toArray(); const cleaned=statusChecks.map(({ _id, ...rest })=>rest); return cors(NextResponse.json(cleaned)) }

    return cors(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (err) {
    console.error('API Error:', err)
    return cors(NextResponse.json({ error: 'Internal server error', detail: String(err?.message||err) }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
