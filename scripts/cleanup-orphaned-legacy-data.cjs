/**
 * Cleanup Orphaned Legacy Medication Data
 * 
 * This script identifies and removes orphaned legacy medication data - records in legacy 
 * collections that don't have corresponding entries in the unified system.
 * 
 * Orphaned data = legacy records where medicationId doesn't exist in medication_commands
 * 
 * Usage:
 *   node scripts/cleanup-orphaned-legacy-data.cjs              # Dry-run mode (default)
 *   node scripts/cleanup-orphaned-legacy-data.cjs --execute    # Actually delete data
 *   node scripts/cleanup-orphaned-legacy-data.cjs --backup-only # Only create backup
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Parse command-line arguments
const args = process.argv.slice(2);
const executeMode = args.includes('--execute');
const backupOnly = args.includes('--backup-only');

// Initialize Firebase Admin
let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
    process.exit(1);
  }
}

if (!serviceAccount) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in environment variables');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

// Cleanup tracking
const cleanupId = `cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const cleanupLog = {
  id: cleanupId,
  startTime: new Date().toISOString(),
  mode: executeMode ? 'execute' : (backupOnly ? 'backup-only' : 'dry-run'),
  steps: [],
  errors: [],
  summary: {}
};

function logStep(step, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    step,
    ...data
  };
  cleanupLog.steps.push(logEntry);
  console.log(`[${new Date().toISOString()}] ${step}:`, data);
}

function logError(error, context = '') {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    context,
    error: error.message,
    stack: error.stack
  };
  cleanupLog.errors.push(errorEntry);
  console.error(`[ERROR] ${context}:`, error);
}

/**
 * Get all valid medication IDs from unified system
 */
async function getValidMedicationIds() {
  logStep('Fetching valid medication IDs from unified system');
  
  const commandsSnapshot = await db.collection('medication_commands')
    .where('commandType', '==', 'CREATE_MEDICATION')
    .get();
  
  const validIds = new Set();
  commandsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.medicationId) {
      validIds.add(data.medicationId);
    }
  });
  
  logStep('Valid medication IDs retrieved', { count: validIds.size });
  return validIds;
}

/**
 * Find orphaned records in a collection
 */
async function findOrphanedRecords(collectionName, validMedicationIds) {
  logStep(`Scanning ${collectionName} for orphaned records`);
  
  const snapshot = await db.collection(collectionName).get();
  const orphaned = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.medicationId && !validMedicationIds.has(data.medicationId)) {
      orphaned.push({
        id: doc.id,
        medicationId: data.medicationId,
        medicationName: data.medicationName || 'Unknown',
        patientId: data.patientId,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || 'Unknown',
        ...data
      });
    }
  });
  
  logStep(`Found orphaned records in ${collectionName}`, { count: orphaned.length });
  return orphaned;
}

/**
 * Create backup of orphaned data
 */
async function createBackup(orphanedData) {
  logStep('Creating backup of orphaned data');
  
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `orphaned-legacy-cleanup-${timestamp}.json`);
  
  const backup = {
    cleanupId,
    timestamp: new Date().toISOString(),
    mode: cleanupLog.mode,
    orphanedData,
    metadata: {
      totalRecords: Object.values(orphanedData).reduce((sum, arr) => sum + arr.length, 0),
      collections: Object.keys(orphanedData),
      counts: Object.fromEntries(
        Object.entries(orphanedData).map(([key, val]) => [key, val.length])
      )
    }
  };
  
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  logStep('Backup created', { path: backupPath });
  
  return backupPath;
}

/**
 * Delete orphaned records from a collection
 */
async function deleteOrphanedRecords(collectionName, orphanedRecords) {
  if (orphanedRecords.length === 0) {
    logStep(`No orphaned records to delete in ${collectionName}`);
    return 0;
  }
  
  logStep(`Deleting orphaned records from ${collectionName}`, { count: orphanedRecords.length });
  
  const batchSize = 500;
  let deletedCount = 0;
  
  for (let i = 0; i < orphanedRecords.length; i += batchSize) {
    const batch = db.batch();
    const batchRecords = orphanedRecords.slice(i, i + batchSize);
    
    batchRecords.forEach(record => {
      const docRef = db.collection(collectionName).doc(record.id);
      batch.delete(docRef);
    });
    
    await batch.commit();
    deletedCount += batchRecords.length;
    
    logStep(`Batch deleted from ${collectionName}`, { 
      batchNumber: Math.floor(i / batchSize) + 1,
      recordsInBatch: batchRecords.length,
      totalDeleted: deletedCount 
    });
  }
  
  logStep(`Completed deletion from ${collectionName}`, { totalDeleted: deletedCount });
  return deletedCount;
}

/**
 * Display sample orphaned records
 */
