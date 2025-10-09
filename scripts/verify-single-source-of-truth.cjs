/**
 * Verify Single Source of Truth for Medication Data
 * 
 * This script checks:
 * 1. Document counts in legacy collections
 * 2. Document counts in unified collections
 * 3. Which system is actually being used
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

async function checkCollectionCount(collectionName) {
  try {
    const snapshot = await db.collection(collectionName).limit(1000).get();
    return snapshot.size;
  } catch (error) {
    console.error(`Error checking ${collectionName}:`, error.message);
    return 0;
  }
}

async function verifySourceOfTruth() {
  console.log('🔍 VERIFYING SINGLE SOURCE OF TRUTH FOR MEDICATION DATA');
  console.log('='.repeat(80));
  
  // Check legacy collections
  console.log('\n📦 LEGACY COLLECTIONS:');
  const legacyMedications = await checkCollectionCount('medications');
  const legacySchedules = await checkCollectionCount('medication_schedules');
  const legacyReminders = await checkCollectionCount('medication_reminders');
  const legacyCalendarEvents = await checkCollectionCount('medication_calendar_events');
  
  console.log(`   medications: ${legacyMedications} documents`);
  console.log(`   medication_schedules: ${legacySchedules} documents`);
  console.log(`   medication_reminders: ${legacyReminders} documents`);
  console.log(`   medication_calendar_events: ${legacyCalendarEvents} documents`);
  
  const totalLegacy = legacyMedications + legacySchedules + legacyReminders;
  console.log(`   TOTAL LEGACY DATA: ${totalLegacy} documents (excluding calendar events)`);
  
  // Check unified collections
  console.log('\n🎯 UNIFIED COLLECTIONS:');
  const unifiedCommands = await checkCollectionCount('medication_commands');
  const unifiedEvents = await checkCollectionCount('medication_events');
  
  console.log(`   medication_commands: ${unifiedCommands} documents`);
  console.log(`   medication_events: ${unifiedEvents} documents`);
  
  const totalUnified = unifiedCommands + unifiedEvents;
  console.log(`   TOTAL UNIFIED DATA: ${totalUnified} documents`);
  
  // Analysis
  console.log('\n📊 ANALYSIS:');
  console.log('='.repeat(80));
  
  const hasLegacyData = totalLegacy > 0;
  const hasUnifiedData = totalUnified > 0;
  
  if (hasLegacyData && hasUnifiedData) {
    console.log('❌ PROBLEM: DUAL SOURCES OF TRUTH DETECTED');
    console.log('   Both legacy AND unified systems contain data.');
    console.log('   This means we do NOT have a single source of truth.');
    console.log('\n   Legacy system has: ' + totalLegacy + ' documents');
    console.log('   Unified system has: ' + totalUnified + ' documents');
    console.log('\n   ACTION REQUIRED:');
    console.log('   1. Complete migration from legacy to unified');
    console.log('   2. Archive or delete legacy collections');
    console.log('   3. Update frontend to use ONLY unified endpoints');
  } else if (hasUnifiedData && !hasLegacyData) {
    console.log('✅ SUCCESS: SINGLE SOURCE OF TRUTH ACHIEVED');
    console.log('   Only unified system contains data.');
    console.log('   Legacy collections are empty.');
    console.log('\n   Unified system has: ' + totalUnified + ' documents');
    console.log('\n   STATUS: Migration complete, single source of truth confirmed.');
  } else if (hasLegacyData && !hasUnifiedData) {
    console.log('⚠️  WARNING: STILL USING LEGACY SYSTEM');
    console.log('   Only legacy system contains data.');
    console.log('   Unified system is empty.');
    console.log('\n   Legacy system has: ' + totalLegacy + ' documents');
    console.log('\n   ACTION REQUIRED:');
    console.log('   1. Run migration to move data to unified system');
    console.log('   2. Update frontend to use unified endpoints');
  } else {
    console.log('ℹ️  INFO: NO MEDICATION DATA FOUND');
    console.log('   Both systems are empty.');
  }
  
  // Check for sample documents to see structure
  console.log('\n🔬 SAMPLE DATA INSPECTION:');
  console.log('='.repeat(80));
  
  if (legacyMedications > 0) {
    const legacyMedSnapshot = await db.collection('medications').limit(1).get();
    if (!legacyMedSnapshot.empty) {
      const sampleLegacy = legacyMedSnapshot.docs[0].data();
      console.log('\n   Sample Legacy Medication:');
      console.log('   - Has metadata.version?', 'metadata' in sampleLegacy && 'version' in sampleLegacy.metadata);
      console.log('   - Has embedded schedule?', 'schedule' in sampleLegacy);
      console.log('   - Has embedded reminders?', 'reminders' in sampleLegacy);
    }
  }
  
  if (unifiedCommands > 0) {
    const unifiedSnapshot = await db.collection('medication_commands').limit(1).get();
    if (!unifiedSnapshot.empty) {
      const sampleUnified = unifiedSnapshot.docs[0].data();
      console.log('\n   Sample Unified Command:');
      console.log('   - Has metadata.version?', 'metadata' in sampleUnified && 'version' in sampleUnified.metadata);
      console.log('   - Has medication object?', 'medication' in sampleUnified);
      console.log('   - Has schedule object?', 'schedule' in sampleUnified);
      console.log('   - Has status object?', 'status' in sampleUnified);
    }
  }
  
  // Final verdict
  console.log('\n' + '='.repeat(80));
  console.log('FINAL VERDICT:');
  console.log('='.repeat(80));
  
  if (hasLegacyData && hasUnifiedData) {
    console.log('❌ NO - We do NOT have a single source of truth');
    console.log('   Both systems are active. Migration incomplete.');
    return false;
  } else if (hasUnifiedData && !hasLegacyData) {
    console.log('✅ YES - We have a single source of truth');
    console.log('   Unified system is the only active source.');
    return true;
  } else if (hasLegacyData && !hasUnifiedData) {
    console.log('❌ NO - Still using legacy system only');
    console.log('   Migration has not been performed.');
    return false;
  } else {
    console.log('ℹ️  UNKNOWN - No data in either system');
    return null;
  }
}

// Run verification
verifySourceOfTruth()
  .then(result => {
    console.log('\n');
    process.exit(result === true ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 ERROR:', error);
    process.exit(1);
  });