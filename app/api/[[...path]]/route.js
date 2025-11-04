export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import sql from 'mssql'

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

function buildDateParams(searchParams){
  const month = searchParams.get('month')
  if (month) {
    const [y,m] = month.split('-').map(x=>parseInt(x,10))
    const from = new Date(Date.UTC(y, m-1, 1)).toISOString().slice(0,10)
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0,10)
    return { from, to }
  }
  const from = searchParams.get('from') || new Date(Date.now()-29*24*3600*1000).toISOString().slice(0,10)
  const to = searchParams.get('to') || new Date().toISOString().slice(0,10)
  return { from, to }
}

function parseIdsParam(sp, key){
  const raw = sp.get(key)
  if (!raw) return []
  return raw.split(',').map(s=>parseInt(s.trim(),10)).filter(n=>Number.isFinite(n))
}

function autoGrain(from, to, userGrain){
  if (userGrain && userGrain !== 'auto') return userGrain
  const days = (new Date(to).getTime() - new Date(from).getTime())/86400000
  return days <= 60 ? 'day' : (days <= 548 ? 'month' : 'year')
}

// Helpers for MSSQL metadata and dynamic SQL building
async function hasColumn(pool, table, column){
  const r = await pool.request()
    .input('tbl', sql.NVarChar, table)
    .input('col', sql.NVarChar, column)
    .query('SELECT COUNT(*) AS ok FROM sys.columns WHERE object_id = OBJECT_ID(@tbl) AND name = @col')
  return ((r?.recordset?.[0]?.ok ?? 0) > 0)
}

async function getOnlyArticleWhere(pool, table, alias){
  const has = await hasColumn(pool, table, 'nPosTyp')
  if (has) return `${alias}.nPosTyp = 1`
  return `${alias}.kArtikel > 0 AND ISNULL(${alias}.cName,'') NOT LIKE 'Versand%' AND ISNULL(${alias}.cName,'') NOT LIKE 'Gutschein%' AND ISNULL(${alias}.cName,'') NOT LIKE 'Rabatt%' AND ISNULL(${alias}.cName,'') NOT LIKE 'Pfand%'`
}

async function getShippingPredicate(pool, table, alias){
  const has = await hasColumn(pool, table, 'nPosTyp')
  if (has) return `${alias}.nPosTyp IN (3,4)`
  // Fallback: erkennen Versand auch dann, wenn als Artikel geführt wird (kArtikel > 0)
  return `(ISNULL(${alias}.cName,'') LIKE 'Versand%' OR ISNULL(${alias}.cArtNr,'') LIKE 'VERSAND%' OR ISNULL(${alias}.cName,'') LIKE '%Shipping%' OR ISNULL(${alias}.cName,'') LIKE 'Fracht%' OR ISNULL(${alias}.cName,'') LIKE 'Porto%' OR ISNULL(${alias}.cName,'') LIKE 'Transport%')`
}

async function pickFirstExisting(pool, table, candidates){
  for (const c of candidates){ if (await hasColumn(pool, table, c)) return c }
  return null
}

function json(data, init){ return cors(NextResponse.json(data, init)) }

