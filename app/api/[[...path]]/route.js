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
  // Supports from/to or month=YYYY-MM
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

// Helpers for MSSQL metadata and dynamic SQL building
async function hasColumn(pool, table, column){
  const r = await pool.request()
    .input('tbl', sql.NVarChar, table)
    .input('col', sql.NVarChar, column)
    .query('SELECT COUNT(*) AS ok FROM sys.columns WHERE object_id = OBJECT_ID(@tbl) AND name = @col')
  return ((r?.recordset?.[0]?.ok ?? 0) > 0)
}

async function getOnlyArticleWhere(pool, table, alias){
  // Build a predicate string without referencing nPosTyp if it doesn't exist
  const has = await hasColumn(pool, table, 'nPosTyp')
  if (has) return `${alias}.nPosTyp = 1`
  return `${alias}.kArtikel > 0 AND ISNULL(${alias}.cName,'') NOT LIKE 'Versand%' AND ISNULL(${alias}.cName,'') NOT LIKE 'Gutschein%' AND ISNULL(${alias}.cName,'') NOT LIKE 'Rabatt%' AND ISNULL(${alias}.cName,'') NOT LIKE 'Pfand%'`
}

async function getShippingPredicate(pool, table, alias){
  // Returns a predicate string that evaluates to 1 for shipping rows
  const has = await hasColumn(pool, table, 'nPosTyp')
  if (has) return `${alias}.nPosTyp IN (3,4)`
  return `${alias}.kArtikel = 0 AND (ISNULL(${alias}.cName,'') LIKE 'Versand%' OR ISNULL(${alias}.cArtNr,'') LIKE 'VERSAND%')`
}

async function pickFirstExisting(pool, table, candidates){
  for (const c of candidates){ if (await hasColumn(pool, table, c)) return c }
  return null
}

function json(data, init){ return cors(NextResponse.json(data, init)) }

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
        const r = await pool.request().query(q) // expects no nPosTyp since where built dynamically
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
        // Build a source text from available columns on Rechnung
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
    if (route === '/jtl/orders/kpi/shipping-split' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const { from, to } = buildDateParams(sp)
      try {
        const pool = await getMssqlPool()
        const table = 'Verkauf.tAuftragPosition'
        // Prefer extended (positionssumme) columns first to avoid double counting with qty
        const extNetCol = await pickFirstExisting(pool, table, ['fGesamtNetto','fVKNettoGesamt','fWertNetto','fWert'])
        const extGrossCol = await pickFirstExisting(pool, table, ['fGesamtBrutto','fVKBruttoGesamt','fWertBrutto'])
        const netCol = await pickFirstExisting(pool, table, ['fVKNetto','fNetto','fPreisNetto'])
        const grossCol = await pickFirstExisting(pool, table, ['fVKBrutto','fBrutto','fPreisBrutto'])
        const qtyCol = await pickFirstExisting(pool, table, ['fMenge','nMenge','fAnzahl'])
        const taxCol = await pickFirstExisting(pool, table, ['fMwSt','fMwst','fMwStProzent'])
        // Build expressions
        const netExpr = extNetCol ? `CAST(op.[${extNetCol}] AS float)` : (netCol ? `CAST(op.[${netCol}] AS float)` : 'CAST(0 AS float)')
        const qtyExpr = extNetCol ? 'CAST(1 AS float)' : (qtyCol ? `CAST(op.[${qtyCol}] AS float)` : 'CAST(0 AS float)')
        const grossExpr = extGrossCol
          ? `CAST(op.[${extGrossCol}] AS float)`
          : (grossCol ? `CAST(op.[${grossCol}] AS float)` : `(${netExpr}) * (1 + (CAST(${taxCol?`op.[${taxCol}]`:'0'} AS float)/100.0))`)
        const isShipping = await getShippingPredicate(pool, table, 'op')
        const cancelCheck = (await hasColumn(pool, 'Verkauf.tAuftrag', 'nStorno')) ? 'AND ISNULL(o.nStorno,0)=0' : ''
        const sqlText = `DECLARE @from date = @pfrom, @to date = @pto;
          ;WITH heads AS (
            SELECT o.kAuftrag
            FROM Verkauf.tAuftrag o
            WHERE CONVERT(date, o.dErstellt) BETWEEN @from AND @to ${cancelCheck}
          )
          SELECT 
            (SELECT COUNT(*) FROM heads) AS orders,
            -- NETTO
            CAST(SUM(CASE WHEN ${extNetCol?`1=1`:`${netCol?`1=1`:`1=0`}`} THEN (${netExpr}) * (${qtyExpr}) ELSE 0 END) AS float) AS net_with_shipping,
            CAST(SUM(CASE WHEN NOT (${isShipping}) THEN (${netExpr}) * (${qtyExpr}) ELSE 0 END) AS float) AS net_without_shipping,
            -- BRUTTO: bevorzugt extGross; sonst aus NETTO+MwSt; sonst unitGross*qty
            CAST(SUM(CASE WHEN ${extGrossCol?`1=1`:'0=1'} THEN CAST(op.[${extGrossCol||'__x'}] AS float)
                          WHEN ${extNetCol?`1=1`:'0=1'} THEN (${netExpr}) * (1 + (CAST(${taxCol?`op.[${taxCol}]`:'0'} AS float)/100.0))
                          WHEN ${grossCol?`1=1`:'0=1'} THEN CAST(op.[${grossCol||'__x'}] AS float) * (${qtyExpr})
                          ELSE 0 END) AS float) AS gross_with_shipping,
            CAST(SUM(CASE WHEN NOT (${isShipping}) THEN 
                          CASE WHEN ${extGrossCol?`1=1`:'0=1'} THEN CAST(op.[${extGrossCol||'__x'}] AS float)
                               WHEN ${extNetCol?`1=1`:'0=1'} THEN (${netExpr}) * (1 + (CAST(${taxCol?`op.[${taxCol}]`:'0'} AS float)/100.0))
                               WHEN ${grossCol?`1=1`:'0=1'} THEN CAST(op.[${grossCol||'__x'}] AS float) * (${qtyExpr})
                               ELSE 0 END
                        ELSE 0 END) AS float) AS gross_without_shipping
          FROM heads h
          JOIN Verkauf.tAuftragPosition op ON op.kAuftrag = h.kAuftrag`
        const res = await pool.request().input('pfrom', sql.Date, from).input('pto', sql.Date, to).query(sqlText)
        const row = res?.recordset?.[0] || {}
        return json({ ok:true, period:{ from, to }, orders: row.orders||0, net: { with_shipping: row.net_with_shipping||0, without_shipping: row.net_without_shipping||0 }, gross: { with_shipping: row.gross_with_shipping||0, without_shipping: row.gross_without_shipping||0 } })
      } catch(err){
        console.error('orders shipping-split SQL error', err)
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