function displaySampleRecords(orphanedData) {
  console.log('\n📋 Sample orphaned records (first 5 from each collection):');
  console.log('='.repeat(80));
  
  for (const [collection, records] of Object.entries(orphanedData)) {
    if (records.length > 0) {
      console.log(`\n${collection} (${records.length} total):`);
      const samples = records.slice(0, 5);
      samples.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}`);
        console.log(`     Medication: ${record.medicationName} (ID: ${record.medicationId})`);
        console.log(`     Patient: ${record.patientId}`);
        console.log(`     Created: ${record.createdAt}`);
      });
      
      if (records.length > 5) {
        console.log(`  ... and ${records.length - 5} more`);
      }
    }
  }
}

/**
 * Save detailed report
 */
function saveReport(orphanedData, backupPath, deletionResults = null) {
  const reportPath = path.join(__dirname, '..', 'backups', `cleanup-report-${cleanupId}.json`);
  
  const report = {
    ...cleanupLog,
    endTime: new Date().toISOString(),
    duration: new Date() - new Date(cleanupLog.startTime),
    backupPath,
    orphanedData: Object.fromEntries(
      Object.entries(orphanedData).map(([key, val]) => [key, val.length])
    ),
    deletionResults,
    totalOrphanedRecords: Object.values(orphanedData).reduce((sum, arr) => sum + arr.length, 0)
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logStep('Report saved', { path: reportPath });
  
  return reportPath;
}

/**
 * Main cleanup function
 */
async function runCleanup() {
  console.log('='.repeat(80));
  console.log('🧹 ORPHANED LEGACY MEDICATION DATA CLEANUP');
  console.log('='.repeat(80));
  console.log(`Mode: ${cleanupLog.mode.toUpperCase()}`);
  console.log('='.repeat(80));
  
  try {
    // Step 1: Get valid medication IDs from unified system
    console.log('\n🔍 Scanning for orphaned legacy medication data...');
    const validMedicationIds = await getValidMedicationIds();
    console.log(`✓ Found ${validMedicationIds.size} valid medications in unified system`);
    
    // Step 2: Find orphaned records in each legacy collection
    const orphanedData = {
      medication_calendar_events: await findOrphanedRecords('medication_calendar_events', validMedicationIds),
      medication_schedules: await findOrphanedRecords('medication_schedules', validMedicationIds),
      medication_reminders: await findOrphanedRecords('medication_reminders', validMedicationIds)
    };
    
    const totalOrphaned = Object.values(orphanedData).reduce((sum, arr) => sum + arr.length, 0);
    
    // Display counts
    console.log('\n📊 Orphaned Records Found:');
    console.log('='.repeat(80));
    for (const [collection, records] of Object.entries(orphanedData)) {
      const icon = records.length > 0 ? '⚠️ ' : '✓';
      console.log(`${icon} ${collection}: ${records.length} orphaned records`);
    }
    console.log(`\nTotal orphaned records: ${totalOrphaned}`);
    
    if (totalOrphaned === 0) {
      console.log('\n✅ No orphaned records found. Database is clean!');
      process.exit(0);
    }
    
    // Display sample records
    displaySampleRecords(orphanedData);
    
    // Step 3: Create backup
    console.log('\n📦 Creating backup...');
    const backupPath = await createBackup(orphanedData);
    console.log(`✓ Backup saved to: ${backupPath}`);
    
    if (backupOnly) {
      console.log('\n✅ Backup-only mode complete. No records were deleted.');
      const reportPath = saveReport(orphanedData, backupPath);
      console.log(`📄 Report saved to: ${reportPath}`);
      process.exit(0);
    }
    
    // Step 4: Delete orphaned data (if in execute mode)
    let deletionResults = null;
    
    if (executeMode) {
      console.log('\n🗑️  Deleting orphaned data...');
      deletionResults = {
        medication_calendar_events: await deleteOrphanedRecords('medication_calendar_events', orphanedData.medication_calendar_events),
        medication_schedules: await deleteOrphanedRecords('medication_schedules', orphanedData.medication_schedules),
        medication_reminders: await deleteOrphanedRecords('medication_reminders', orphanedData.medication_reminders)
      };
      
      const totalDeleted = Object.values(deletionResults).reduce((sum, count) => sum + count, 0);
      
      console.log('\n✅ Cleanup complete!');
      console.log('='.repeat(80));
      console.log(`✓ Deleted ${deletionResults.medication_calendar_events} medication_calendar_events`);
      console.log(`✓ Deleted ${deletionResults.medication_schedules} medication_schedules`);
      console.log(`✓ Deleted ${deletionResults.medication_reminders} medication_reminders`);
      console.log(`\n📊 Total: ${totalDeleted} orphaned records removed`);
    } else {
      console.log('\n💡 DRY-RUN MODE: No records were deleted.');
      console.log('   Run with --execute to delete these records');
      console.log('   Run with --backup-only to only create backup');
    }
    
    // Step 5: Save report
    const reportPath = saveReport(orphanedData, backupPath, deletionResults);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Summary
    cleanupLog.summary = {
      validMedicationIds: validMedicationIds.size,
      orphanedRecords: totalOrphaned,
      backupPath,
      reportPath,
      deletionResults
    };
    
    console.log('\n' + '='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(JSON.stringify(cleanupLog.summary, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    logError(error, 'Cleanup failed');
    
    console.error('\n' + '='.repeat(80));
    console.error('❌ CLEANUP FAILED');
    console.error('='.repeat(80));
    console.error('\nError:', error.message);
    console.error('\nStack:', error.stack);
    
    process.exit(1);
  }
}

// Run cleanup
runCleanup();