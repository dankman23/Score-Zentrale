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

function buildDateParams(searchParams){ const from = searchParams.get('from') || new Date(Date.now()-29*24*3600*1000).toISOString().slice(0,10); const to = searchParams.get('to') || new Date().toISOString().slice(0,10); return { from, to } }

// DIAG: list table columns
async function listColumns(pool, table){
  const r = await pool.request().input('t', sql.NVarChar, table).query(`SELECT c.name AS col, t.name AS type
    FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
    WHERE c.object_id = OBJECT_ID(@t)
    ORDER BY c.column_id`)
  return r.recordset || []
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') { return cors(NextResponse.json({ message: 'Score Zentrale API online' })) }

    if (route === '/jtl/diag/columns' && method === 'GET') {
      const sp = new URL(request.url).searchParams
      const table = sp.get('table') || 'Rechnung.tRechnungPosition'
      const pool = await getMssqlPool()
      const cols = await listColumns(pool, table)
      return cors(NextResponse.json({ ok:true, table, cols }))
    }

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
