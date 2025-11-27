import { MongoClient, Db } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

/**
 * Extract database name from MongoDB connection string
 * e.g., mongodb://host:port/dbname -> dbname
 * e.g., mongodb+srv://user:pass@cluster.mongodb.net/mydb?retryWrites=true -> mydb
 */
function extractDbNameFromUri(uri: string): string | null {
  try {
    // Match database name after the last slash and before any query params
    const match = uri.match(/\/([^/?]+)(\?|$)/)
    return match && match[1] && match[1] !== 'admin' ? match[1] : null
  } catch {
    return null
  }
}

export async function connectToMongoDB(): Promise<Db> {
  if (cachedDb) {
    return cachedDb
  }

  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017'
  
  // Try to get DB name from: 1) env var, 2) connection string, 3) fallback
  let dbName = process.env.MONGO_DB || process.env.DB_NAME
  
  if (!dbName) {
    // Try to extract from connection string
    dbName = extractDbNameFromUri(uri)
  }
  
  // Final fallback (but log warning)
  if (!dbName) {
    dbName = 'score_zentrale'
    console.warn('⚠️ No database name found in MONGO_URL or MONGO_DB/DB_NAME env vars. Using fallback:', dbName)
  }
  
  // Validate we're not connecting to 'test' in production
  if (dbName === 'test' && process.env.NODE_ENV === 'production') {
    throw new Error('❌ FATAL: Refusing to connect to "test" database in production. Please set MONGO_DB or include database name in MONGO_URL')
  }

  console.log('MongoDB connecting to database:', dbName)

  if (!cachedClient) {
    cachedClient = new MongoClient(uri)
    await cachedClient.connect()
    console.log('✅ MongoDB connected successfully')
  }

  cachedDb = cachedClient.db(dbName)
  return cachedDb
}
