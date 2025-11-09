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
  return `(ISNULL(${alias}.cName,'') LIKE 'Versand%' OR ISNULL(${alias}.cArtNr,'') LIKE 'VERSAND%' OR ISNULL(${alias}.cName,'') LIKE '%Shipping%' OR ISNULL(${alias}.cName,'') LIKE 'Fracht%' OR ISNULL(${alias}.cName,'') LIKE 'Porto%' OR ISNULL(${alias}.cName,'') LIKE 'Transport%')`
}

async function pickFirstExisting(pool, table, candidates){
  for (const c of candidates){ if (await hasColumn(pool, table, c)) return c }
  return null
}

async function tableExists(pool, fullyQualified){
  const r = await pool.request().input('name', sql.NVarChar, fullyQualified).query("SELECT CASE WHEN OBJECT_ID(@name) IS NULL THEN 0 ELSE 1 END AS ok")
  return (r?.recordset?.[0]?.ok ?? 0) === 1
}

async function firstExistingTable(pool, candidates){
  for (const t of candidates){ if (await tableExists(pool, t)) return t }
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

function isPrivateEmail(email){
  if (!email) return false
  const e = String(email).toLowerCase()
  return ['@gmail.','@gmx.','@web.','@hotmail.','@outlook.','@yahoo.','@icloud.'].some(dom => e.includes(dom))
}

function toISO(d){ try { return new Date(d).toISOString().slice(0,10) } catch(e){ return null } }

function scoreLead(doc, weights){
  const w1 = Number(weights?.w1 ?? process.env.WARM_W1 ?? 0.6)
  const w2 = Number(weights?.w2 ?? process.env.WARM_W2 ?? 0.8)
  const w3 = Number(weights?.w3 ?? process.env.WARM_W3 ?? 1.0)
  const w4 = Number(weights?.w4 ?? process.env.WARM_W4 ?? 1.2)
  const rev = Number(doc.totalRevenueNetto||0)
  const orders = Number(doc.ordersCount||0)
  const last = doc.lastOrder ? new Date(doc.lastOrder) : null
  const days = last ? Math.max(0, Math.floor((Date.now() - last.getTime())/86400000)) : 999
  const recency = Math.max(0, 100 - Math.min(180, days) * (100/180))
  let s = w1*Math.log1p(rev) + w2*orders + w3*recency + w4*(doc.isB2B?1:0)
  if (!Number.isFinite(s)) s = 0
  return Math.max(0, Math.min(100, s))
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method
  console.log('API route hit', { method, route, url: request.url })

  try {
    const dbConn = await connectToMongo()

    // Health
    if ((route === '/' || route === '/root') && method === 'GET') { return json({ message: 'Score Zentrale API online' }) }
    
    // Debug SKU endpoint
    if (route === '/debug/sku' && method === 'GET') {
      try {
        const pool = await getMssqlPool()
        const urlParams = new URL(request.url).searchParams
        const sku = urlParams.get('sku') || '167676'
        const from = urlParams.get('from') || '2025-10-10'
        const to = urlParams.get('to') || '2025-11-09'
        
        // Check how many articles have this SKU
        const articleCheck = await pool.request()
          .input('sku', sql.NVarChar, sku)
          .query(`
            SELECT kArtikel, cArtNr
            FROM dbo.tArtikel
            WHERE cArtNr = @sku
          `)
        
        // Get all order positions for this SKU
        const positions = await pool.request()
          .input('sku', sql.NVarChar, sku)
          .input('from', sql.Date, from)
          .input('to', sql.Date, to)
          .query(`
            SELECT 
              o.kAuftrag,
              o.cAuftragsNr,
              o.dErstellt,
              op.kAuftragPosition,
              op.kArtikel,
              a.cArtNr,
              op.fAnzahl,
              op.fVKNetto,
              (op.fAnzahl * op.fVKNetto) AS netTotal
            FROM Verkauf.tAuftrag o
            INNER JOIN Verkauf.tAuftragPosition op ON o.kAuftrag = op.kAuftrag
            LEFT JOIN dbo.tArtikel a ON op.kArtikel = a.kArtikel
            WHERE a.cArtNr = @sku
              AND CAST(o.dErstellt AS DATE) BETWEEN @from AND @to
              AND (o.nStorno IS NULL OR o.nStorno = 0)
              AND op.kArtikel > 0
            ORDER BY o.dErstellt DESC
          `)
        
        const totalQty = positions.recordset.reduce((sum, p) => sum + (parseFloat(p.fAnzahl) || 0), 0)
        const totalRev = positions.recordset.reduce((sum, p) => sum + (parseFloat(p.netTotal) || 0), 0)
        
        return json({
          ok: true,
          sku,
          period: { from, to },
          articlesWithThisSku: articleCheck.recordset.length,
          articles: articleCheck.recordset,
          positionCount: positions.recordset.length,
          totalQuantity: totalQty.toFixed(2),
          totalRevenue: totalRev.toFixed(2),
          positions: positions.recordset.map(p => ({
            orderNumber: p.cAuftragsNr,
            orderDate: p.dErstellt?.toISOString().slice(0, 10),
            kArtikel: p.kArtikel,
            posName: p.posName,
            quantity: parseFloat(p.fAnzahl || 0).toFixed(2),
            netPrice: parseFloat(p.fVKNetto || 0).toFixed(2),
            netTotal: parseFloat(p.netTotal || 0).toFixed(2)
          }))
        })
      } catch (error) {
        return json({ ok: false, error: error.message }, { status: 500 })
      }
    }

    // ---------------- Leads (Warmakquise) ----------------
    if (route === '/leads/import' && method === 'POST'){
      try{
        const pool = await getMssqlPool()
        const body = await request.json().catch(()=>({}))
        const inactiveMonths = Number(body?.inactiveMonths ?? process.env.INACTIVE_MONTHS ?? 6)
        const minOrders = Number(body?.minOrders ?? process.env.MIN_ORDERS ?? 2)
        const minRevenue = Number(body?.minRevenue ?? process.env.MIN_REVENUE ?? 100)
        const limit = Math.max(1, Math.min( Number(body?.limit ?? 2000), 10000))
        const weights = body?.weights || {}

        // Resolve actual table names (schema differs by JTL version)
        const kundeTable = await firstExistingTable(pool, ['Kunde.tKunde','dbo.tKunde']) || 'dbo.tKunde'
        const adresseTable = await firstExistingTable(pool, ['dbo.tAdresse','tAdresse']) || 'dbo.tAdresse'
        const auftragAdresseTable = await firstExistingTable(pool, ['Verkauf.tAuftragAdresse','dbo.tAuftragAdresse']) || 'Verkauf.tAuftragAdresse'
        const auftragTable = await firstExistingTable(pool, ['Verkauf.tAuftrag','dbo.tAuftrag']) || 'dbo.tAuftrag'
        const auftragPosTable = await firstExistingTable(pool, ['Verkauf.tAuftragPosition','dbo.tAuftragPosition','dbo.tAuftragPos','Verkauf.tAuftragPos']) || 'dbo.tAuftragPosition'
        const plTable = await firstExistingTable(pool, ['dbo.tPlattform','tPlattform'])
        const shTable = await firstExistingTable(pool, ['dbo.tShop','tShop'])

        // Column presence on Kunde
        const hasUSTID = await hasColumn(pool, kundeTable, 'cUSTID')
        const hasKundenNr = await hasColumn(pool, kundeTable, 'cKundenNr')
        
        // Check if tAuftragAdresse table exists and has customer data fields
        const hasAuftragAdresse = await tableExists(pool, auftragAdresseTable)
        const hasAACFirma = hasAuftragAdresse ? await hasColumn(pool, auftragAdresseTable, 'cFirma') : false
        const hasAACVorname = hasAuftragAdresse ? await hasColumn(pool, auftragAdresseTable, 'cVorname') : false
        const hasAACNachname = hasAuftragAdresse ? await hasColumn(pool, auftragAdresseTable, 'cNachname') : false
        const hasAACTel = hasAuftragAdresse ? await hasColumn(pool, auftragAdresseTable, 'cTel') : false
        const hasAACMail = hasAuftragAdresse ? await hasColumn(pool, auftragAdresseTable, 'cMail') : false
        
        // Check tAdresse columns (standard customer address table)
        const hasAdresse = await tableExists(pool, adresseTable)
        const hasCFirma = hasAdresse ? await hasColumn(pool, adresseTable, 'cFirma') : false
        const hasCVorname = hasAdresse ? await hasColumn(pool, adresseTable, 'cVorname') : false
        const hasCNachname = hasAdresse ? await hasColumn(pool, adresseTable, 'cNachname') : false
        const hasCTel = hasAdresse ? await hasColumn(pool, adresseTable, 'cTel') : false
        const hasCMail = hasAdresse ? await hasColumn(pool, adresseTable, 'cMail') : false

        // Build robust position totals (handle qty/tax/alt columns)
        const posTable = auftragPosTable
        const extNetCol = await pickFirstExisting(pool, posTable, ['fGesamtNetto','fVKNettoGesamt','fWertNetto','fWert'])
        const extGrossCol = await pickFirstExisting(pool, posTable, ['fGesamtBrutto','fVKBruttoGesamt','fWertBrutto'])
        const netCol = await pickFirstExisting(pool, posTable, ['fVKNetto','fNetto','fPreisNetto'])
        const grossCol = await pickFirstExisting(pool, posTable, ['fVKBrutto','fBrutto','fPreisBrutto'])
        const qtyCol = await pickFirstExisting(pool, posTable, ['fMenge','nMenge','fAnzahl','nAnzahl','Menge'])
        const taxCol = await pickFirstExisting(pool, posTable, ['fMwSt','fMwst','fMwStProzent','MwSt'])
        const qtyExpr = qtyCol ? `ISNULL(op.[${qtyCol}],1)` : '1'
        const taxExpr = taxCol ? `COALESCE(op.[${taxCol}],0)` : '0'
        const netTotalExpr = extNetCol
          ? `CAST(op.[${extNetCol}] AS float)`
          : (netCol ? `(CAST(op.[${netCol}] AS float) * CAST(${qtyExpr} AS float))`
                    : (extGrossCol ? `(CAST(op.[${extGrossCol}] AS float) / NULLIF(1 + (CAST(${taxExpr} AS float)/100.0),0))`
                                   : (grossCol ? `((CAST(op.[${grossCol}] AS float) * CAST(${qtyExpr} AS float)) / NULLIF(1 + (CAST(${taxExpr} AS float)/100.0),0))`
                                               : 'CAST(0 AS float)')))
        const grossTotalExpr = extGrossCol
          ? `CAST(op.[${extGrossCol}] AS float)`
          : (grossCol ? `(CAST(op.[${grossCol}] AS float) * CAST(${qtyExpr} AS float))`
                      : `(${netTotalExpr}) * (1 + (CAST(${taxExpr} AS float)/100.0))`)
        const articleWhere = await getOnlyArticleWhere(pool, posTable, 'op')

        const q = `DECLARE @inactiveMonths int = @pInactive;
          DECLARE @fromRecent date = DATEADD(MONTH, -@inactiveMonths, CAST(GETDATE() AS date));
          DECLARE @minOrders int = @pMinOrders;
          DECLARE @minRevenue float = @pMinRevenue;

          ;WITH orders AS (
            SELECT o.kKunde,
                   COUNT(DISTINCT o.kAuftrag) AS ordersCount,
                   MAX(o.dErstellt)          AS lastOrderDate
            FROM ${auftragTable} o
            WHERE (COL_LENGTH('${auftragTable}','nStorno') IS NULL OR ISNULL(o.nStorno,0)=0)
            GROUP BY o.kKunde
          ),
          maxDates AS (
            SELECT kKunde, MAX(dErstellt) AS maxDate
            FROM ${auftragTable}
            GROUP BY kKunde
          ),
          lastPlat AS (
            SELECT o.kKunde,
                   MAX(o.dErstellt) AS lastDate,
                   MAX(ISNULL(o.kPlattform, NULL)) AS kPlattform,
                   MAX(ISNULL(o.kShop, NULL)) AS kShop
            FROM ${auftragTable} o
            JOIN maxDates md ON o.kKunde = md.kKunde AND o.dErstellt = md.maxDate
            GROUP BY o.kKunde
          ),
          customerData AS (
            SELECT o.kKunde,
                   ${hasAACFirma ? 'MAX(aa.cFirma)' : 'NULL'} AS firma,
                   ${hasAACVorname ? 'MAX(aa.cVorname)' : 'NULL'} AS vorname,
                   ${hasAACNachname ? 'MAX(aa.cNachname)' : 'NULL'} AS nachname,
                   ${hasAACTel ? 'MAX(aa.cTel)' : 'NULL'} AS tel,
                   ${hasAACMail ? 'MAX(aa.cMail)' : 'NULL'} AS email
            FROM ${auftragTable} o
            JOIN maxDates md ON o.kKunde = md.kKunde
            ${hasAuftragAdresse ? `LEFT JOIN ${auftragAdresseTable} aa ON o.kAuftrag = aa.kAuftrag` : ''}
            WHERE o.dErstellt = md.maxDate
            GROUP BY o.kKunde
          ),
          revenue AS (
            SELECT o.kKunde,
                   SUM(${grossTotalExpr}) AS totalRevenueBrutto,
                   SUM(${netTotalExpr})   AS totalRevenueNetto
            FROM ${auftragTable} o
            JOIN ${auftragPosTable} op ON op.kAuftrag = o.kAuftrag
            WHERE (COL_LENGTH('${auftragTable}','nStorno') IS NULL OR ISNULL(o.nStorno,0)=0)
              AND (${articleWhere})
            GROUP BY o.kKunde
          )
          SELECT TOP (@pLimit)
            k.kKunde,
            ${hasKundenNr? 'k.cKundenNr' : "CAST(NULL AS nvarchar(50)) AS cKundenNr"},
            ${hasUSTID? 'k.cUSTID' : "CAST(NULL AS nvarchar(50)) AS cUSTID"},
            cd.firma AS cFirma,
            cd.vorname AS cVorname,
            cd.nachname AS cNachname,
            cd.tel AS cTel,
            cd.email AS cMail,
            o.ordersCount, o.lastOrderDate,
            r.totalRevenueNetto, r.totalRevenueBrutto,
            CASE 
              WHEN ${plTable? '1=1' : '1=0'} THEN (SELECT TOP 1 COALESCE(p.cName, CONCAT('Plattform ', lp.kPlattform)) FROM ${plTable||'dbo.tPlattform'} p RIGHT JOIN lastPlat lp ON 1=1 WHERE lp.kKunde = k.kKunde AND lp.kPlattform IS NOT NULL)
              WHEN ${shTable? '1=1' : '1=0'} THEN (SELECT TOP 1 COALESCE(s.cName, CONCAT('Shop ', lp.kShop)) FROM ${shTable||'dbo.tShop'} s RIGHT JOIN lastPlat lp ON 1=1 WHERE lp.kKunde = k.kKunde AND lp.kShop IS NOT NULL)
              ELSE 'Direktvertrieb' END AS lastChannel
          FROM ${kundeTable} k
          JOIN orders  o ON o.kKunde = k.kKunde
          JOIN revenue r ON r.kKunde = k.kKunde
          LEFT JOIN lastPlat lp ON lp.kKunde = k.kKunde
          LEFT JOIN customerData cd ON cd.kKunde = k.kKunde
          WHERE o.lastOrderDate >= @fromRecent
            AND (o.ordersCount >= @minOrders OR r.totalRevenueBrutto >= @minRevenue)
          ORDER BY r.totalRevenueBrutto DESC;`

        const res = await pool.request()
          .input('pInactive', sql.Int, inactiveMonths)
          .input('pMinOrders', sql.Int, minOrders)
          .input('pMinRevenue', sql.Float, minRevenue)
          .input('pLimit', sql.Int, limit)
          .query(q)
        const rows = res?.recordset || []

        let imported = 0, skipped = 0
        for (const r of rows){
          const name = r.cFirma?.trim() || `${r.cVorname||''} ${r.cNachname||''}`.trim() || r.cKundenNr || ''
          const isB2B = !!( (r.cFirma && r.cFirma.trim().length>0) || (r.cUSTID && String(r.cUSTID).trim().length>0) ) && !isPrivateEmail(r.cMail)
          const doc = {
            id: uuidv4(),
            kKunde: r.kKunde,
            kundennr: r.cKundenNr,
            name,
            contact: { phone: r.cTel||'', email: r.cMail||'' },
            isB2B,
            ordersCount: Number(r.ordersCount||0),
            lastOrder: toISO(r.lastOrderDate),
            totalRevenueNetto: Number(r.totalRevenueNetto||0),
            totalRevenueBrutto: Number(r.totalRevenueBrutto||0),
            warmScore: 0,
            status: 'open',
            tags: [],
            notes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          doc.warmScore = scoreLead(doc, weights)
          // Upsert by kKunde
          const coll = dbConn.collection('leads')
          const existing = await coll.findOne({ kKunde: doc.kKunde })
          if (existing){
            await coll.updateOne({ kKunde: doc.kKunde }, { $set: { ...doc, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() } })
            imported++
          } else {
            await coll.insertOne(doc)
            imported++
          }
        }
        return json({ ok:true, imported, skipped, count: rows.length })
      } catch(err){
        console.error('leads/import error', err)
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    if (route === '/leads' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const status = sp.get('status') || undefined
      const b2b = sp.get('b2b')
      const minScore = Number(sp.get('minScore')||0)
      const q = (sp.get('q')||'').trim()
      const page = Math.max(1, parseInt(sp.get('page')||'1', 10))
      const limit = Math.max(1, Math.min(parseInt(sp.get('limit')||'50',10), 200))
      const sort = sp.get('sort') || 'warmScore'
      const order = (sp.get('order')||'desc').toLowerCase() === 'asc' ? 1 : -1

      const coll = dbConn.collection('leads')
      const where = { }
      if (status) where.status = status
      if (b2b==='true') where.isB2B = true
      if (b2b==='false') where.isB2B = false
      if (minScore>0) where.warmScore = { $gte: minScore }
      if (q){
        where.$or = [
          { name: { $regex: q, $options:'i' } },
          { 'contact.email': { $regex: q, $options:'i' } },
          { 'contact.phone': { $regex: q, $options:'i' } },
          { kundennr: { $regex: q, $options:'i' } }
        ]
      }
      const total = await coll.countDocuments(where)
      const rows = await coll.find(where).sort({ [sort]: order }).skip((page-1)*limit).limit(limit).toArray()
      const out = rows.map(({ _id, ...r})=>r)
      return json({ ok:true, page, limit, total, rows: out })
    }

    if (route.startsWith('/leads/') && route.endsWith('/status') && method === 'POST'){
      try{
        const id = path[1]
        const body = await request.json().catch(()=>({}))
        const status = String(body?.status||'').trim()
        if (!id || !status) return json({ ok:false, error:'Missing id/status' }, { status: 400 })
        const coll = dbConn.collection('leads')
        const r = await coll.updateOne({ id }, { $set: { status, updatedAt: new Date().toISOString() } })
        return json({ ok:true, modified: r.modifiedCount })
      } catch(err){
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    if (route.startsWith('/leads/') && route.endsWith('/note') && method === 'POST'){
      try{
        const id = path[1]
        const body = await request.json().catch(()=>({}))
        const text = String(body?.text||'').trim()
        if (!id || !text) return json({ ok:false, error:'Missing id/text' }, { status: 400 })
        const note = { at: new Date().toISOString(), by: body?.by||'system', text }
        const coll = dbConn.collection('leads')
        const r = await coll.updateOne({ id }, { $push: { notes: note }, $set: { updatedAt: new Date().toISOString() } })
        return json({ ok:true, modified: r.modifiedCount })
      } catch(err){
        return json({ ok:false, error: String(err?.message||err) }, { status: 500 })
      }
    }

    if (route === '/leads/export.csv' && method === 'GET'){
      const sp = new URL(request.url).searchParams
      const status = sp.get('status') || undefined
      const b2b = sp.get('b2b')
      const minScore = Number(sp.get('minScore')||0)
      const coll = dbConn.collection('leads')
      const where = { }
      if (status) where.status = status
      if (b2b==='true') where.isB2B = true
      if (b2b==='false') where.isB2B = false
      if (minScore>0) where.warmScore = { $gte: minScore }
      const rows = await coll.find(where).sort({ warmScore: -1 }).limit(5000).toArray()
      const arr = rows.map(({ _id, ...r})=>r)
      const header = ['warmScore','name','b2b','lastOrder','orders','revenueNet','phone','email','status','tags']
      const csv = [header.join(';')].concat(arr.map(r => [
        (r.warmScore??'').toString().replace('.',','),
        (r.name??'').toString().replace(/;/g,','),
        r.isB2B?'true':'false',
        r.lastOrder||'',
        r.ordersCount??'',
        (r.totalRevenueNetto??'').toString().replace('.',','),
        (r.contact?.phone??'').toString().replace(/;/g,','),
        (r.contact?.email??'').toString().replace(/;/g,','),
        r.status||'open',
        (Array.isArray(r.tags)?r.tags.join(','):'')
      ].join(';'))).join('\n')
      const res = new NextResponse(csv, { status: 200, headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="leads_export.csv"' } })
      return cors(res)
    }

    // --------------- Existing routes below (JTL sales/orders etc.) ---------------

    // Keep other existing logic by importing from earlier code (omitted here for brevity in this snippet)
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
