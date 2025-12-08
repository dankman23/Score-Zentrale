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

  console.log('[MongoDB] Connecting to database:', dbName)

  // MongoDB Atlas requires specific SSL/TLS configuration
  const isAtlas = uri.includes('mongodb+srv://') || uri.includes('.mongodb.net')
  
  const clientOptions: any = {
    maxPoolSize: 10,
    minPoolSize: 2
  }
  
  if (isAtlas) {
    // Atlas-specific options
    clientOptions.retryWrites = true
    clientOptions.w = 'majority'
    clientOptions.serverSelectionTimeoutMS = 10000
  }
  
  cachedClient = new MongoClient(uri, clientOptions)
  await cachedClient.connect()
  
  cachedDb = cachedClient.db(dbName)
  
  console.log('✅ MongoDB connected successfully to:', isAtlas ? 'Atlas' : 'Local')

  return { client: cachedClient, db: cachedDb }
}

export async function getJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...(init || {}) })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return (await res.json()) as T
}
