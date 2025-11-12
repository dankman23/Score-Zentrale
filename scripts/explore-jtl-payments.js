// Script to explore JTL payment tables
const sql = require('mssql');

const config = {
  user: 'sellermath',
  password: 'xbPWTh87rLtvQx11',
  server: '162.55.235.45',
  port: 49172,
  database: 'eazybusiness',
  connectionTimeout: 15000,
  requestTimeout: 30000,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  options: { 
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function explore() {
  try {
    console.log('Connecting to JTL database...');
    const pool = await sql.connect(config);
    console.log('Connected!\n');

    // 1. Check tZahlung columns
    console.log('=== tZahlung Table Columns ===');
    const zahlungCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tZahlung' AND TABLE_SCHEMA = 'dbo'
      ORDER BY ORDINAL_POSITION
    `);
    console.log(zahlungCols.recordset);
    console.log();

    // 2. Sample payments from October 30, 2025
    console.log('=== Sample Payments from Oct 30, 2025 ===');
    const oct30Payments = await pool.request().query(`
      SELECT TOP 10
        z.kZahlung,
        z.kRechnung,
        z.fBetrag,
        z.dDatum,
        z.cHinweis,
        z.kZahlungsart,
        za.cName AS zahlungsartName,
        r.cRechnungsNr
      FROM dbo.tZahlung z
      LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      LEFT JOIN dbo.tRechnung r ON z.kRechnung = r.kRechnung
      WHERE CAST(z.dDatum AS DATE) = '2025-10-30'
      ORDER BY z.dDatum DESC
    `);
    console.log('Found', oct30Payments.recordset.length, 'payments on Oct 30, 2025');
    console.log(JSON.stringify(oct30Payments.recordset, null, 2));
    console.log();

    // 3. Check all Zahlungsarten to find Commerzbank
    console.log('=== All Zahlungsarten (Payment Methods) ===');
    const zahlungsarten = await pool.request().query(`
      SELECT kZahlungsart, cName
      FROM dbo.tZahlungsart
      ORDER BY kZahlungsart
    `);
    console.log('Total payment methods:', zahlungsarten.recordset.length);
    console.log(JSON.stringify(zahlungsarten.recordset, null, 2));
    console.log();

    // 4. Count payments by Zahlungsart for October
    console.log('=== Payment Count by Zahlungsart (October 2025) ===');
    const paymentsByType = await pool.request().query(`
      SELECT 
        za.cName AS zahlungsart,
        COUNT(*) AS anzahl,
        SUM(z.fBetrag) AS gesamtBetrag
      FROM dbo.tZahlung z
      LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      WHERE z.dDatum >= '2025-10-01' AND z.dDatum < '2025-11-01'
      GROUP BY za.cName
      ORDER BY anzahl DESC
    `);
    console.log(JSON.stringify(paymentsByType.recordset, null, 2));
    console.log();

    // 5. Check for payments without kRechnung (unassigned)
    console.log('=== Unassigned Payments (no kRechnung) ===');
    const unassignedCount = await pool.request().query(`
      SELECT COUNT(*) AS count
      FROM dbo.tZahlung z
      WHERE z.dDatum >= '2025-10-01' AND z.dDatum < '2025-11-01'
        AND (z.kRechnung IS NULL OR z.kRechnung = 0)
    `);
    console.log('Unassigned payments:', unassignedCount.recordset[0].count);
    console.log();

    // 6. Sample of unassigned payments
    console.log('=== Sample Unassigned Payments ===');
    const unassignedSample = await pool.request().query(`
      SELECT TOP 10
        z.kZahlung,
        z.kRechnung,
        z.fBetrag,
        z.dDatum,
        z.cHinweis,
        za.cName AS zahlungsart
      FROM dbo.tZahlung z
      LEFT JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      WHERE z.dDatum >= '2025-10-01' AND z.dDatum < '2025-11-01'
        AND (z.kRechnung IS NULL OR z.kRechnung = 0)
      ORDER BY z.dDatum DESC
    `);
    console.log(JSON.stringify(unassignedSample.recordset, null, 2));
    console.log();

    // 7. Check for payment-related views or tables
    console.log('=== Payment-Related Tables/Views ===');
    const paymentTables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE (TABLE_NAME LIKE '%Zahlung%' OR TABLE_NAME LIKE '%Payment%')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    console.log(JSON.stringify(paymentTables.recordset, null, 2));
    console.log();

    // 8. Check date range of all payments
    console.log('=== Payment Date Range ===');
    const dateRange = await pool.request().query(`
      SELECT 
        MIN(dDatum) AS minDate,
        MAX(dDatum) AS maxDate,
        COUNT(*) AS totalPayments
      FROM dbo.tZahlung
    `);
    console.log(JSON.stringify(dateRange.recordset, null, 2));

    await pool.close();
    console.log('\n✅ Exploration complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  }
}

explore();
