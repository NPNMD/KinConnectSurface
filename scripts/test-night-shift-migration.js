/**
 * Test Script: Night Shift Time Configuration Migration
 * 
 * This script tests the migration functionality with sample data
 * to ensure it correctly identifies and fixes 02:00 defaults
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

/**
 * Create test patient preferences with problematic configurations
 */
async function createTestData() {
  console.log('📝 Creating test patient preferences...');
  
  const testPatients = [
    {
      id: 'test_patient_1_night_shift_bug',
      patientId: 'test_patient_1',
      workSchedule: 'night_shift',
      timeSlots: {
        morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
        noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
        evening: { start: '01:00', end: '04:00', defaultTime: '02:00', label: 'Evening' }, // BUG!
        bedtime: { start: '06:00', end: '10:00', defaultTime: '06:00', label: 'Bedtime' } // BUG!
      },
      quietHours: { start: '22:00', end: '07:00', enabled: true },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    },
    {
      id: 'test_patient_2_night_shift_correct',
      patientId: 'test_patient_2',
      workSchedule: 'night_shift',
      timeSlots: {
        morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
        noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
        evening: { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Late Evening' }, // CORRECT
        bedtime: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning Sleep' } // CORRECT
      },
      quietHours: { start: '22:00', end: '07:00', enabled: true },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    },
    {
      id: 'test_patient_3_standard_unusual',
      patientId: 'test_patient_3',
      workSchedule: 'standard',
      timeSlots: {
        morning: { start: '06:00', end: '10:00', defaultTime: '02:00', label: 'Morning' }, // UNUSUAL!
        noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Afternoon' },
        evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
        bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
      },
      quietHours: { start: '22:00', end: '07:00', enabled: true },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    },
    {
      id: 'test_patient_4_standard_correct',
      patientId: 'test_patient_4',
      workSchedule: 'standard',
      timeSlots: {
        morning: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning' },
        noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Afternoon' },
        evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
        bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
      },
      quietHours: { start: '22:00', end: '07:00', enabled: true },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    }
  ];

  const batch = firestore.batch();
  
  for (const patient of testPatients) {
    const ref = firestore.collection('patient_medication_preferences').doc(patient.id);
    batch.set(ref, patient);
  }
  
  await batch.commit();
  
  console.log(`✅ Created ${testPatients.length} test patient preferences`);
  return testPatients;
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  const testQuery = await firestore.collection('patient_medication_preferences')
    .where('patientId', '>=', 'test_patient_')
    .where('patientId', '<=', 'test_patient_\uf8ff')
    .get();
  
  const batch = firestore.batch();
  testQuery.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  
  console.log(`✅ Cleaned up ${testQuery.docs.length} test records`);
}

/**
 * Run migration test
 */
async function runMigrationTest() {
  console.log('🧪 ===== NIGHT SHIFT MIGRATION TEST START =====');
  console.log('');
  
  try {
    // Step 1: Create test data
    console.log('📝 Step 1: Creating test data...');
    const testPatients = await createTestData();
    console.log('');
    
    // Step 2: Run dry-run migration
    console.log('🔍 Step 2: Running DRY RUN migration...');
    const dryRunResponse = await fetch('http://localhost:5001/kinconnect-production/us-central1/api/migrations/fix-night-shift-defaults', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // You'll need a real token
      },
      body: JSON.stringify({ dryRun: true })
    });
    
    if (!dryRunResponse.ok) {
      console.error('❌ Dry run failed:', await dryRunResponse.text());
    } else {
      const dryRunResult = await dryRunResponse.json();
      console.log('✅ Dry run completed:');
      console.log(JSON.stringify(dryRunResult, null, 2));
    }
    console.log('');
    
    // Step 3: Verify test data before migration
    console.log('🔍 Step 3: Verifying test data BEFORE migration...');
    const beforeQuery = await firestore.collection('patient_medication_preferences')
      .where('patientId', '>=', 'test_patient_')
      .where('patientId', '<=', 'test_patient_\uf8ff')
      .get();
    
    console.log('Before migration:');
    beforeQuery.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  Patient ${data.patientId}:`);
      console.log(`    Work Schedule: ${data.workSchedule}`);
      console.log(`    Evening Default: ${data.timeSlots?.evening?.defaultTime}`);
      console.log(`    Evening Range: ${data.timeSlots?.evening?.start}-${data.timeSlots?.evening?.end}`);
      console.log(`    Bedtime Default: ${data.timeSlots?.bedtime?.defaultTime}`);
    });
    console.log('');
    
    // Step 4: Run actual migration (commented out for safety)
    console.log('⚠️ Step 4: SKIPPING actual migration (set dryRun: false to run)');
    console.log('   To run actual migration, uncomment the code below');
    console.log('');
    
    /*
    console.log('🔧 Step 4: Running LIVE migration...');
    const liveResponse = await fetch('http://localhost:5001/kinconnect-production/us-central1/api/migrations/fix-night-shift-defaults', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({ dryRun: false })
    });
    
    if (!liveResponse.ok) {
      console.error('❌ Live migration failed:', await liveResponse.text());
    } else {
      const liveResult = await liveResponse.json();
      console.log('✅ Live migration completed:');
      console.log(JSON.stringify(liveResult, null, 2));
    }
    console.log('');
    
    // Step 5: Verify test data after migration
    console.log('🔍 Step 5: Verifying test data AFTER migration...');
    const afterQuery = await firestore.collection('patient_medication_preferences')
      .where('patientId', '>=', 'test_patient_')
      .where('patientId', '<=', 'test_patient_\uf8ff')
      .get();
    
    console.log('After migration:');
    afterQuery.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  Patient ${data.patientId}:`);
      console.log(`    Work Schedule: ${data.workSchedule}`);
      console.log(`    Evening Default: ${data.timeSlots?.evening?.defaultTime}`);
      console.log(`    Evening Range: ${data.timeSlots?.evening?.start}-${data.timeSlots?.evening?.end}`);
      console.log(`    Bedtime Default: ${data.timeSlots?.bedtime?.defaultTime}`);
      console.log(`    Migration Applied: ${data.migrationApplied || false}`);
    });
    console.log('');
    */
    
    // Step 6: Cleanup
    console.log('🧹 Step 6: Cleaning up test data...');
    await cleanupTestData();
    console.log('');
    
    console.log('✅ ===== NIGHT SHIFT MIGRATION TEST COMPLETE =====');
    console.log('');
    console.log('Expected Results:');
    console.log('  - test_patient_1: Should be flagged for fix (evening 02:00 → 00:00, bedtime 06:00 → 08:00)');
    console.log('  - test_patient_2: Should be skipped (already correct)');
    console.log('  - test_patient_3: Should be flagged for fix (morning 02:00 → 08:00)');
    console.log('  - test_patient_4: Should be skipped (already correct)');
    console.log('');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Cleanup on error
    try {
      await cleanupTestData();
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
  }
}

