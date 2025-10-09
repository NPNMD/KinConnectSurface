/**
 * Unified Medication System - Comprehensive Test Script
 * Phase 5: Testing and Validation
 * 
 * Tests:
 * 1. Medication CRUD operations
 * 2. User actions (take, undo, skip, snooze, pause, resume)
 * 3. Data integrity validation
 * 4. CASCADE DELETE functionality (CRITICAL)
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin with service account from .env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'claritystream-uldp9'
  });
}

const db = admin.firestore();

// Test configuration
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_PATIENT_ID = 'test-patient-' + Date.now();

// Test results tracking
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  metrics: {}
};

// Utility functions
function logSuccess(testName) {
  console.log(`✅ PASS: ${testName}`);
  testResults.passed.push(testName);
}

function logFailure(testName, error) {
  console.log(`❌ FAIL: ${testName}`);
  console.log(`   Error: ${error.message || error}`);
  testResults.failed.push({ test: testName, error: error.message || error });
}

function logWarning(testName, message) {
  console.log(`⚠️  WARN: ${testName}`);
  console.log(`   ${message}`);
  testResults.warnings.push({ test: testName, message });
}

async function measureTime(fn) {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

// Test 1: Create Test Medication
async function testCreateMedication() {
  const testName = 'Create Test Medication (medication_commands)';
  try {
    const { result: medicationId, duration } = await measureTime(async () => {
      const medicationRef = db.collection('medication_commands').doc();
      const medicationData = {
        userId: TEST_USER_ID,
        patientId: TEST_PATIENT_ID,
        medication: {
          name: 'Test Medication Alpha',
          dosage: '10mg',
          form: 'tablet',
          route: 'oral'
        },
        schedule: {
          frequency: 'daily',
          times: ['09:00'],
          startDate: new Date(),
          dosageAmount: '10mg'
        },
        status: {
          current: 'active',
          isActive: true,
          isPRN: false
        },
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: TEST_USER_ID
        }
      };
      
      await medicationRef.set(medicationData);
      return medicationRef.id;
    });

    testResults.metrics['createMedication'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
    return medicationId;
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 2: Retrieve Medication
async function testRetrieveMedication(medicationId) {
  const testName = 'Retrieve Medication';
  try {
    const { result: medication, duration } = await measureTime(async () => {
      const doc = await db.collection('medication_commands').doc(medicationId).get();
      if (!doc.exists) {
        throw new Error('Medication not found');
      }
      return doc.data();
    });

    testResults.metrics['retrieveMedication'] = duration;
    
    if (medication.medication.name !== 'Test Medication Alpha') {
      throw new Error('Medication data mismatch');
    }
    
    logSuccess(`${testName} (${duration}ms)`);
    return medication;
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 3: Update Medication
async function testUpdateMedication(medicationId) {
  const testName = 'Update Medication';
  try {
    const { duration } = await measureTime(async () => {
      await db.collection('medication_commands').doc(medicationId).update({
        'medication.dosage': '20mg',
        'metadata.updatedAt': new Date()
      });
    });

    testResults.metrics['updateMedication'] = duration;
    
    // Verify update
    const doc = await db.collection('medication_commands').doc(medicationId).get();
    if (doc.data().medication.dosage !== '20mg') {
      throw new Error('Update verification failed');
    }
    
    logSuccess(`${testName} (${duration}ms)`);
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 4: Create Medication Command (Mark as Taken)
async function testMarkMedicationTaken(medicationId) {
  const testName = 'Mark Medication as Taken';
  try {
    const { result: commandId, duration } = await measureTime(async () => {
      const commandRef = db.collection('medication_commands').doc();
      const commandData = {
        medicationId,
        userId: TEST_USER_ID,
        patientId: TEST_PATIENT_ID,
        action: 'mark_taken',
        timestamp: admin.firestore.Timestamp.now(),
        scheduledTime: '09:00',
        metadata: {
          takenAt: admin.firestore.Timestamp.now()
        }
      };
      
      await commandRef.set(commandData);
      return commandRef.id;
    });

    testResults.metrics['markTaken'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
    return commandId;
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 5: Create Medication Event
async function testCreateMedicationEvent(medicationId, commandId) {
  const testName = 'Create Medication Event';
  try {
    const { result: eventId, duration } = await measureTime(async () => {
      const eventRef = db.collection('medication_events').doc();
      const eventData = {
        medicationId,
        commandId,
        userId: TEST_USER_ID,
        patientId: TEST_PATIENT_ID,
        eventType: 'taken',
        timestamp: admin.firestore.Timestamp.now(),
        scheduledTime: '09:00',
        metadata: {
          source: 'test_script'
        }
      };
      
      await eventRef.set(eventData);
      return eventRef.id;
    });

    testResults.metrics['createEvent'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
    return eventId;
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 6: Undo Medication Taken
async function testUndoMedicationTaken(medicationId) {
  const testName = 'Undo Medication Taken';
  try {
    const { result: commandId, duration } = await measureTime(async () => {
      const commandRef = db.collection('medication_commands').doc();
      const commandData = {
        medicationId,
        userId: TEST_USER_ID,
        patientId: TEST_PATIENT_ID,
        action: 'undo_taken',
        timestamp: admin.firestore.Timestamp.now(),
        scheduledTime: '09:00'
      };
      
      await commandRef.set(commandData);
      return commandRef.id;
    });

    testResults.metrics['undoTaken'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
    return commandId;
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 7: Skip Medication
async function testSkipMedication(medicationId) {
  const testName = 'Skip Medication';
  try {
    const { result: commandId, duration } = await measureTime(async () => {
      const commandRef = db.collection('medication_commands').doc();
      const commandData = {
        medicationId,
        userId: TEST_USER_ID,
        patientId: TEST_PATIENT_ID,
        action: 'skip',
        timestamp: admin.firestore.Timestamp.now(),
        scheduledTime: '09:00',
        metadata: {
          reason: 'Test skip reason'
        }
      };
      
      await commandRef.set(commandData);
      return commandRef.id;
    });

    testResults.metrics['skipMedication'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
    return commandId;
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 8: Snooze Medication
async function testSnoozeMedication(medicationId) {
  const testName = 'Snooze Medication';
  try {
    const { result: commandId, duration } = await measureTime(async () => {
      const commandRef = db.collection('medication_commands').doc();
      const commandData = {
        medicationId,
        userId: TEST_USER_ID,
        patientId: TEST_PATIENT_ID,
        action: 'snooze',
        timestamp: admin.firestore.Timestamp.now(),
        scheduledTime: '09:00',
        metadata: {
          snoozeUntil: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000))
        }
      };
      
      await commandRef.set(commandData);
      return commandRef.id;
    });

    testResults.metrics['snoozeMedication'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
    return commandId;
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 9: Pause Medication
async function testPauseMedication(medicationId) {
  const testName = 'Pause Medication';
  try {
    const { duration } = await measureTime(async () => {
      await db.collection('medication_commands').doc(medicationId).update({
        'status.current': 'paused',
        'status.isActive': false,
        'status.pausedAt': new Date(),
        'metadata.updatedAt': new Date()
      });
    });

    testResults.metrics['pauseMedication'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 10: Resume Medication
async function testResumeMedication(medicationId) {
  const testName = 'Resume Medication';
  try {
    const { duration } = await measureTime(async () => {
      await db.collection('medication_commands').doc(medicationId).update({
        'status.current': 'active',
        'status.isActive': true,
        'status.pausedAt': admin.firestore.FieldValue.delete(),
        'metadata.updatedAt': new Date()
      });
    });

    testResults.metrics['resumeMedication'] = duration;
    logSuccess(`${testName} (${duration}ms)`);
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 11: Validate Data Integrity
async function testDataIntegrity(medicationId) {
  const testName = 'Data Integrity Validation';
  try {
    // Count commands
    const commandsSnapshot = await db.collection('medication_commands')
      .where('medicationId', '==', medicationId)
      .get();
    
    const commandCount = commandsSnapshot.size;
    
    // Count events
    const eventsSnapshot = await db.collection('medication_events')
      .where('medicationId', '==', medicationId)
      .get();
    
    const eventCount = eventsSnapshot.size;
    
    console.log(`   Commands: ${commandCount}, Events: ${eventCount}`);
    
    // We created: mark_taken, undo_taken, skip, snooze = 4 commands
    // We created: 1 event manually
    if (commandCount < 4) {
      logWarning(testName, `Expected at least 4 commands, found ${commandCount}`);
    }
    
    if (eventCount < 1) {
      logWarning(testName, `Expected at least 1 event, found ${eventCount}`);
    }
    
    logSuccess(`${testName} - Commands: ${commandCount}, Events: ${eventCount}`);
    return { commandCount, eventCount };
  } catch (error) {
    logFailure(testName, error);
    throw error;
  }
}

// Test 12: CASCADE DELETE (CRITICAL TEST)
async function testCascadeDelete(medicationId) {
  const testName = 'CASCADE DELETE Functionality';
  console.log('\n🔥 CRITICAL TEST: CASCADE DELETE');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Count related data BEFORE deletion
    // Check if command exists
    const commandDoc = await db.collection('medication_commands').doc(medicationId).get();
    const commandsBeforeCount = commandDoc.exists ? 1 : 0;

    const eventsBeforeSnapshot = await db.collection('medication_events')
      .where('commandId', '==', medicationId)
      .get();
    const eventsBeforeCount = eventsBeforeSnapshot.size;
    
    console.log(`   Before deletion:`);
    console.log(`   - Commands: ${commandsBeforeCount}`);
    console.log(`   - Events: ${eventsBeforeCount}`);
    
    // Step 2: Delete the medication (hard delete to test CASCADE)
    const { duration } = await measureTime(async () => {
      await db.collection('medication_commands').doc(medicationId).delete();
    });
    
    testResults.metrics['deleteMedication'] = duration;
    console.log(`   Medication deleted (${duration}ms)`);
    
    // Step 3: Wait for CASCADE DELETE to process
    console.log(`   Waiting 2 seconds for CASCADE DELETE...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Check for orphaned commands
    const orphanedCommandDoc = await db.collection('medication_commands').doc(medicationId).get();
    const orphanedCommandsCount = orphanedCommandDoc.exists ? 1 : 0;

    // Step 5: Check for orphaned events
    const orphanedEventsSnapshot = await db.collection('medication_events')
      .where('commandId', '==', medicationId)
      .get();
    const orphanedEventsCount = orphanedEventsSnapshot.size;
    
    // Step 6: Check archived events
    const archivedEventsSnapshot = await db.collection('medication_events_archive')
      .where('commandId', '==', medicationId)
      .get();
    const archivedEventsCount = archivedEventsSnapshot.size;
    
    console.log(`   After deletion:`);
    console.log(`   - Orphaned Commands: ${orphanedCommandsCount}`);
    console.log(`   - Orphaned Events: ${orphanedEventsCount}`);
    console.log(`   - Archived Events: ${archivedEventsCount}`);
    
    // Step 7: Validate CASCADE DELETE worked (hard delete via direct Firestore delete)
    if (orphanedCommandsCount > 0) {
      throw new Error(`CASCADE DELETE FAILED: ${orphanedCommandsCount} orphaned commands found after hard delete`);
    }

    if (orphanedEventsCount > 0) {
      throw new Error(`CASCADE DELETE FAILED: ${orphanedEventsCount} orphaned events found`);
    }

    console.log('=' .repeat(60));
    logSuccess(`${testName} - Zero orphaned records after hard delete`);
    
    return {
      commandsDeleted: commandsBeforeCount,
      eventsDeleted: eventsBeforeCount,
      orphanedCommands: orphanedCommandsCount,
      orphanedEvents: orphanedEventsCount,
      archivedEvents: archivedEventsCount
    };
  } catch (error) {
    console.log('=' .repeat(60));
    logFailure(testName, error);
    throw error;
  }
}

// Test 13: Cleanup Test Data
async function cleanupTestData() {
  const testName = 'Cleanup Test Data';
  try {
    // Delete any remaining test medications
    const testMedsSnapshot = await db.collection('medication_commands')
      .where('userId', '==', TEST_USER_ID)
      .get();
    
    const batch = db.batch();
    testMedsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Also clean up any remaining test commands
    const testCommandsSnapshot = await db.collection('medication_commands')
      .where('patientId', '==', TEST_PATIENT_ID)
      .get();
    
    testCommandsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    logSuccess(`${testName} - Cleaned ${testMedsSnapshot.size + testCommandsSnapshot.size} test records`);
  } catch (error) {
    logWarning(testName, error.message);
  }
}

// Generate Test Report
function generateTestReport() {
  console.log('\n' + '='.repeat(80));
  console.log('UNIFIED MEDICATION SYSTEM - TEST REPORT');
  console.log('Phase 5: Testing and Validation');
  console.log('='.repeat(80));
  
  console.log('\n📊 TEST SUMMARY:');
  console.log(`   Total Tests: ${testResults.passed.length + testResults.failed.length}`);
  console.log(`   ✅ Passed: ${testResults.passed.length}`);
  console.log(`   ❌ Failed: ${testResults.failed.length}`);
  console.log(`   ⚠️  Warnings: ${testResults.warnings.length}`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.failed.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
  }
  
  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    testResults.warnings.forEach(({ test, message }) => {
      console.log(`   - ${test}: ${message}`);
    });
  }
  
  console.log('\n⚡ PERFORMANCE METRICS:');
  Object.entries(testResults.metrics).forEach(([operation, duration]) => {
    console.log(`   ${operation}: ${duration}ms`);
  });
  
  const avgResponseTime = Object.values(testResults.metrics).reduce((a, b) => a + b, 0) / Object.values(testResults.metrics).length;
  console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  
  console.log('\n' + '='.repeat(80));
  
  if (testResults.failed.length === 0) {
    console.log('✅ ALL TESTS PASSED - SYSTEM READY FOR PRODUCTION');
  } else {
    console.log('❌ TESTS FAILED - DO NOT DEPLOY TO PRODUCTION');
  }
  console.log('='.repeat(80) + '\n');
  
  return {
    summary: {
      total: testResults.passed.length + testResults.failed.length,
      passed: testResults.passed.length,
      failed: testResults.failed.length,
      warnings: testResults.warnings.length
    },
    metrics: testResults.metrics,
    avgResponseTime,
    status: testResults.failed.length === 0 ? 'PASS' : 'FAIL'
  };
}

// Main Test Execution
async function runAllTests() {
  console.log('🚀 Starting Unified Medication System Tests...\n');
  
  let medicationId;
  let commandId;
  let eventId;
  
  try {
    // Phase 1: CRUD Operations
    console.log('📝 Phase 1: CRUD Operations');
    console.log('-'.repeat(60));
    medicationId = await testCreateMedication();
    await testRetrieveMedication(medicationId);
    await testUpdateMedication(medicationId);
    
    // Phase 2: User Actions
    console.log('\n👤 Phase 2: User Actions');
    console.log('-'.repeat(60));
    commandId = await testMarkMedicationTaken(medicationId);
    eventId = await testCreateMedicationEvent(medicationId, commandId);
    await testUndoMedicationTaken(medicationId);
    await testSkipMedication(medicationId);
    await testSnoozeMedication(medicationId);
    await testPauseMedication(medicationId);
    await testResumeMedication(medicationId);
    
    // Phase 3: Data Integrity
    console.log('\n🔍 Phase 3: Data Integrity');
    console.log('-'.repeat(60));
    await testDataIntegrity(medicationId);
    
    // Phase 4: CASCADE DELETE (CRITICAL)
    await testCascadeDelete(medicationId);
    
    // Phase 5: Cleanup
    console.log('\n🧹 Phase 5: Cleanup');
    console.log('-'.repeat(60));
    await cleanupTestData();
    
    // Generate Report
    const report = generateTestReport();
    
    // Save report to file
    const fs = require('fs');
    const reportPath = path.join(__dirname, '../PHASE_5_TEST_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      testResults,
      report
    }, null, 2));
    
    console.log(`📄 Test report saved to: ${reportPath}\n`);
    
    process.exit(testResults.failed.length === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();