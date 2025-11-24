const sql = require('mssql');

const config = {
  server: process.env.JTL_SQL_HOST || '162.55.235.45',
  port: parseInt(process.env.JTL_SQL_PORT) || 49172,
  database: process.env.JTL_SQL_DATABASE || 'eazybusiness',
  user: process.env.JTL_SQL_USER || 'sellermath',
  password: process.env.JTL_SQL_PASSWORD || 'xbPWTh87rLtvQx11',
  options: {
    encrypt: process.env.JTL_SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.JTL_SQL_TRUST_CERT !== 'false'
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function checkSchema() {
  try {
    console.log('Connecting to MSSQL...');
    const pool = await sql.connect(config);
    
    // Check tMerkmal table columns
    console.log('\n=== tMerkmal table columns ===');
    const result1 = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tMerkmal'
      ORDER BY ORDINAL_POSITION
    `);
    
    result1.recordset.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check tMerkmalWertSprache table columns
    console.log('\n=== tMerkmalWertSprache table columns ===');
    const result2 = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tMerkmalWertSprache'
      ORDER BY ORDINAL_POSITION
    `);
    
    result2.recordset.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check tArtikelMerkmal table columns
    console.log('\n=== tArtikelMerkmal table columns ===');
    const result3 = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tArtikelMerkmal'
      ORDER BY ORDINAL_POSITION
    `);
    
    result3.recordset.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Test a sample query to see what data exists
    console.log('\n=== Sample Merkmal data ===');
    const sampleResult = await pool.request().query(`
      SELECT TOP 5 * FROM tMerkmal
    `);
    
    console.log('Sample tMerkmal records:');
    sampleResult.recordset.forEach((row, i) => {
      console.log(`  Record ${i + 1}:`, JSON.stringify(row, null, 2));
    });
    
    await pool.close();
    console.log('\nConnection closed.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();