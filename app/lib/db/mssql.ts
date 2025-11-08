import 'server-only'
import sql, { ConnectionPool } from 'mssql'

let pool: ConnectionPool | null = null
let connectionAttempts = 0
const MAX_RETRIES = 2

export async function getMssqlPool(): Promise<ConnectionPool> {
  if (pool && pool.connected) return pool
  
  const encrypt = process.env.JTL_SQL_ENCRYPT === 'true'
  const trustServerCertificate = process.env.JTL_SQL_TRUST_CERT === 'true'
  
  const config = {
    user: process.env.JTL_SQL_USER as string,
    password: process.env.JTL_SQL_PASSWORD as string,
    server: process.env.JTL_SQL_HOST as string,
    port: parseInt(process.env.JTL_SQL_PORT || '1433', 10),
    database: process.env.JTL_SQL_DATABASE as string,
    connectionTimeout: 15000,
    requestTimeout: 30000,
    pool: { 
      max: 5, 
      min: 0, 
      idleTimeoutMillis: 30000 
    },
    options: { 
      encrypt, 
      trustServerCertificate,
      enableArithAbort: true
    }
  } as any

  // Retry logic for ETIMEDOUT/ECONNRESET
  while (connectionAttempts < MAX_RETRIES) {
    try {
      pool = await sql.connect(config)
      connectionAttempts = 0 // Reset on success
      console.log('[MSSQL] Connected successfully to', config.server)
      return pool
    } catch (error: any) {
      connectionAttempts++
      const isRetryable = ['ETIMEDOUT', 'ECONNRESET', 'ESOCKET'].includes(error.code)
      
      if (isRetryable && connectionAttempts < MAX_RETRIES) {
        const delay = connectionAttempts * 1000 // Exponential backoff
        console.warn(`[MSSQL] Connection failed (${error.code}), retrying in ${delay}ms... (${connectionAttempts}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error('[MSSQL] Connection failed:', error.code || error.message)
        connectionAttempts = 0
        throw error
      }
    }
  }
  
  throw new Error('MSSQL connection failed after retries')
}
