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

  const dbName = new URL(MONGO_URL).pathname.substring(1) || 'test'
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
