/**
 * MongoDB Migration Script
 * Kopiert alle Daten von lokaler MongoDB zu MongoDB Atlas
 */

const { MongoClient } = require('mongodb');

// Source: Lokale MongoDB
const SOURCE_URI = 'mongodb://localhost:27017';
const SOURCE_DB = 'score_zentrale';

// Target: MongoDB Atlas
const TARGET_URI = 'mongodb+srv://scoreablage_db_user:zo1l76ayASCYguLi@scorez.t4otq4g.mongodb.net/score_zentrale?appName=ScoreZ';
const TARGET_DB = 'score_zentrale';

async function migrateData() {
  console.log('🚀 Starting MongoDB Migration...\n');
  
  let sourceClient;
  let targetClient;
  
  try {
    // Connect to source (local)
    console.log('📡 Connecting to local MongoDB...');
    sourceClient = new MongoClient(SOURCE_URI);
    await sourceClient.connect();
    const sourceDb = sourceClient.db(SOURCE_DB);
    console.log('✅ Connected to local MongoDB\n');
    
    // Connect to target (Atlas)
    console.log('📡 Connecting to MongoDB Atlas...');
    targetClient = new MongoClient(TARGET_URI, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 10000
    });
    await targetClient.connect();
    const targetDb = targetClient.db(TARGET_DB);
    console.log('✅ Connected to MongoDB Atlas\n');
    
    // Get all collections from source
    const collections = await sourceDb.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections to migrate:\n`);
    
    for (const collInfo of collections) {
      const collName = collInfo.name;
      console.log(`\n📦 Migrating collection: ${collName}`);
      
      try {
        // Get all documents from source collection
        const sourceCollection = sourceDb.collection(collName);
        const documents = await sourceCollection.find({}).toArray();
        
        console.log(`   Found ${documents.length} documents`);
        
        if (documents.length === 0) {
          console.log(`   ⏭️  Skipping empty collection`);
          continue;
        }
        
        // Insert into target collection
        const targetCollection = targetDb.collection(collName);
        
        // Clear target collection first (optional - comment out if you want to merge)
        await targetCollection.deleteMany({});
        console.log(`   🗑️  Cleared target collection`);
        
        // Insert documents
        await targetCollection.insertMany(documents);
        console.log(`   ✅ Migrated ${documents.length} documents`);
        
      } catch (error) {
        console.error(`   ❌ Error migrating ${collName}:`, error.message);
      }
    }
    
    console.log('\n\n🎉 Migration completed successfully!\n');
    
    // Summary
    console.log('📊 Summary:');
    const finalCollections = await targetDb.listCollections().toArray();
    for (const coll of finalCollections) {
      const count = await targetDb.collection(coll.name).countDocuments();
      console.log(`   - ${coll.name}: ${count} documents`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    if (sourceClient) {
      await sourceClient.close();
      console.log('\n✅ Closed local MongoDB connection');
    }
    if (targetClient) {
      await targetClient.close();
      console.log('✅ Closed Atlas connection');
    }
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
