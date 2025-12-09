import { getJTLConnection } from '@/lib/db/mssql'

async function analyzeTransactionTypes() {
  try {
    const pool = await getJTLConnection()
    
    console.log('\n=== Analysiere TransactionTypes ===\n')
    
    const result = await pool.request().query(`
      SELECT 
        TransactionType,
        AmountType,
        COUNT(*) as anzahl,
        SUM(Amount) as summe
      FROM dbo.pf_amazon_settlementpos
      WHERE PostedDateTime >= '2025-10-01' 
        AND PostedDateTime < '2025-11-01'
      GROUP BY TransactionType, AmountType
      ORDER BY TransactionType, AmountType
    `)
    
    console.log('TransactionType | AmountType | Anzahl | Summe')
    console.log('------------------------------------------------')
    result.recordset.forEach(row => {
      console.log(`${row.TransactionType || '(leer)'} | ${row.AmountType || '(leer)'} | ${row.anzahl} | ${row.summe?.toFixed(2) || '0.00'}`)
    })
    
    await pool.close()
  } catch (error) {
    console.error('Fehler:', error)
  }
}

analyzeTransactionTypes()
