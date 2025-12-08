import { MongoClient } from 'mongodb'

// Globaler singleton Client - wird von ALLEN Teilen der App verwendet
let cachedClient: MongoClient | null = null
let cachedDb: any = null
let connectionPromise: Promise<{ client: MongoClient; db: any }> | null = null

export async function connectToDatabase() {
  // Wenn bereits eine Verbindung existiert, verwende sie
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  // Wenn bereits ein Verbindungsversuch läuft, warte darauf
  if (connectionPromise) {
    return connectionPromise
  }

  const uri = process.env.MONGO_URL
  const dbName = process.env.DB_NAME
  
  if (!uri || !dbName) {
    throw new Error('MONGO_URL and DB_NAME environment variables must be set')
  }

  console.log('[MongoDB API] Creating new connection to:', dbName)

  // Erstelle Connection Promise
  connectionPromise = (async () => {
    try {
      // SEHR KLEINER Connection Pool um Atlas-Limit nicht zu überschreiten
      const clientOptions: any = {
        maxPoolSize: 3,  // REDUZIERT von 10 auf 3!
        minPoolSize: 1,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 75000,
        connectTimeoutMS: 30000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true,
        tls: true,
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false
      }
      
      const client = new MongoClient(uri, clientOptions)
      await client.connect()
      
      const db = client.db(dbName)
      
      // Test connection
      await db.admin().ping()
      
      cachedClient = client
      cachedDb = db
      
      console.log('✅ MongoDB API connected successfully (pool: 3)')

      return { client, db }
    } catch (error) {
      console.error('[MongoDB API] Connection failed:', error.message)
      connectionPromise = null
      throw error
    }
  })()

  return connectionPromise
}

export async function getJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...(init || {}) })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return (await res.json()) as T
}
