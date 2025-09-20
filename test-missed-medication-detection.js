const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Test the missed medication detection system
async function testMissedMedicationDetection() {
  console.log('🧪 === MISSED MEDICATION DETECTION TEST ===');
  
  try {
    // Step 1: Check for existing scheduled events
    console.log('📋 Step 1: Checking for existing scheduled medication events...');
    
    const now = new Date();
    const lookbackTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    const scheduledEventsQuery = await firestore.collection('medication_calendar_events')
      .where('status', '==', 'scheduled')
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now))
      .where('scheduledDateTime', '>=', admin.firestore.Timestamp.fromDate(lookbackTime))
      .limit(10)
      .get();
    
    console.log(`📊 Found ${scheduledEventsQuery.docs.length} scheduled events in the last 24 hours`);
    
    if (scheduledEventsQuery.empty) {
      console.log('ℹ️ No scheduled events found for testing. Creating test data...');
      await createTestMedicationEvent();
      return;
    }
    
    // Step 2: Test grace period calculation for existing events
    console.log('📋 Step 2: Testing grace period calculation...');
    
    for (const doc of scheduledEventsQuery.docs.slice(0, 3)) { // Test first 3 events
      const event = doc.data();
      console.log(`\n🔍 Testing event: ${event.medicationName} for patient ${event.patientId}`);
      console.log(`   Scheduled: ${event.scheduledDateTime.toDate().toISOString()}`);
      console.log(`   Status: ${event.status}`);
      
      // Test grace period calculation
      try {
        const gracePeriodResult = await testGracePeriodCalculation(event, event.patientId);
        console.log(`   Grace Period: ${gracePeriodResult.gracePeriodMinutes} minutes`);
        console.log(`   Grace Period End: ${gracePeriodResult.gracePeriodEnd.toISOString()}`);
        console.log(`   Applied Rules: ${gracePeriodResult.appliedRules.join(', ')}`);
        console.log(`   Is Overdue: ${now > gracePeriodResult.gracePeriodEnd}`);
        
        // Check if this event should be marked as missed
        if (now > gracePeriodResult.gracePeriodEnd) {
          console.log(`   ⚠️ This event is past its grace period and should be marked as missed`);
        } else {
          console.log(`   ✅ This event is still within its grace period`);
        }
      } catch (error) {
        console.error(`   ❌ Error calculating grace period:`, error);
      }
    }
    
    // Step 3: Test patient grace period configuration
    console.log('\n📋 Step 3: Testing patient grace period configuration...');
    
    const firstEvent = scheduledEventsQuery.docs[0].data();
    const testPatientId = firstEvent.patientId;
    
    await testPatientGraceConfig(testPatientId);
    
    // Step 4: Test missed medication detection logic
    console.log('\n📋 Step 4: Testing missed medication detection logic...');
    
    await testMissedDetectionLogic();
    
    console.log('\n✅ === MISSED MEDICATION DETECTION TEST COMPLETED ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test grace period calculation for a specific event
async function testGracePeriodCalculation(event, patientId) {
  // Simulate the grace period calculation logic
  const defaultGracePeriods = {
    morning: 30,
    noon: 45,
    evening: 30,
    bedtime: 60
  };
  
  // Determine time slot
  const scheduledTime = event.scheduledDateTime.toDate();
  const hour = scheduledTime.getHours();
  
  let timeSlot = 'morning';
  if (hour >= 11 && hour < 17) timeSlot = 'noon';
  else if (hour >= 17 && hour < 21) timeSlot = 'evening';
  else if (hour >= 21 || hour < 6) timeSlot = 'bedtime';
  
  const gracePeriodMinutes = defaultGracePeriods[timeSlot];
  const gracePeriodEnd = new Date(scheduledTime.getTime() + (gracePeriodMinutes * 60 * 1000));
  
  return {
    gracePeriodMinutes,
    gracePeriodEnd,
    appliedRules: [`default_${timeSlot}`],
    timeSlot,
    isWeekend: [0, 6].includes(scheduledTime.getDay()),
    isHoliday: false
  };
}

// Test patient grace period configuration
async function testPatientGraceConfig(patientId) {
  console.log(`🔍 Testing grace period config for patient: ${patientId}`);
  
  try {
    // Check if patient has existing grace period config
    const configDoc = await firestore.collection('medication_grace_periods').doc(patientId).get();
    
    if (configDoc.exists) {
      const config = configDoc.data();
      console.log('   ✅ Found existing grace period config:', {
        defaultGracePeriods: config.defaultGracePeriods,
        weekendMultiplier: config.weekendMultiplier,
        holidayMultiplier: config.holidayMultiplier
      });
    } else {
      console.log('   ℹ️ No grace period config found, would use defaults');
      
      // Test creating default config
      const defaultConfig = {
        patientId,
        defaultGracePeriods: {
          morning: 30,
          noon: 45,
          evening: 30,
          bedtime: 60
        },
        medicationTypeRules: [
          { medicationType: 'critical', gracePeriodMinutes: 15 },
          { medicationType: 'standard', gracePeriodMinutes: 30 },
          { medicationType: 'vitamin', gracePeriodMinutes: 120 },
          { medicationType: 'prn', gracePeriodMinutes: 0 }
        ],
        weekendMultiplier: 1.5,
        holidayMultiplier: 2.0,
        isActive: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      
      console.log('   📝 Would create default config:', defaultConfig);
    }
    
    // Check patient medication preferences
    const prefsDoc = await firestore.collection('patient_medication_preferences').doc(patientId).get();
    
    if (prefsDoc.exists) {
      const prefs = prefsDoc.data();
      console.log('   ✅ Found patient medication preferences:', {
        workSchedule: prefs.workSchedule,
        timeSlots: prefs.timeSlots,
        hasGracePeriodSettings: !!prefs.gracePeriodSettings
      });
    } else {
      console.log('   ℹ️ No patient medication preferences found');
    }
    
  } catch (error) {
    console.error('   ❌ Error testing patient grace config:', error);
  }
}

// Test missed detection logic
async function testMissedDetectionLogic() {
  console.log('🔍 Testing missed detection logic...');
  
  try {
    const now = new Date();
    
    // Find events that are past their scheduled time but still marked as 'scheduled'
    const overdueQuery = await firestore.collection('medication_calendar_events')
      .where('status', '==', 'scheduled')
      .where('scheduledDateTime', '<=', admin.firestore.Timestamp.fromDate(now))
      .limit(5)
      .get();
    
    console.log(`   📊 Found ${overdueQuery.docs.length} potentially overdue events`);
    
    for (const doc of overdueQuery.docs) {
      const event = doc.data();
      const scheduledTime = event.scheduledDateTime.toDate();
      const minutesOverdue = Math.floor((now.getTime() - scheduledTime.getTime()) / (1000 * 60));
      
      console.log(`   📋 Event: ${event.medicationName}`);
      console.log(`      Scheduled: ${scheduledTime.toISOString()}`);
      console.log(`      Minutes overdue: ${minutesOverdue}`);
      
      // Calculate what the grace period would be
      const gracePeriodCalc = await testGracePeriodCalculation(event, event.patientId);
      const gracePeriodExpired = now > gracePeriodCalc.gracePeriodEnd;
      
      console.log(`      Grace period: ${gracePeriodCalc.gracePeriodMinutes} minutes`);
      console.log(`      Grace period end: ${gracePeriodCalc.gracePeriodEnd.toISOString()}`);
      console.log(`      Should be marked missed: ${gracePeriodExpired}`);
      
      if (gracePeriodExpired) {
        console.log(`      🚨 This event should be automatically marked as missed!`);
      }
    }
    
  } catch (error) {
    console.error('   ❌ Error testing missed detection logic:', error);
  }
}

// Create test medication event for testing
async function createTestMedicationEvent() {
  console.log('📝 Creating test medication event...');
  
  try {
    // Create a test event that's overdue
    const testEvent = {
      medicationId: 'test_medication_id',
      medicationName: 'Test Medication',
      patientId: 'test_patient_id',
      scheduledDateTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() - (2 * 60 * 60 * 1000))), // 2 hours ago
      dosageAmount: '1 tablet',
      status: 'scheduled',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const eventRef = await firestore.collection('medication_calendar_events').add(testEvent);
    console.log('✅ Created test event:', eventRef.id);
    
    // Test grace period calculation on this event
    const gracePeriodCalc = await testGracePeriodCalculation(testEvent, testEvent.patientId);
    console.log('📊 Test event grace period calculation:', gracePeriodCalc);
    
  } catch (error) {
    console.error('❌ Error creating test event:', error);
  }
}

// Test medication type classification
async function testMedicationTypeClassification() {
  console.log('\n📋 Testing medication type classification...');
  
  const testMedications = [
    { name: 'Lisinopril', expectedType: 'critical' },
    { name: 'Metformin', expectedType: 'critical' },
    { name: 'Vitamin D', expectedType: 'vitamin' },
    { name: 'Multivitamin', expectedType: 'vitamin' },
    { name: 'Ibuprofen', expectedType: 'standard' },
    { name: 'Acetaminophen', expectedType: 'standard' }
  ];
  
  for (const med of testMedications) {
    // Simulate medication type classification
    const name = med.name.toLowerCase();
    
    let actualType = 'standard';
    
    const criticalMeds = ['lisinopril', 'metformin', 'insulin', 'warfarin', 'digoxin'];
    const vitaminKeywords = ['vitamin', 'multivitamin', 'supplement'];
    
    if (criticalMeds.some(critical => name.includes(critical))) {
      actualType = 'critical';
    } else if (vitaminKeywords.some(vitamin => name.includes(vitamin))) {
      actualType = 'vitamin';
    }
    
    const isCorrect = actualType === med.expectedType;
    console.log(`   ${isCorrect ? '✅' : '❌'} ${med.name}: ${actualType} (expected: ${med.expectedType})`);
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting missed medication detection system tests...\n');
  
  await testMissedMedicationDetection();
  await testMedicationTypeClassification();
  
  console.log('\n🎉 All tests completed!');
  process.exit(0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testMissedMedicationDetection,
  testGracePeriodCalculation,
  testPatientGraceConfig,
  testMissedDetectionLogic
};