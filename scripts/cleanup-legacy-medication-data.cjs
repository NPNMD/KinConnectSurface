/**
 * Cleanup Script: Remove ALL legacy medication data
 * This script deletes all data from legacy medication collections
 * 
 * ONLY USE THIS IF YOU HAVE TEST DATA ONLY!
 */

const admin = require('firebase-admin');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Initialize Firebase Admin with service account from .env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Legacy collections to clean up
const LEGACY_COLLECTIONS = [
  'medications',
  'medication_schedules',
  'medication_calendar_events',
  'medication_reminders',
  'medication_grace_periods',
  'medication_status_changes',
  'medication_notification_queue',
  'medication_notification_delivery_log',
  'medication_detection_metrics',
  'medication_daily_summaries',
  'medication_reminder_sent_log',
  'medication_reminder_logs',
  'prn_medication_logs'
];

async function deleteCollection(collectionName, batchSize = 100) {
  const collectionRef = db.collection(collectionName);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  try {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      resolve();
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`  Deleted ${snapshot.size} documents`);

    // Recurse on the next batch
    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function cleanupLegacyData(dryRun = true) {
  console.log('🗑️  Starting Legacy Medication Data Cleanup');
  console.log('==========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}\n`);

  const stats = {
    collectionsProcessed: 0,
    totalDocumentsDeleted: 0,
    collectionStats: {}
  };

  try {
    for (const collectionName of LEGACY_COLLECTIONS) {
      console.log(`\n📋 Processing collection: ${collectionName}`);
      
      // Count documents
      const snapshot = await db.collection(collectionName).count().get();
      const count = snapshot.data().count;
      
      console.log(`  Found ${count} documents`);
      stats.collectionStats[collectionName] = count;
      
      if (count === 0) {
        console.log(`  ✅ Already empty, skipping...`);
        continue;
      }

      if (!dryRun) {
        console.log(`  🗑️  Deleting ${count} documents...`);
        await deleteCollection(collectionName);
        console.log(`  ✅ Deleted all documents from ${collectionName}`);
        stats.totalDocumentsDeleted += count;
      } else {
        console.log(`  🔍 [DRY RUN] Would delete ${count} documents`);
        stats.totalDocumentsDeleted += count;
      }
      
      stats.collectionsProcessed++;
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`  Collections processed: ${stats.collectionsProcessed}`);
    console.log(`  Total documents ${dryRun ? 'to delete' : 'deleted'}: ${stats.totalDocumentsDeleted}`);
    
    console.log('\n📋 Breakdown by collection:');
    Object.entries(stats.collectionStats).forEach(([collection, count]) => {
      if (count > 0) {
        console.log(`  - ${collection}: ${count} documents`);
      }
    });

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no data was deleted');
      console.log('   Run with --production flag to actually delete data');
    } else {
      console.log('\n✅ Legacy medication data cleanup completed!');
      console.log('   All legacy collections have been cleared');
    }

    return stats;

  } catch (error) {
    console.error('❌ Fatal cleanup error:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--production');

if (!dryRun) {
  console.log('⚠️  WARNING: Running in PRODUCTION mode!');
  console.log('⚠️  This will DELETE ALL legacy medication data!');
  console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...\n');
  
  // Give user 5 seconds to cancel
  setTimeout(() => {
    cleanupLegacyData(false)
      .then(() => {
        console.log('\n✅ Cleanup completed successfully!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
      });
  }, 5000);
} else {
  // Run immediately in dry run mode
  cleanupLegacyData(true)
    .then(() => {
      console.log('\n✅ Dry run completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Dry run failed:', error);
      process.exit(1);
    });
}