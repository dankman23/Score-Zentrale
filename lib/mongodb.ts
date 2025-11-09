import { MongoClient, Db } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function connectToMongoDB(): Promise<Db> {
  if (cachedDb) {
    return cachedDb
  }

  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const dbName = process.env.MONGO_DB || 'score_zentrale'

  if (!cachedClient) {
    cachedClient = new MongoClient(uri)
    await cachedClient.connect()
  }

  cachedDb = cachedClient.db(dbName)
  return cachedDb
}
