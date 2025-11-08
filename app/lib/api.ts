import { MongoClient } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: any = null

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  const uri = process.env.MONGO_URL
  const dbName = process.env.DB_NAME
  
  if (!uri || !dbName) {
    throw new Error('MONGO_URL and DB_NAME environment variables must be set')
  }

  const client = new MongoClient(uri)
  await client.connect()
  
  const db = client.db(dbName)

  cachedClient = client
  cachedDb = db

  return { client, db }
}

export async function getJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...(init || {}) })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return (await res.json()) as T
}
