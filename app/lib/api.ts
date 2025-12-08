import { MongoClient } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: any = null
let isConnecting = false
let connectionAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 3

export async function connectToDatabase() {
  // Wenn bereits verbunden, teste die Verbindung
  if (cachedClient && cachedDb) {
    try {
      // Quick ping um zu prüfen ob Verbindung noch aktiv ist
      await Promise.race([
        cachedDb.admin().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 2000))
      ])
      connectionAttempts = 0 // Reset counter bei erfolgreicher Verbindung
      return { client: cachedClient, db: cachedDb }
    } catch (error) {
      console.log('[MongoDB] Connection lost, reconnecting...', error.message)
      // Schließe alte Verbindung ordentlich
      try {
        await cachedClient?.close()
      } catch {}
      cachedClient = null
      cachedDb = null
    }
  }

  // Warten wenn bereits ein Verbindungsversuch läuft
  if (isConnecting) {
    let waitCount = 0
    while (isConnecting && waitCount < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waitCount++
    }
    if (cachedClient && cachedDb) {
      return { client: cachedClient, db: cachedDb }
    }
  }

  isConnecting = true

  try {
    const uri = process.env.MONGO_URL
    const dbName = process.env.DB_NAME
    
    if (!uri || !dbName) {
      throw new Error('MONGO_URL and DB_NAME environment variables must be set')
    }

    connectionAttempts++
    
    if (connectionAttempts > MAX_RECONNECT_ATTEMPTS) {
      connectionAttempts = 0
      throw new Error(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`)
    }

    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
      maxIdleTimeMS: 30000,
      heartbeatFrequencyMS: 10000
    })
    
    await client.connect()
    
    const db = client.db(dbName)
    
    // Test connection
    await db.admin().ping()

    cachedClient = client
    cachedDb = db
    connectionAttempts = 0

    console.log('[MongoDB] Connected successfully to', dbName)

    return { client, db }
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message)
    throw error
  } finally {
    isConnecting = false
  }
}

export async function getJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...(init || {}) })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return (await res.json()) as T
}
