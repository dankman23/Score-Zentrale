/**
 * Korrigiert falsche Amazon Payment Zuordnungen
 * Amazon Payment darf NUR zu XRE-* externen Rechnungen zugeordnet werden!
 */

const { MongoClient } = require('mongodb');
const mssql = require('mssql');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/score_zentrale';
const DB_NAME = new URL(MONGO_URL).pathname.substring(1) || 'score_zentrale';

const MSSQL_CONFIG = {
  server: 'localhost',
  database: 'eazybusiness',
  user: 'sa',
  password: 'YourStrong@Passw0rd',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function fixAmazonPayments() {
  const mongoClient = new MongoClient(MONGO_URL);
  let mssqlPool;
  
  try {
    await mongoClient.connect();
    console.log('✅ MongoDB verbunden');
    
    mssqlPool = await mssql.connect(MSSQL_CONFIG);
    console.log('✅ MSSQL verbunden\n');
    
    const db = mongoClient.db(DB_NAME);
    
    // 1. Finde alle Amazon Payment Zahlungen die zu RE-* Rechnungen zugeordnet sind
    const query = `
      SELECT 
        z.kZahlung,
        z.fBetrag,
        z.dDatum,
        z.cHinweis,
        z.kRechnung AS falscheRechnung,
        r.cRechnungsNr AS falscheRgNr,
        z.kBestellung,
        eb.kExternerBeleg,
        eb.cBelegnr AS externeRgNr,
        eb.fVkBrutto AS externeBetrag
      FROM dbo.tZahlung z
      INNER JOIN dbo.tRechnung r ON z.kRechnung = r.kRechnung
      INNER JOIN dbo.tZahlungsart za ON z.kZahlungsart = za.kZahlungsart
      LEFT JOIN Rechnung.tExternerBeleg eb ON eb.kExternerBeleg = z.kBestellung AND eb.nBelegtyp = 0
      WHERE za.cName LIKE '%Amazon%Payment%'
        AND r.cRechnungsNr NOT LIKE 'XRE-%'
        AND z.kBestellung IS NOT NULL
        AND eb.kExternerBeleg IS NOT NULL
      ORDER BY z.dDatum DESC
    `;
    
    const result = await mssqlPool.request().query(query);
    
    console.log(`❌ ${result.recordset.length} falsch zugeordnete Amazon Payment Zahlungen gefunden\n`);
    
    if (result.recordset.length === 0) {
      console.log('✅ Keine Korrekturen nötig!');
      return;
    }
    
    // 2. Zeige Beispiele
    console.log('📋 Beispiele:\n');
    result.recordset.slice(0, 5).forEach(z => {
      console.log(`  Zahlung ${z.kZahlung}: ${z.fBetrag}€`);
      console.log(`    FALSCH: → RE-Rechnung ${z.falscheRgNr}`);
      console.log(`    RICHTIG: → XRE-Rechnung ${z.externeRgNr} (${z.externeBetrag}€)`);
      console.log('');
    });
    
    // 3. Korrigiere in MongoDB
    const collection = db.collection('fibu_externe_rechnungen');
    let korrigiert = 0;
    
    for (const zahlung of result.recordset) {
      // Update externe Rechnung: setze zahlungId
      await collection.updateOne(
        { kExternerBeleg: zahlung.kExternerBeleg },
        {
          $set: {
            zahlungId: zahlung.kZahlung,
            zugeordnetAm: new Date(),
            korrigiert: true
          }
        }
      );
      korrigiert++;
    }
    
    console.log(`\n✅ ${korrigiert} externe Rechnungen in MongoDB korrigiert!`);
    console.log('\n⚠️  HINWEIS: Die falsche Zuordnung in JTL (tZahlung.kRechnung) bleibt bestehen,');
    console.log('    aber die FIBU nutzt jetzt die korrekte MongoDB-Zuordnung!\n');
    
  } catch (error) {
    console.error('❌ Fehler:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
    if (mssqlPool) await mssqlPool.close();
  }
}

console.log('\n🚀 Korrigiere Amazon Payment Zuordnungen...\n');
fixAmazonPayments();
