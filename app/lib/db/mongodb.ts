import 'server-only'
import { MongoClient, Db } from 'mongodb'

const MONGO_URL = process.env.MONGO_URL!

if (!MONGO_URL) {
  throw new Error('MONGO_URL environment variable not set')
}

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function getDb(): Promise<Db> {
  if (cachedDb) {
    return cachedDb
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL)
    await cachedClient.connect()
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
