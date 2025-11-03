import 'server-only'
import sql, { ConnectionPool } from 'mssql'

let pool: ConnectionPool | null = null

export async function getMssqlPool(): Promise<ConnectionPool> {
  if (pool) return pool
  const config = {
    user: process.env.JTL_SQL_USER as string,
    password: process.env.JTL_SQL_PASSWORD as string,
    server: process.env.JTL_SQL_HOST as string,
    port: parseInt(process.env.JTL_SQL_PORT || '1433', 10),
    database: process.env.JTL_SQL_DB as string,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true }
  } as any
  pool = await sql.connect(config)
  return pool
}
