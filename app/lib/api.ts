import { MongoClient } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: any = null
let isConnecting = false

export async function connectToDatabase() {
  // Wenn bereits verbunden, prüfe ob Verbindung noch aktiv ist
  if (cachedClient && cachedDb) {
    try {
      // Quick ping um zu prüfen ob Verbindung noch aktiv ist
      await cachedDb.admin().ping()
      return { client: cachedClient, db: cachedDb }
    } catch (error) {
      console.log('[MongoDB] Connection lost, reconnecting...')
      cachedClient = null
      cachedDb = null
    }
  }

  // Warten wenn bereits ein Verbindungsversuch läuft
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return connectToDatabase()
  }

  isConnecting = true

  try {
    const uri = process.env.MONGO_URL
    const dbName = process.env.DB_NAME
    
    if (!uri || !dbName) {
      throw new Error('MONGO_URL and DB_NAME environment variables must be set')
    }

    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true
    })
    
    await client.connect()
    
    const db = client.db(dbName)

    cachedClient = client
    cachedDb = db

    console.log('[MongoDB] Connected successfully to', dbName)

    return { client, db }
  } finally {
    isConnecting = false
  }
}

export async function getJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...(init || {}) })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return (await res.json()) as T
}