function buildChannelSql(channel, platformIds, shopIds, hasPlat, hasShop){
  const parts = []
  const platExpr = hasPlat ? 'o.kPlattform' : null
  const shopExpr = hasShop ? 'o.kShop' : null
  if (channel && channel !== 'all'){
    if (channel === 'platform' && platExpr) parts.push(`${platExpr} IS NOT NULL`)
    else if (channel === 'shop' && shopExpr) parts.push(`${shopExpr} IS NOT NULL${platExpr?` AND ${platExpr} IS NULL`:''}`)
    else if (channel === 'direct'){
      const conds = []
      if (platExpr) conds.push(`${platExpr} IS NULL`)
      if (shopExpr) conds.push(`${shopExpr} IS NULL`)
      if (conds.length) parts.push(conds.join(' AND '))
    }
  }
  if (platformIds?.length && platExpr) parts.push(`${platExpr} IN (${platformIds.map(n=>n).join(',')})`)
  if (shopIds?.length && shopExpr) parts.push(`${shopExpr} IN (${shopIds.map(n=>n).join(',')})`)
  return parts.length ? (' AND ' + parts.join(' AND ')) : ''
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method
  console.log('API route hit', { method, route, url: request.url })

  try {
    const db = await connectToMongo()

    // Root health
    if ((route === '/' || route === '/root') && method === 'GET') { return json({ message: 'Score Zentrale API online' }) }

    // Basic status storage
    if (route === '/status' && method === 'POST'){
      const body = await request.json()
      const rec = { id: uuidv4(), createdAt: new Date().toISOString(), ...body }
      await db.collection('status_checks').insertOne(rec)
      return json(rec)
    }
    if (route === '/status' && method === 'GET'){
      const list = await db.collection('status_checks').find({}).sort({ createdAt: -1 }).limit(50).toArray()
      const cleaned = list.map(({ _id, ...rest }) => rest)
      return json(cleaned)
    }

    // Prospects CRUD
    if (route === '/prospects' && method === 'GET'){
      const arr = await db.collection('prospects').find({}).sort({ createdAt: -1 }).limit(200).toArray()
      return json(arr.map(({ _id, ...r})=>r))
    }
    if (route === '/prospects' && method === 'POST'){
      const body = await request.json()
      const id = uuidv4()
      const createdAt = new Date().toISOString()
      const score = Math.min(100, Math.max(10, Math.round((body?.industry?.length||5) * 7 + (body?.keywords?.split(',').length||1) * 6)))
      const doc = { id, createdAt, ...body, score }
      const existing = await db.collection('prospects').findOne({ website: { $regex: new RegExp((body.website||'').replace(/^https?:\/\//,''), 'i') } })
      if (!existing) await db.collection('prospects').insertOne(doc)
      const { _id, ...cleanDoc } = doc
      return json(cleanDoc)
    }

    // Analyze (mock)
    if (route === '/analyze' && method === 'POST'){
      const body = await request.json()
      const company = { id: uuidv4(), name: body.name, website: body.website, industry: body.industry, createdAt: new Date().toISOString() }
      await db.collection('companies').insertOne(company)
      await db.collection('activities').insertOne({ id: uuidv4(), type:'analyze', companyId: company.id, createdAt: new Date().toISOString() })
      return json({ productGroups: ['Schleifbänder','Fiberscheiben','Schleifscheiben','Lamellen','Vlies'], materials: ['Stahl','Edelstahl','Holz'], hypotheses: ['K80/120 Bedarf','Bandmaße 50×2000','Ø125mm'] })
    }

    // Mailer compose (mock)
    if (route === '/mailer/compose' && method === 'POST'){
      const body = await request.json()
      const subject = `Qualitätsschliff für ${body.company} – Vorschlag aus der Praxis`
      const text = `Hallo ${body.contactRole||'Ansprechpartner'},\n\nwir haben für ${body.company} (${body.industry||'Branche'}) passende Schleiflösungen zusammengestellt: ${Array.isArray(body.useCases)?body.useCases.join(', '):body.useCases}.\nHypothesen: ${body.hypotheses||'-'}.\n\nViele Grüße\nSCORE`
      const html = `<p>Hallo ${body.contactRole||'Team'},</p><p>Für <strong>${body.company}</strong> sehen wir Potential in: <em>${Array.isArray(body.useCases)?body.useCases.join(', '):body.useCases}</em>.</p><p>Hypothesen: ${body.hypotheses||'-'}.</p><p>Viele Grüße<br/>SCORE</p>`
      return json({ subject, text, html })
    }

    // ========== JTL DIAG ==========
    if (route === '/jtl/diag/columns' && method === 'GET') {
      const sp = new URL(request.url).searchParams
      const table = sp.get('table') || 'Rechnung.tRechnungPosition'
      const pool = await getMssqlPool()
      const r = await pool.request().input('t', sql.NVarChar, table).query(`SELECT c.name AS col, t.name AS type
        FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
        WHERE c.object_id = OBJECT_ID(@t)
        ORDER BY c.column_id`)
      const cols = r.recordset || []
      return json({ ok:true, table, cols })
    }

    if (route === '/jtl/ping' && method === 'GET'){
      try {
        const pool = await getMssqlPool()
        const hasNPosTypR = await hasColumn(pool, 'Rechnung.tRechnungPosition', 'nPosTyp')
        const hasNPosTypO = await hasColumn(pool, 'Verkauf.tAuftragPosition', 'nPosTyp')
        return json({ ok:true, sql:{ server: process.env.JTL_SQL_HOST, db: process.env.JTL_SQL_DB, hasNPosTypRechnung: hasNPosTypR, hasNPosTypAuftrag: hasNPosTypO } })
      } catch(err){
        return json({ ok:false, error: String(err?.message||err) })
      }
    }

    // ========== JTL SALES: DATE RANGE (RECHNUNG) ==========
    if (route === '/jtl/sales/date-range' && method === 'GET'){
      const pool = await getMssqlPool()
      try {
        const where = await getOnlyArticleWhere(pool, 'Rechnung.tRechnungPosition', 'rp')
        const q = `SELECT MIN(CONVERT(date, r.dErstellt)) AS minDate, MAX(CONVERT(date, r.dErstellt)) AS maxDate
                   FROM Rechnung.tRechnung r
                   JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung
                   WHERE ${where}`
        const r = await pool.request().query(q)
        const row = r?.recordset?.[0] || {}
        return json({ ok:true, minDate: row.minDate ? new Date(row.minDate).toISOString().slice(0,10) : null, maxDate: row.maxDate ? new Date(row.maxDate).toISOString().slice(0,10) : null })
      } catch(err){
        console.error('date-range SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // Helper: dynamic aggregates for Rechnung
    async function buildAggExprsRechnung(pool){
      const table = 'Rechnung.tRechnungPosition'
      const rev = await pickFirstExisting(pool, table, ['fVKNetto','fNetto','fVKBrutto','fBrutto','fPreis'])
      const cost = await pickFirstExisting(pool, table, ['fEKNetto','fEK','fEKBrutto','fEK'])
      return { rev: rev ? `${'rp'}.[${rev}]` : 'CAST(0 AS float)', cost: cost ? `${'rp'}.[${cost}]` : 'CAST(0 AS float)' }
    }

    // ========== JTL SALES: KPI (RECHNUNG) ==========
    if (route === '/jtl/sales/kpi' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      try{
        const pool = await getMssqlPool()
        const { rev, cost } = await buildAggExprsRechnung(pool)
        const where = await getOnlyArticleWhere(pool, 'Rechnung.tRechnungPosition', 'rp')
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          SELECT 
            CAST(SUM(CAST(${rev} AS float)) AS float) AS revenue,
            COUNT(DISTINCT r.kRechnung) AS orders,
            CAST(SUM(CAST(${rev} AS float) - CAST(${cost} AS float)) AS float) AS margin
          FROM Rechnung.tRechnung r
          JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung
          WHERE ${where} AND CONVERT(date, r.dErstellt) BETWEEN @from AND @to`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        const row = res?.recordset?.[0] || {}
        return json({ ok:true, from, to, revenue: row.revenue||0, orders: row.orders||0, margin: row.margin||0 })
      } catch(err){
        console.error('kpi SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // KPI with platform fees (RECHNUNG)
    if (route === '/jtl/sales/kpi/with_platform_fees' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      try{
        const pool = await getMssqlPool()
        const { rev, cost } = await buildAggExprsRechnung(pool)
        const where = await getOnlyArticleWhere(pool, 'Rechnung.tRechnungPosition', 'rp')
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto, @feePct float = 0.20, @feeFix float = 1.5;
          WITH base AS (
            SELECT r.kRechnung, CAST(CONVERT(date, r.dErstellt) AS date) AS d, 
                   SUM(CAST(${rev} AS float)) AS revenue,
                   SUM(CAST(${rev} AS float) - CAST(${cost} AS float)) AS margin
            FROM Rechnung.tRechnung r
            JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung
            WHERE ${where} AND CONVERT(date, r.dErstellt) BETWEEN @from AND @to
            GROUP BY r.kRechnung, CONVERT(date, r.dErstellt)
          )
          SELECT 
            CAST(SUM(revenue) AS float) AS revenue,
            COUNT(DISTINCT kRechnung) AS orders,
            CAST(SUM(margin - (revenue*@feePct) - @feeFix) AS float) AS margin_with_fees
          FROM base`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        const row = res?.recordset?.[0] || {}
        return json({ ok:true, from, to, revenue: row.revenue||0, orders: row.orders||0, margin_with_fees: row.margin_with_fees||0 })
      } catch(err){
        console.error('kpi fees SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // Timeseries (RECHNUNG)
    if (route === '/jtl/sales/timeseries' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      try{
        const pool = await getMssqlPool()
        const { rev, cost } = await buildAggExprsRechnung(pool)
        const where = await getOnlyArticleWhere(pool, 'Rechnung.tRechnungPosition', 'rp')
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          SELECT CONVERT(date, r.dErstellt) AS date,
                 CAST(SUM(CAST(${rev} AS float)) AS float) AS revenue,
                 CAST(SUM(CAST(${rev} AS float) - CAST(${cost} AS float)) AS float) AS margin
          FROM Rechnung.tRechnung r
          JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung
          WHERE ${where} AND CONVERT(date, r.dErstellt) BETWEEN @from AND @to
          GROUP BY CONVERT(date, r.dErstellt)
          ORDER BY date ASC`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        return json(res.recordset || [])
      } catch(err){
        console.error('timeseries SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // Timeseries with platform fees (RECHNUNG)
    if (route === '/jtl/sales/timeseries/with_platform_fees' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      try{
        const pool = await getMssqlPool()
        const { rev, cost } = await buildAggExprsRechnung(pool)
        const where = await getOnlyArticleWhere(pool, 'Rechnung.tRechnungPosition', 'rp')
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto, @feePct float = 0.20, @feeFix float = 1.5;
          WITH base AS (
            SELECT CAST(CONVERT(date, r.dErstellt) AS date) AS date, r.kRechnung,
                   SUM(CAST(${rev} AS float)) AS revenue,
                   SUM(CAST(${rev} AS float) - CAST(${cost} AS float)) AS margin
            FROM Rechnung.tRechnung r
            JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung
            WHERE ${where} AND CONVERT(date, r.dErstellt) BETWEEN @from AND @to
            GROUP BY CONVERT(date, r.dErstellt), r.kRechnung
          )
          SELECT date,
                 CAST(SUM(revenue) AS float) AS revenue,
                 CAST(SUM(margin - (revenue*@feePct) - @feeFix) AS float) AS margin_with_fees
          FROM base
          GROUP BY date
          ORDER BY date ASC`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        return json(res.recordset || [])
      } catch(err){
        console.error('timeseries fees SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // Platform timeseries (RECHNUNG)
    if (route === '/jtl/sales/platform-timeseries' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      try{
        const pool = await getMssqlPool()
        const cols = ['cBestellNr','cInetBestellnummer','cHinweis','cRechnungsNr']
        const present = []
        for (const c of cols){ if (await hasColumn(pool, 'Rechnung.tRechnung', c)) present.push(`ISNULL(r.[${c}], '')`) }
        const source = present.length ? present.join(` + ' ' + `) : `''`
        const platformCase = `CASE 
            WHEN LOWER(${source}) LIKE '%amazon%' THEN 'Amazon'
            WHEN LOWER(${source}) LIKE '%ebay%' THEN 'eBay'
            WHEN LOWER(${source}) LIKE '%shop%' OR LOWER(${source}) LIKE '%woocommerce%' OR LOWER(${source}) LIKE '%shopify%' THEN 'Shop'
            ELSE 'Sonstige' END`
        const { rev } = await buildAggExprsRechnung(pool)
        const where = await getOnlyArticleWhere(pool, 'Rechnung.tRechnungPosition', 'rp')
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          SELECT CONVERT(date, r.dErstellt) AS date, ${platformCase} AS pName,
                 CAST(SUM(CAST(${rev} AS float)) AS float) AS revenue
          FROM Rechnung.tRechnung r
          JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung
          WHERE ${where} AND CONVERT(date, r.dErstellt) BETWEEN @from AND @to
          GROUP BY CONVERT(date, r.dErstellt), ${platformCase}
          ORDER BY date ASC`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        return json(res.recordset || [])
      } catch(err){
        console.error('platform-timeseries SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // Top products (RECHNUNG)
    if (route === '/jtl/sales/top-products' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      const limit = parseInt(sp.get('limit')||'20', 10)
      try{
        const pool = await getMssqlPool()
        const { rev, cost } = await buildAggExprsRechnung(pool)
        const artNrCol = await pickFirstExisting(pool, 'Rechnung.tRechnungPosition', ['cArtNr','cArtikelNr','Artikelnummer'])
        const nameCol = await pickFirstExisting(pool, 'Rechnung.tRechnungPosition', ['cName','cBez','cBezeichnung'])
        const grp = [artNrCol?`rp.[${artNrCol}]`:"''", nameCol?`rp.[${nameCol}]`:"''"].join(', ')
        const where = await getOnlyArticleWhere(pool, 'Rechnung.tRechnungPosition', 'rp')
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          SELECT TOP (${limit}) 
            ${artNrCol?`rp.[${artNrCol}]`:"''"} AS artikelNr,
            ${nameCol?`rp.[${nameCol}]`:"''"} AS name,
            CAST(SUM(CAST(${rev} AS float)) AS float) AS umsatz,
            CAST(SUM(CAST(${rev} AS float) - CAST(${cost} AS float)) AS float) AS marge,
            CAST(SUM((CAST(${rev} AS float) - CAST(${cost} AS float)) - (CAST(${rev} AS float)*0.20) - 1.5) AS float) AS marge_with_fees
          FROM Rechnung.tRechnung r
          JOIN Rechnung.tRechnungPosition rp ON rp.kRechnung = r.kRechnung
          WHERE ${where} AND CONVERT(date, r.dErstellt) BETWEEN @from AND @to
          GROUP BY ${grp}
          ORDER BY umsatz DESC`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        return json(res.recordset || [])
      } catch(err){
        console.error('top-products SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // Top categories placeholder (RECHNUNG)
    if (route === '/jtl/sales/top-categories' && method === 'GET'){
      return json([])
    }

    // ========== NEW: ORDERS SHIPPING SPLIT KPI (AUFTRAG) ==========
    if (route === '/jtl/orders/kpi/shipping-split' && (method === 'GET' || method === 'POST')){
      const sp = new URL(request.url).searchParams
      const body = method === 'POST' ? (await request.json().catch(()=>({}))) : {}
      const { from, to } = buildDateParams(sp)
      const channel = (sp.get('channel') || body.channel || 'all').toLowerCase()
      const platformIds = (body.platformIds && Array.isArray(body.platformIds)) ? body.platformIds : parseIdsParam(sp, 'platformIds')
      const shopIds = (body.shopIds && Array.isArray(body.shopIds)) ? body.shopIds : parseIdsParam(sp, 'shopIds')
      try {
        const pool = await getMssqlPool()
        const table = 'Verkauf.tAuftragPosition'
        const extNetCol = await pickFirstExisting(pool, table, ['fGesamtNetto','fVKNettoGesamt','fWertNetto','fWert'])
        const extGrossCol = await pickFirstExisting(pool, table, ['fGesamtBrutto','fVKBruttoGesamt','fWertBrutto'])
        const netCol = await pickFirstExisting(pool, table, ['fVKNetto','fNetto','fPreisNetto'])
        const grossCol = await pickFirstExisting(pool, table, ['fVKBrutto','fBrutto','fPreisBrutto'])
        const qtyCol = await pickFirstExisting(pool, table, ['fMenge','nMenge','fAnzahl'])
        const taxCol = await pickFirstExisting(pool, table, ['fMwSt','fMwst','fMwStProzent'])
        const extendedAny = !!(extNetCol || extGrossCol)
        const qtyExpr = extendedAny ? 'CAST(1 AS float)' : (qtyCol ? `CAST(op.[${qtyCol}] AS float)` : 'CAST(1 AS float)')
        const taxExpr = taxCol ? `CAST(op.[${taxCol}] AS float)` : 'CAST(0 AS float)'
        // Totals pro Position (nicht Einheit): bevorzugt Positionssummen, sonst Einheit*Qty, mit robuster Ableitung
        const netTotalExpr = extNetCol
          ? `CAST(op.[${extNetCol}] AS float)`
          : (netCol ? `(CAST(op.[${netCol}] AS float) * ${qtyExpr})`
                    : (extGrossCol ? `(CAST(op.[${extGrossCol}] AS float) / NULLIF(1 + (${taxExpr}/100.0),0))`
                                   : (grossCol ? `((CAST(op.[${grossCol}] AS float) * ${qtyExpr}) / NULLIF(1 + (${taxExpr}/100.0),0))`
                                               : 'CAST(0 AS float)')))
        const grossTotalExpr = extGrossCol
          ? `CAST(op.[${extGrossCol}] AS float)`
          : (grossCol ? `(CAST(op.[${grossCol}] AS float) * ${qtyExpr})`
                      : `(${netTotalExpr}) * (1 + (${taxExpr}/100.0))`)
        const isShipping = await getShippingPredicate(pool, table, 'op')
        const cancelCheck = (await hasColumn(pool, 'Verkauf.tAuftrag', 'nStorno')) ? 'AND ISNULL(o.nStorno,0)=0' : ''
        const channelSql = buildChannelSql(channel, platformIds, shopIds)
        const articleWhere = await getOnlyArticleWhere(pool, 'Verkauf.tAuftragPosition', 'op')
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          ;WITH heads AS (
            SELECT DISTINCT o.kAuftrag
            FROM Verkauf.tAuftrag o
            JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
            WHERE o.dErstellt >= @from AND o.dErstellt < DATEADD(day,1,@to) ${cancelCheck} ${channelSql} AND (${articleWhere})
          )
          SELECT 
            COUNT(DISTINCT h.kAuftrag) AS orders,
            CAST(SUM(${netTotalExpr}) AS float) AS net_with_shipping,
            CAST(SUM(CASE WHEN NOT (${isShipping}) THEN ${netTotalExpr} ELSE 0 END) AS float) AS net_without_shipping,
            CAST(SUM(${grossTotalExpr}) AS float) AS gross_with_shipping,
            CAST(SUM(CASE WHEN NOT (${isShipping}) THEN ${grossTotalExpr} ELSE 0 END) AS float) AS gross_without_shipping
          FROM heads h
          JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = h.kAuftrag`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        const row = res?.recordset?.[0] || {}
        return json({ ok:true, period:{ from, to }, orders: row.orders||0, net_without_shipping: row.net_without_shipping||0, net_with_shipping: row.net_with_shipping||0, gross_without_shipping: row.gross_without_shipping||0, gross_with_shipping: row.gross_with_shipping||0 })
      } catch(err){
        console.error('orders shipping-split SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // ========== NEW: ORDERS TIMESERIES (AUFTRAG) ==========
    if (route === '/jtl/orders/timeseries' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      const channel = (sp.get('channel') || 'all').toLowerCase()
      const platformIds = parseIdsParam(sp, 'platformIds')
      const shopIds = parseIdsParam(sp, 'shopIds')
      const userGrain = (sp.get('grain') || 'auto').toLowerCase()
      const grain = autoGrain(from, to, userGrain)
      try {
        const pool = await getMssqlPool()
        const table = 'Verkauf.tAuftragPosition'
        const extNetCol = await pickFirstExisting(pool, table, ['fGesamtNetto','fVKNettoGesamt','fWertNetto','fWert'])
        const extGrossCol = await pickFirstExisting(pool, table, ['fGesamtBrutto','fVKBruttoGesamt','fWertBrutto'])
        const netCol = await pickFirstExisting(pool, table, ['fVKNetto','fNetto','fPreisNetto'])
        const grossCol = await pickFirstExisting(pool, table, ['fVKBrutto','fBrutto','fPreisBrutto'])
        const qtyCol = await pickFirstExisting(pool, table, ['fMenge','nMenge','fAnzahl'])
        const taxCol = await pickFirstExisting(pool, table, ['fMwSt','fMwst','fMwStProzent'])
        const extendedAny = !!(extNetCol || extGrossCol)
        const qtyExpr = extendedAny ? 'CAST(1 AS float)' : (qtyCol ? `CAST(op.[${qtyCol}] AS float)` : 'CAST(1 AS float)')
        const netExpr = extNetCol ? `CAST(op.[${extNetCol}] AS float)` : (netCol ? `CAST(op.[${netCol}] AS float)` : 'CAST(0 AS float)')
        const grossExpr = extGrossCol
          ? `CAST(op.[${extGrossCol}] AS float)`
          : (grossCol ? `CAST(op.[${grossCol}] AS float)` : `(${netExpr}) * (1 + (CAST(${taxCol?`op.[${taxCol}]`:'0'} AS float)/100.0))`)
        const isShipping = await getShippingPredicate(pool, table, 'op')
        const cancelCheck = (await hasColumn(pool, 'Verkauf.tAuftrag', 'nStorno')) ? 'AND ISNULL(o.nStorno,0)=0' : ''
        const channelSql = buildChannelSql(channel, platformIds, shopIds)
        const bucket = grain === 'day' ? "CAST(o.dErstellt AS date)"
                     : grain === 'month' ? "DATEFROMPARTS(YEAR(o.dErstellt), MONTH(o.dErstellt), 1)"
                     : "DATEFROMPARTS(YEAR(o.dErstellt), 1, 1)"
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          ;WITH base AS (
            SELECT ${bucket} AS d,
                   CASE WHEN ${isShipping} THEN 1 ELSE 0 END AS is_ship,
                   (${netExpr}) * (${qtyExpr}) AS net,
                   (${grossExpr}) * (${qtyExpr}) AS gross,
                   o.kAuftrag
            FROM Verkauf.tAuftrag o
            JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
            WHERE o.dErstellt >= @from AND o.dErstellt < DATEADD(day,1,@to) ${cancelCheck} ${channelSql}
          )
          SELECT d AS date,
                 CAST(SUM(CASE WHEN is_ship=0 THEN net   ELSE 0 END) AS float) AS net_wo_ship,
                 CAST(SUM(net) AS float) AS net_w_ship,
                 CAST(SUM(CASE WHEN is_ship=0 THEN gross ELSE 0 END) AS float) AS gross_wo_ship,
                 CAST(SUM(gross) AS float) AS gross_w_ship,
                 COUNT(DISTINCT kAuftrag) AS orders
          FROM base
          GROUP BY d
          ORDER BY d ASC`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        return json({ ok:true, grain, rows: res.recordset || [] })
      } catch(err){
        console.error('orders timeseries SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // ========== NEW: ORDERS PLATFORM TIMESERIES ==========
    if (route === '/jtl/orders/platform-timeseries' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      const channel = (sp.get('channel') || 'all').toLowerCase()
      const platformIds = parseIdsParam(sp, 'platformIds')
      const shopIds = parseIdsParam(sp, 'shopIds')
      const userGrain = (sp.get('grain') || 'auto').toLowerCase()
      const grain = autoGrain(from, to, userGrain)
      try {
        const pool = await getMssqlPool()
        const table = 'Verkauf.tAuftragPosition'
        const extNetCol = await pickFirstExisting(pool, table, ['fGesamtNetto','fVKNettoGesamt','fWertNetto','fWert'])
        const netCol = await pickFirstExisting(pool, table, ['fVKNetto','fNetto','fPreisNetto'])
        const qtyCol = await pickFirstExisting(pool, table, ['fMenge','nMenge','fAnzahl'])
        const taxCol = await pickFirstExisting(pool, table, ['fMwSt','fMwst','fMwStProzent'])
        const extendedAny = !!(extNetCol)
        const qtyExpr = extendedAny ? 'CAST(1 AS float)' : (qtyCol ? `CAST(op.[${qtyCol}] AS float)` : 'CAST(1 AS float)')
        const netExprRaw = extNetCol ? `CAST(op.[${extNetCol}] AS float)` : (netCol ? `CAST(op.[${netCol}] AS float)` : 'CAST(0 AS float)')
        // For platform-timeseries default to net without shipping
        const isShipping = await getShippingPredicate(pool, table, 'op')
        const netExpr = `CASE WHEN NOT (${isShipping}) THEN (${netExprRaw}) * (${qtyExpr}) ELSE 0 END`
        const cancelCheck = (await hasColumn(pool, 'Verkauf.tAuftrag', 'nStorno')) ? 'AND ISNULL(o.nStorno,0)=0' : ''
        const channelSql = buildChannelSql(channel, platformIds, shopIds)
        const bucket = grain === 'day' ? "CAST(o.dErstellt AS date)"
                     : grain === 'month' ? "DATEFROMPARTS(YEAR(o.dErstellt), MONTH(o.dErstellt), 1)"
                     : "DATEFROMPARTS(YEAR(o.dErstellt), 1, 1)"
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          ;WITH base AS (
            SELECT ${bucket} AS d,
                   o.kAuftrag, o.kPlattform, o.kShop,
                   ${netExpr} AS revenue_net
            FROM Verkauf.tAuftrag o
            JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = o.kAuftrag
            WHERE o.dErstellt >= @from AND o.dErstellt < DATEADD(day,1,@to) ${cancelCheck} ${channelSql}
          )
          SELECT b.d AS date,
                 CASE WHEN b.kPlattform IS NOT NULL THEN CONCAT('PLT_', b.kPlattform)
                      WHEN b.kShop IS NOT NULL THEN CONCAT('SHOP_', b.kShop)
                      ELSE 'DIRECT' END AS pKey,
                 COALESCE(p.cName, s.cName,
                          CASE WHEN b.kPlattform IS NOT NULL THEN CONCAT('Plattform ', b.kPlattform)
                               WHEN b.kShop IS NOT NULL THEN CONCAT('Shop ', b.kShop)
                               ELSE 'Direktvertrieb' END) AS pName,
                 CAST(SUM(b.revenue_net) AS float) AS net
          FROM base b
          LEFT JOIN dbo.tPlattform p ON p.kPlattform = b.kPlattform
          LEFT JOIN dbo.tShop s ON s.kShop = b.kShop
          GROUP BY b.d, CASE WHEN b.kPlattform IS NOT NULL THEN CONCAT('PLT_', b.kPlattform)
                             WHEN b.kShop IS NOT NULL THEN CONCAT('SHOP_', b.kShop)
                             ELSE 'DIRECT' END,
                   COALESCE(p.cName, s.cName,
                            CASE WHEN b.kPlattform IS NOT NULL THEN CONCAT('Plattform ', b.kPlattform)
                                 WHEN b.kShop IS NOT NULL THEN CONCAT('Shop ', b.kShop)
                                 ELSE 'Direktvertrieb' END)
          ORDER BY date ASC`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        return json({ ok:true, grain, rows: res.recordset || [] })
      } catch(err){
        console.error('orders platform-timeseries SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // ========== NEW: ORDERS KPI COMPARE ==========
    if (route === '/jtl/orders/kpi/compare' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      const channel = (sp.get('channel') || 'all').toLowerCase()
      const platformIds = parseIdsParam(sp, 'platformIds')
      const shopIds = parseIdsParam(sp, 'shopIds')
      try {
        const pool = await getMssqlPool()
        const cancelCheck = (await hasColumn(pool, 'Verkauf.tAuftrag', 'nStorno')) ? 'AND ISNULL(o.nStorno,0)=0' : ''
        const channelSql = buildChannelSql(channel, platformIds, shopIds)
        const table = 'Verkauf.tAuftragPosition'
        const extNetCol = await pickFirstExisting(pool, table, ['fGesamtNetto','fVKNettoGesamt','fWertNetto','fWert'])
        const extGrossCol = await pickFirstExisting(pool, table, ['fGesamtBrutto','fVKBruttoGesamt','fWertBrutto'])
        const netCol = await pickFirstExisting(pool, table, ['fVKNetto','fNetto','fPreisNetto'])
        const grossCol = await pickFirstExisting(pool, table, ['fVKBrutto','fBrutto','fPreisBrutto'])
        const qtyCol = await pickFirstExisting(pool, table, ['fMenge','nMenge','fAnzahl'])
        const taxCol = await pickFirstExisting(pool, table, ['fMwSt','fMwst','fMwStProzent'])
        const extendedAny = !!(extNetCol || extGrossCol)
        const qtyExpr = extendedAny ? 'CAST(1 AS float)' : (qtyCol ? `CAST(op.[${qtyCol}] AS float)` : 'CAST(1 AS float)')
        const netExpr = extNetCol ? `CAST(op.[${extNetCol}] AS float)` : (netCol ? `CAST(op.[${netCol}] AS float)` : 'CAST(0 AS float)')
        const grossExpr = extGrossCol
          ? `CAST(op.[${extGrossCol}] AS float)`
          : (grossCol ? `CAST(op.[${grossCol}] AS float)` : `(${netExpr}) * (1 + (CAST(${taxCol?`op.[${taxCol}]`:'0'} AS float)/100.0))`)
        const isShipping = await getShippingPredicate(pool, table, 'op')
        const summarySql = (rangeCond) => `;WITH heads AS (SELECT o.kAuftrag FROM Verkauf.tAuftrag o WHERE ${rangeCond} ${cancelCheck} ${channelSql})
          SELECT (SELECT COUNT(*) FROM heads) AS orders,
                 CAST(SUM((${netExpr})*(${qtyExpr})) AS float) AS net_with_shipping,
                 CAST(SUM(CASE WHEN NOT (${isShipping}) THEN (${netExpr})*(${qtyExpr}) ELSE 0 END) AS float) AS net_without_shipping,
                 CAST(SUM((${grossExpr})*(${qtyExpr})) AS float) AS gross_with_shipping,
                 CAST(SUM(CASE WHEN NOT (${isShipping}) THEN (${grossExpr})*(${qtyExpr}) ELSE 0 END) AS float) AS gross_without_shipping
          FROM heads h JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = h.kAuftrag`
        // Current range (inclusive to)
        const currentRange = 'o.dErstellt >= @from AND o.dErstellt < DATEADD(day,1,@to)'
        const cur = await pool.request().input('from', sql.Date, from).input('to', sql.Date, to).query(summarySql(currentRange))
        // Previous range
        const fromD = new Date(from); const toD = new Date(to)
        const lenDays = Math.floor((toD.getTime() - fromD.getTime())/86400000) + 1
        const prevTo = new Date(fromD.getTime() - 1*86400000)
        const prevFrom = new Date(prevTo.getTime() - (lenDays-1)*86400000)
        const pf = prevFrom.toISOString().slice(0,10); const pt = prevTo.toISOString().slice(0,10)
        const prev = await pool.request().input('pf', sql.Date, pf).input('pt', sql.Date, pt).query(summarySql('o.dErstellt >= @pf AND o.dErstellt < DATEADD(day,1,@pt)'))
        return json({ ok:true, current: cur?.recordset?.[0]||{}, previous: prev?.recordset?.[0]||{}, period:{ from, to }, previousPeriod:{ from: pf, to: pt } })
      } catch(err){
        console.error('orders kpi compare SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // ========== JTL ORDERS DIAG: DAY BREAKDOWN ==========
    if (route === '/jtl/orders/diag/day' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const date = sp.get('date')
      if (!date) return json({ ok:false, error:'Missing ?date=YYYY-MM-DD' }, { status: 400 })
      try {
        const pool = await getMssqlPool()
        const table = 'Verkauf.tAuftragPosition'
        const extNetCol = await pickFirstExisting(pool, table, ['fGesamtNetto','fVKNettoGesamt','fWertNetto','fWert'])
        const extGrossCol = await pickFirstExisting(pool, table, ['fGesamtBrutto','fVKBruttoGesamt','fWertBrutto'])
        const netCol = await pickFirstExisting(pool, table, ['fVKNetto','fNetto','fPreisNetto'])
        const grossCol = await pickFirstExisting(pool, table, ['fVKBrutto','fBrutto','fPreisBrutto'])
        const qtyCol = await pickFirstExisting(pool, table, ['fMenge','nMenge','fAnzahl'])
        const taxCol = await pickFirstExisting(pool, table, ['fMwSt','fMwst','fMwStProzent'])
        const extendedAny = !!(extNetCol || extGrossCol)
        const qtyExpr = extendedAny ? 'CAST(1 AS float)' : (qtyCol ? `CAST(op.[${qtyCol}] AS float)` : 'CAST(1 AS float)')
        const netExpr = extNetCol ? `CAST(op.[${extNetCol}] AS float)` : (netCol ? `CAST(op.[${netCol}] AS float)` : 'CAST(0 AS float)')
        const grossExpr = extGrossCol
          ? `CAST(op.[${extGrossCol}] AS float)`
          : (grossCol ? `CAST(op.[${grossCol}] AS float)` : `(${netExpr}) * (1 + (CAST(${taxCol?`op.[${taxCol}]`:'0'} AS float)/100.0))`)
        const cancelCheck = (await hasColumn(pool, 'Verkauf.tAuftrag', 'nStorno')) ? 'AND ISNULL(o.nStorno,0)=0' : ''
        const q = `DECLARE @d date = @pdate;
          ;WITH heads AS (
            SELECT o.kAuftrag, ISNULL(o.cAuftragsNr,'') AS cAuftragsNr, o.kPlattform, o.kShop
            FROM Verkauf.tAuftrag o
            WHERE CONVERT(date, o.dErstellt) = @d ${cancelCheck}
          )
          SELECT h.kAuftrag, h.cAuftragsNr AS auftragsNr,
                 CAST(SUM((${netExpr}) * (${qtyExpr})) AS float) AS net_sum,
                 CAST(SUM((${grossExpr}) * (${qtyExpr})) AS float) AS gross_sum,
                 COUNT(*) AS positions,
                 ISNULL(p.cName, CASE WHEN ISNULL(h.kPlattform,0)>0 THEN CONCAT('Plattform ', h.kPlattform)
                                      WHEN ISNULL(h.kShop,0)>0 THEN CONCAT('Shop ', h.kShop)
                                      ELSE 'Direkt' END) AS platform
          FROM heads h
          JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = h.kAuftrag
          LEFT JOIN dbo.tPlattform p ON p.kPlattform = h.kPlattform
          GROUP BY h.kAuftrag, h.cAuftragsNr, p.cName, h.kPlattform, h.kShop
          ORDER BY auftragsNr`
        const res = await pool.request().input('pdate', sql.Date, date).query(q)
        const rows = res?.recordset || []
        const totals = rows.reduce((a,r)=>({ orders:a.orders+1, net:a.net+(r.net_sum||0), gross:a.gross+(r.gross_sum||0)}), { orders:0, net:0, gross:0 })
        return json({ ok:true, date, totals, rows })
      } catch(err){
        console.error('orders diag/day SQL error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    // TODO: Rechnungen inkl. externer Belege – benötigt Tabellennamen/Views
    if (route === '/jtl/invoices/kpi/with-external' && method === 'GET'){
      return json({ ok:false, error:'External invoices table/view not configured. Please provide table names.' }, { status: 501 })
    }

    return json({ error: `Route ${route} not found` }, { status: 404 })
  } catch (err) {
    console.error('API Error:', err)
    return json({ error: 'Internal server error', detail: String(err?.message||err) }, { status: 500 })
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
