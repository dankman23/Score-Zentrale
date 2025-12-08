import { MongoClient } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: any = null
let connectionPromise: Promise<{ client: MongoClient; db: any }> | null = null

export async function connectToDatabase() {
  // Wenn bereits eine Verbindung existiert
  if (cachedClient && cachedDb) {
    try {
      // Teste ob Verbindung noch funktioniert
      await cachedDb.admin().ping()
      return { client: cachedClient, db: cachedDb }
    } catch (error) {
      console.log('[MongoDB] Connection lost, resetting...')
      cachedClient = null
      cachedDb = null
      connectionPromise = null
    }
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

  console.log('[MongoDB] Creating new connection to:', dbName)

  // Erstelle Connection Promise
  connectionPromise = (async () => {
    try {
      // MongoDB Atlas requires specific SSL/TLS configuration
      const isAtlas = uri.includes('mongodb+srv://') || uri.includes('.mongodb.net')
      
      const clientOptions: any = {
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 75000,
        connectTimeoutMS: 30000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true,
      }
      
      if (isAtlas) {
        // Explizite TLS-Konfiguration für Atlas
        clientOptions.tls = true
        clientOptions.tlsAllowInvalidCertificates = false
        clientOptions.tlsAllowInvalidHostnames = false
      }
      
      const client = new MongoClient(uri, clientOptions)
      await client.connect()
      
      const db = client.db(dbName)
      
      // Test connection
      await db.admin().ping()
      
      cachedClient = client
      cachedDb = db
      
      console.log('✅ MongoDB connected successfully to:', dbName)

      return { client, db }
    } catch (error) {
      console.error('[MongoDB] Connection failed:', error.message)
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
