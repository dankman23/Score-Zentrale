import { MongoClient, ServerApiVersion } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: any = null
let isConnecting = false
let connectionAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 3
let lastSuccessfulConnection: number = 0

async function createNewConnection() {
  const uri = process.env.MONGO_URL
  const dbName = process.env.DB_NAME
  
  if (!uri || !dbName) {
    throw new Error('MONGO_URL and DB_NAME environment variables must be set')
  }

  // Schließe alte Verbindung wenn vorhanden
  if (cachedClient) {
    try {
      await cachedClient.close(true) // Force close
    } catch (e) {
      console.log('[MongoDB] Error closing old connection:', e.message)
    }
    cachedClient = null
    cachedDb = null
  }

  console.log('[MongoDB] Creating new connection...')

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true,
    maxIdleTimeMS: 60000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: false,
    }
  })
  
  await client.connect()
  const db = client.db(dbName)
  
  // Test connection with timeout
  await Promise.race([
    db.admin().ping(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 3000))
  ])

  lastSuccessfulConnection = Date.now()
  console.log('[MongoDB] Connected successfully to', dbName)

  return { client, db }
}

export async function connectToDatabase() {
  // Wenn eine Verbindung existiert und vor weniger als 30 Sekunden erfolgreich war
  if (cachedClient && cachedDb && (Date.now() - lastSuccessfulConnection) < 30000) {
    try {
      // Quick ping um zu prüfen ob Verbindung noch aktiv ist
      await Promise.race([
        cachedDb.admin().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 1000))
      ])
      connectionAttempts = 0
      lastSuccessfulConnection = Date.now()
      return { client: cachedClient, db: cachedDb }
    } catch (error) {
      console.log('[MongoDB] Connection test failed:', error.message)
    }
  }

  // Warten wenn bereits ein Verbindungsversuch läuft
  if (isConnecting) {
    let waitCount = 0
    while (isConnecting && waitCount < 30) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waitCount++
    }
    if (cachedClient && cachedDb) {
      return { client: cachedClient, db: cachedDb }
    }
  }

  isConnecting = true

  try {
    connectionAttempts++
    
    if (connectionAttempts > MAX_RECONNECT_ATTEMPTS) {
      connectionAttempts = 0
      throw new Error(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`)
    }

    const { client, db } = await createNewConnection()

    cachedClient = client
    cachedDb = db
    connectionAttempts = 0

    return { client, db }
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message)
    cachedClient = null
    cachedDb = null
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