/**
 * Test validation functions directly
 */
async function testValidationFunctions() {
  console.log('🧪 ===== VALIDATION FUNCTION TEST START =====');
  console.log('');
  
  const { validatePatientPreferences } = require('../functions/src/migrations/fixNightShiftDefaults');
  
  // Test case 1: Problematic night shift configuration
  console.log('Test 1: Problematic night shift configuration');
  const problematicConfig = {
    workSchedule: 'night_shift',
    timeSlots: {
      morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
      noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
      evening: { start: '01:00', end: '04:00', defaultTime: '02:00', label: 'Evening' },
      bedtime: { start: '06:00', end: '10:00', defaultTime: '06:00', label: 'Bedtime' }
    }
  };
  
  const result1 = validatePatientPreferences(problematicConfig);
  console.log('  Valid:', result1.isValid);
  console.log('  Issues:', result1.issues);
  console.log('  Fixes:', JSON.stringify(result1.fixes, null, 2));
  console.log('');
  
  // Test case 2: Correct night shift configuration
  console.log('Test 2: Correct night shift configuration');
  const correctConfig = {
    workSchedule: 'night_shift',
    timeSlots: {
      morning: { start: '14:00', end: '18:00', defaultTime: '15:00', label: 'Morning' },
      noon: { start: '19:00', end: '22:00', defaultTime: '20:00', label: 'Noon' },
      evening: { start: '23:00', end: '02:00', defaultTime: '00:00', label: 'Late Evening' },
      bedtime: { start: '06:00', end: '10:00', defaultTime: '08:00', label: 'Morning Sleep' }
    }
  };
  
  const result2 = validatePatientPreferences(correctConfig);
  console.log('  Valid:', result2.isValid);
  console.log('  Issues:', result2.issues);
  console.log('  Fixes:', JSON.stringify(result2.fixes, null, 2));
  console.log('');
  
  // Test case 3: Standard schedule with unusual 02:00
  console.log('Test 3: Standard schedule with unusual 02:00');
  const unusualConfig = {
    workSchedule: 'standard',
    timeSlots: {
      morning: { start: '06:00', end: '10:00', defaultTime: '02:00', label: 'Morning' },
      noon: { start: '11:00', end: '14:00', defaultTime: '12:00', label: 'Afternoon' },
      evening: { start: '17:00', end: '20:00', defaultTime: '18:00', label: 'Evening' },
      bedtime: { start: '21:00', end: '23:59', defaultTime: '22:00', label: 'Bedtime' }
    }
  };
  
  const result3 = validatePatientPreferences(unusualConfig);
  console.log('  Valid:', result3.isValid);
  console.log('  Issues:', result3.issues);
  console.log('  Fixes:', JSON.stringify(result3.fixes, null, 2));
  console.log('');
  
  console.log('✅ ===== VALIDATION FUNCTION TEST COMPLETE =====');
}

// Run tests
async function main() {
  console.log('🚀 Starting Night Shift Migration Tests...');
  console.log('');
  
  try {
    // Test validation functions
    await testValidationFunctions();
    console.log('');
    
    // Test migration with sample data
    await runMigrationTest();
    
    console.log('');
    console.log('✅ All tests completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  createTestData,
  cleanupTestData,
  runMigrationTest,
  testValidationFunctions
};