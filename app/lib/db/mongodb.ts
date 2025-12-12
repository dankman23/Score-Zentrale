import 'server-only'
import { MongoClient, Db } from 'mongodb'

// Don't check MONGO_URL at module load time - only when actually connecting
// This allows the build to succeed without env vars present
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

function getMongoUrl(): string {
  const url = process.env.MONGO_URL
  if (!url) {
    throw new Error('MONGO_URL environment variable not set')
  }
  return url
}

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function getDb(): Promise<Db> {
  if (cachedDb) {
    return cachedDb
  }

  const MONGO_URL = getMongoUrl()

  if (!cachedClient) {
    // SEHR KLEINER Connection Pool um Atlas-Limit nicht zu überschreiten
    cachedClient = new MongoClient(MONGO_URL, {
      maxPoolSize: 2,  // REDUZIERT!
      minPoolSize: 1,
      retryWrites: true,
      serverSelectionTimeoutMS: 30000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false
    })
    await cachedClient.connect()
    console.log('✅ MongoDB DB/LIB connected successfully (pool: 2)')
  }

  // Get database name from env var or URL path
  const dbName = process.env.MONGO_DB || process.env.DB_NAME || new URL(MONGO_URL).pathname.substring(1)
  
  if (!dbName) {
    throw new Error('Database name must be specified in MONGO_DB, DB_NAME, or MONGO_URL path')
  }
  
  cachedDb = cachedClient.db(dbName)

  return cachedDb
}

export async function closeDb() {
  if (cachedClient) {
    await cachedClient.close()
    cachedClient = null
    cachedDb = null
  }
}
