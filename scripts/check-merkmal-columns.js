/**
 * Überprüft die Spaltennamen der Merkmal-Tabellen
 */

const sql = require('mssql')

const config = {
  user: process.env.MSSQL_USER || 'ecomdata_172',
  password: process.env.MSSQL_PASSWORD || 'T2aHr6X#Y6j8',
  server: process.env.MSSQL_SERVER || '162.55.235.45',
  database: process.env.MSSQL_DATABASE || 'ecomdata_172',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 60000
  }
}

async function checkColumns() {
  try {
    console.log('Verbinde mit MSSQL...')
    await sql.connect(config)
    console.log('✅ Verbunden\n')

    const tables = ['tArtikelMerkmal', 'tMerkmal', 'tMerkmalWert']

    for (const table of tables) {
      console.log(`\n📋 Tabelle: ${table}`)
      console.log('='.repeat(60))

      const result = await sql.query`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ${table}
        ORDER BY ORDINAL_POSITION
      `

      result.recordset.forEach(col => {
        const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
        console.log(`  ${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE}${length.padEnd(10)} ${nullable}`)
      })
    }

    await sql.close()
  } catch (error) {
    console.error('❌ Fehler:', error.message)
  }
}

checkColumns()
